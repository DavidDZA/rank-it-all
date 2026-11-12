import { expect, test, type Page } from '@playwright/test';
import { readAnswers, seed, title } from './helpers';
import { copyOf, fakeSupabase, SUPABASE_URL, type FakeUser } from './fakeSupabase';

/** « À deux » avec un ami, Supabase simulé (fakeSupabase.ts) : son top, wishlist commune, conseils, compatibilité. */
test.skip(!SUPABASE_URL, 'site compilé sans compte (pas de VITE_SUPABASE_URL dans .env.local)');

const NAMES = ['Inception', 'Parasite', 'Drive', 'Her', 'Arrival', 'Whiplash', 'Amélie', 'Le Parrain', 'Matrix'];
const f = Object.fromEntries(NAMES.map((n, i) => [n, title('movie', i + 1, n)]));
const SHARED = ['Inception', 'Parasite', 'Drive', 'Her', 'Arrival']; // vus et classés par les deux, dans le même ordre

const me: FakeUser = { id: '00000000-0000-4000-8000-000000000001', pseudo: 'Moi', friendCode: 'MOI123' };
const camille = (extra: Partial<FakeUser> = {}): FakeUser => ({
  id: '00000000-0000-4000-8000-000000000002',
  pseudo: 'Camille',
  friendCode: 'CAM456',
  // Whiplash n'est pas dans mon catalogue : affiché grâce à la copie jointe à sa réponse.
  answers: [
    ...[...SHARED, 'Whiplash'].map((n) => ({ key: f[n].key, status: 'seen' as const, tier: 'good' as const, title: copyOf(f[n]) })),
    { key: f['Amélie'].key, status: 'wish' as const, title: copyOf(f['Amélie']) },
  ],
  meta: { 'ranking:movie': [...SHARED, 'Whiplash'].map((n) => f[n].key) },
  ...extra,
});

/** Mon côté, dans la base locale : les 5 communs et Le Parrain vus et classés, Amélie et Matrix en wishlist. */
async function openDuo(page: Page, friend: FakeUser) {
  const server = await fakeSupabase(page, me, [friend]);
  const mine = [...SHARED, 'Le Parrain'];
  await seed(
    page,
    {
      titles: NAMES.filter((n) => n !== 'Whiplash').map((n) => f[n]),
      answers: [...mine.map((n) => ({ key: f[n].key, status: 'seen' as const, tier: 'good' as const })), { key: f['Amélie'].key, status: 'wish' }, { key: f['Matrix'].key, status: 'wish' }],
      meta: { 'ranking:movie': mine.map((n) => f[n].key), lastSync: Date.now() },
    },
    `#/duo/${friend.id}`,
  );
  await expect(page.getByRole('heading', { name: '👥 Toi & Camille' })).toBeVisible();
  return server;
}

const names = (page: Page) => page.locator('.list-item .title-main').allTextContents();

test('son top, wishlist commune, conseils croisés et compatibilité', async ({ page }) => {
  const server = await openDuo(page, camille());

  // Son top : tout son classement, dans son ordre (Whiplash compris, absent de mon catalogue).
  await expect.poll(() => names(page)).toEqual([...SHARED, 'Whiplash']);

  await page.getByRole('button', { name: '💖 En commun' }).click();
  await expect.poll(() => names(page)).toEqual(['Amélie']);

  await page.getByRole('button', { name: '💡 Conseils' }).click();
  const forMe = page.locator('section', { has: page.getByRole('heading', { name: '💡 Camille te conseille' }) });
  const forThem = page.locator('section', { has: page.getByRole('heading', { name: '🎁 À conseiller à Camille' }) });
  await expect(forMe.locator('.title-main')).toHaveText(['Whiplash']);
  await expect(forThem.locator('.title-main')).toHaveText(['Le Parrain']);
  // Un conseil ajouté à ma wishlist : enregistré chez moi, titre compris.
  await forMe.getByRole('button', { name: 'Ajouter à ta wishlist' }).click();
  await expect(page.getByText('« Whiplash » ajouté à ta wishlist')).toBeVisible();
  await expect.poll(async () => (await readAnswers(page))[f['Whiplash'].key]).toBe('wish');

  await page.getByRole('button', { name: '🎯 Compatibilité' }).click();
  await expect(page.locator('.duo-percent')).toHaveText('100 %');
  await expect(page.getByText('Âmes sœurs cinéphiles 💞')).toBeVisible();

  expect(server.unknown).toEqual([]);
});

test('ami qui ne partage pas son classement : message à la place de son top et de la compatibilité', async ({ page }) => {
  await openDuo(page, camille({ shareRanking: false }));
  await expect(page.getByText('Camille ne partage pas son classement.')).toBeVisible();
  await page.getByRole('button', { name: '🎯 Compatibilité' }).click();
  await expect(page.getByText('Camille ne partage pas son classement.')).toBeVisible();
});

test('pas (ou plus) ami : message et retour à la liste des amis', async ({ page }) => {
  await fakeSupabase(page, me, []);
  await seed(page, {}, `#/duo/${camille().id}`);
  await expect(page.getByText('Cette personne ne fait pas (ou plus) partie de tes amis.')).toBeVisible();
  await expect(page.getByRole('link', { name: '← Mes amis' })).toBeVisible();
});
