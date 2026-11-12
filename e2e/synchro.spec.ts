import { expect, test } from '@playwright/test';
import { readAnswers, readMeta, seed, title } from './helpers';
import { copyOf, fakeSupabase, SUPABASE_URL } from './fakeSupabase';

/** Synchro avec le compte, Supabase simulé (fakeSupabase.ts). Sur le vrai projet : comptes.live.spec.ts. */
test.skip(!SUPABASE_URL, 'site compilé sans compte (pas de VITE_SUPABASE_URL dans .env.local)');

const ID = '00000000-0000-4000-8000-000000000001';
const parasite = title('movie', 496243, 'Parasite', { year: 2019 });
const drive = title('movie', 64690, 'Drive', { year: 2011 });

test('ce qui a été fait sur un autre appareil arrive ; ce qui est fait ici part, avec la copie allégée du titre', async ({ page }) => {
  // Sur le compte : Parasite vu (« bien ») et classé depuis un autre appareil ; il n'est pas dans le catalogue d'ici.
  const server = await fakeSupabase(
    page,
    {
      id: ID,
      pseudo: 'Moi',
      friendCode: 'MOI123',
      answers: [{ key: parasite.key, status: 'seen', tier: 'good', title: copyOf(parasite) }],
      meta: { 'ranking:movie': [parasite.key] },
    },
    [],
  );
  await seed(page, { titles: [drive], meta: { lastSync: Date.now() } }, '#/lists');

  // Arrivé : la réponse, le titre (depuis sa copie) et le classement.
  await expect(page.locator('.list-item', { hasText: 'Parasite' })).toBeVisible();
  expect(await readAnswers(page)).toEqual({ [parasite.key]: 'seen:good' });
  expect(await readMeta(page, 'ranking:movie')).toEqual([parasite.key]);

  // Fait ici : Drive vu. Il part vers le compte quelques secondes après, avec sa copie (sans le résumé).
  await page.goto('/#/swipe/movie');
  await page.getByRole('button', { name: 'Vu · bof', exact: true }).click();
  await expect.poll(() => (server.pushed.answers ?? []).map((r) => (r as { key: string }).key), { timeout: 20_000 }).toContain(drive.key);
  const sent = (server.pushed.answers as Record<string, unknown>[]).find((r) => r.key === drive.key)!;
  expect(sent).toMatchObject({ user_id: ID, status: 'seen', tier: 'meh', deleted: false, title: { key: drive.key, title: 'Drive', year: 2011 } });
  expect(sent.title).not.toHaveProperty('overview');
  expect(server.unknown).toEqual([]);
});
