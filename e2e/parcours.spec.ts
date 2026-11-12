import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openRanking, rankedNames, readAnswers, readMeta, seed, title } from './helpers';

/** Parcours principaux : classer par duels, corriger ses listes, « Ce soir ? », sauvegarde. */
const ORDER = ['Le Parrain', 'Parasite', 'Inception', 'Drive', 'Her']; // préférence de l'utilisateur simulé
const films = ORDER.map((n, i) => title('movie', i + 1, n));

/** Répond à chaque duel selon ORDER, jusqu'à « Tout est classé ! ». Renvoie le nombre de duels. */
async function playDuels(page: Page): Promise<number> {
  const done = page.getByText('Tout est classé !');
  const cards = page.locator('.duel-card .title-main');
  let duels = 0;
  while (!(await done.isVisible())) {
    expect(duels).toBeLessThan(20);
    await expect(cards.first().or(done)).toBeVisible();
    if (await done.isVisible()) break;
    const names = await cards.allTextContents();
    const best = names.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
    await page.locator('.duel-card', { hasText: best }).click();
    duels++;
    await expect.poll(async () => (await done.isVisible()) || (await cards.allTextContents()).sort().join() !== names.sort().join()).toBe(true);
  }
  return duels;
}

test('classer par duels : chaque titre trouve sa place, en peu de duels', async ({ page }) => {
  await seed(page, { titles: films, answers: films.map((t) => ({ key: t.key, status: 'seen' as const, tier: 'good' as const })), meta: { lastSync: Date.now() } }, '#/rank/movie');
  await expect(page.getByText('Lequel préfères-tu ?')).toBeVisible();
  const duels = await playDuels(page);
  expect(duels).toBeLessThanOrEqual(8); // insertion dichotomique : 0 + 1 + 2 + 2 + 3 au plus pour 5 titres
  await openRanking(page);
  await expect.poll(() => rankedNames(page)).toEqual(ORDER);
  expect(await readMeta(page, 'ranking:movie')).toEqual(films.map((f) => f.key));
});

test('classement : les « bien » passent en duel avant les « bof » ; un « bof » peut aller en dernière place', async ({ page }) => {
  const [drive, her, parrain] = [films[3], films[4], films[0]];
  await seed(
    page,
    {
      titles: [drive, her, parrain],
      answers: [
        { key: drive.key, status: 'seen', tier: 'good' },
        { key: her.key, status: 'seen', tier: 'good' },
        { key: parrain.key, status: 'seen', tier: 'meh' },
      ],
      meta: { lastSync: Date.now() },
    },
    '#/rank/movie',
  );
  const cards = page.locator('.duel-card .title-main');
  await expect(cards).toHaveCount(2);
  expect((await cards.allTextContents()).sort()).toEqual(['Drive', 'Her']); // le « bof » attend
  await expect(page.getByRole('button', { name: '🗑️ Trash' })).toHaveCount(0); // seulement pour un « bof »
  await page.locator('.duel-card', { hasText: 'Drive' }).click();
  await expect(cards.filter({ hasText: 'Le Parrain' })).toHaveCount(1);
  await page.getByRole('button', { name: '🗑️ Trash' }).click();
  await expect(page.getByText('Tout est classé !')).toBeVisible();
  await openRanking(page);
  await expect.poll(() => rankedNames(page)).toEqual(['Drive', 'Her', 'Le Parrain']);
});

test('Mes listes : corriger une erreur (vu → pas vu → reproposé au swipe)', async ({ page }) => {
  const [a, b] = films;
  await seed(page, { titles: [a, b], answers: [{ key: a.key, status: 'seen' }, { key: b.key, status: 'seen' }] }, '#/lists');
  await expect(page.locator('.list-item')).toHaveCount(2);
  await page.locator('.list-item', { hasText: a.title }).getByRole('button', { name: 'Marquer pas vu' }).click();
  await expect(page.locator('.list-item')).toHaveCount(1);
  await page.getByRole('button', { name: '🙈 Pas vus' }).click();
  await page.locator('.list-item', { hasText: a.title }).getByRole('button', { name: 'Reproposer au swipe' }).click();
  await expect(page.getByText('Cette liste est vide.')).toBeVisible();
  expect(await readAnswers(page)).toEqual({ [b.key]: 'seen' });
});

test('Mes listes : recherche sans accents ni majuscules', async ({ page }) => {
  const amelie = title('movie', 9, 'Le Fabuleux Destin d’Amélie Poulain');
  await seed(page, { titles: [amelie, films[0]], answers: [{ key: amelie.key, status: 'seen' }, { key: films[0].key, status: 'seen' }] }, '#/lists');
  await page.getByPlaceholder(/Rechercher/).fill('AMELIE');
  await expect(page.locator('.list-item')).toHaveCount(1);
  await expect(page.locator('.list-item')).toContainText('Amélie');
});

test('Ce soir ? : tirage dans la wishlist, puis « vu » le retire', async ({ page }) => {
  const wish = films.slice(0, 2);
  await seed(page, { titles: wish, answers: wish.map((t) => ({ key: t.key, status: 'wish' as const })), meta: { lastSync: Date.now() } }, '#/tonight');
  await expect(page.getByText('2 titres possibles')).toBeVisible();
  await page.getByRole('button', { name: '🎲 Tirer au sort' }).click();
  const card = page.locator('.tonight-card.revealed');
  await expect(card).toBeVisible({ timeout: 10_000 });
  const name = (await card.locator('.title-main').textContent())!;
  expect(wish.map((t) => t.title)).toContain(name);
  await card.getByRole('button', { name: 'Vu, bien' }).click();
  const key = wish.find((t) => t.title === name)!.key;
  await expect.poll(async () => (await readAnswers(page))[key]).toBe('seen:good');
  await expect(page.getByText('1 titre possible')).toBeVisible();
});

test('sauvegarde : exporter, tout effacer, réimporter', async ({ page }, info) => {
  const [a, b] = films;
  await seed(page, { titles: [a, b], answers: [{ key: a.key, status: 'seen', tier: 'good' }, { key: b.key, status: 'wish' }], meta: { 'ranking:movie': [a.key] } }, '#/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^rank-it-all-\d{4}-\d{2}-\d{2}\.json$/);
  const file = info.outputPath('sauvegarde.json');
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup).toMatchObject({ app: 'rank-it-all', version: 1 });
  expect(backup.answers).toHaveLength(2);

  // Tout est effacé (autre appareil, base perdue…), puis la sauvegarde est réimportée.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('rank-it-all');
        req.onsuccess = () => {
          const tx = req.result.transaction(['answers', 'meta'], 'readwrite');
          tx.objectStore('answers').clear();
          tx.objectStore('meta').clear();
          tx.oncomplete = () => (req.result.close(), resolve());
        };
      }),
  );
  page.on('dialog', (d) => d.accept()); // « Remplacer toutes tes réponses… ? »
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importer', exact: true }).click()]);
  await chooser.setFiles(file);
  await expect(page.getByText('✓ 2 réponses restaurées.')).toBeVisible();
  expect(await readAnswers(page)).toEqual({ [a.key]: 'seen:good', [b.key]: 'wish' });
  expect(await readMeta(page, 'ranking:movie')).toEqual([a.key]);
});

test('sauvegarde : un fichier qui n’en est pas une est refusé, rien n’est effacé', async ({ page }, info) => {
  await seed(page, { titles: [films[0]], answers: [{ key: films[0].key, status: 'seen' }] }, '#/settings');
  const file = info.outputPath('autre.json');
  writeFileSync(file, JSON.stringify({ app: 'autre-appli', answers: [] }));
  page.on('dialog', (d) => d.accept());
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importer', exact: true }).click()]);
  await chooser.setFiles(file);
  await expect(page.getByText('✕ Fichier de sauvegarde invalide.')).toBeVisible();
  expect(await readAnswers(page)).toEqual({ [films[0].key]: 'seen' });
});
