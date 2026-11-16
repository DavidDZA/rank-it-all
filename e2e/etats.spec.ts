import { expect, test, type Page } from '@playwright/test';
import { moveTo, openRanking, rankedNames, readAnswers, readMeta, seed, title } from './helpers';

/**
 * État d'un titre, modifiable partout (16/11) : depuis n'importe quel état, vers vu · bien, vu · bof, envie, pas envie
 * ou à trier. Un seul bouton par ligne (l'état actuel), qui ouvre les 5 choix ; la fiche les montre directement.
 */
const films = ['Heat', 'Collateral', 'Casino', 'Memento', 'Matrix', 'Alien'].map((n, i) => title('movie', i + 1, n));
const key = (name: string) => films.find((f) => f.title === name)!.key;

async function open(page: Page, hash: string) {
  await seed(
    page,
    {
      titles: films,
      answers: [
        { key: key('Heat'), status: 'seen', tier: 'good' },
        { key: key('Collateral'), status: 'seen', tier: 'good' },
        { key: key('Casino'), status: 'seen', tier: 'meh' },
        { key: key('Memento'), status: 'wish' },
        { key: key('Matrix'), status: 'unseen' },
      ],
      meta: {
        lastSync: Date.now(),
        'new-titles': { checkedAt: Date.now(), addedAt: 0 },
        'ranking:movie': [key('Heat'), key('Collateral'), key('Casino')],
        'ranking:wish:movie': [key('Memento')],
      },
    },
    hash,
  );
}

const row = (page: Page, name: string) => page.locator('.list-item', { hasText: name }).first();
const state = (page: Page, name: string) => row(page, name).locator('.status-btn .btn-cap');
const sheet = (page: Page) => page.getByRole('dialog', { name: /^Ranger/ });

test.describe('état d’un titre', () => {
  test('le bouton se lit comme une liste déroulante : l’état, et une flèche bien visible à droite', async ({ page }) => {
    await open(page, '#/lists');
    const btn = row(page, 'Heat').locator('.status-btn');
    await expect(btn.locator('.btn-cap')).toHaveText('Bien');
    const arrow = btn.locator('.status-chevron svg');
    await expect(arrow).toBeVisible();
    const a = (await arrow.boundingBox())!;
    expect(a.width).toBeGreaterThanOrEqual(14); // plus le petit ▾ d'avant
    const b = (await btn.boundingBox())!;
    expect(a.x).toBeGreaterThan(b.x + b.width / 2); // à droite de l'état
    await expect(btn).toHaveAttribute('aria-label', 'Heat : Vu · bien. Changer');
  });

  test('la fenêtre des 5 états : l’état actuel marqué, tout tient dans l’écran', async ({ page }) => {
    await open(page, '#/lists');
    await row(page, 'Heat').locator('.status-btn').click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator('.status-choice')).toHaveText([/Vu · bien.*Actuel/, /Vu · bof/, /Envie \(wishlist\)/, /Pas envie/, /À trier/]);
    await expect(sheet(page).getByRole('button', { name: 'Vu · bien', exact: true })).toBeDisabled();
    const viewport = page.viewportSize()!;
    // Une fois la fenêtre montée (animation), le dernier choix est entièrement à l'écran.
    const last = sheet(page).locator('.status-choice').last();
    await expect
      .poll(async () => {
        const b = (await last.boundingBox())!;
        return b.y + b.height;
      })
      .toBeLessThanOrEqual(viewport.height + 1);
    for (const choice of await sheet(page).locator('.status-choice').all())
      expect((await choice.boundingBox())!.x + (await choice.boundingBox())!.width).toBeLessThanOrEqual(viewport.width + 1);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
  });

  test('mon classement : bien → bof → bien, le titre garde sa place', async ({ page }) => {
    await open(page, '#/rank/movie');
    await openRanking(page);
    await expect.poll(() => rankedNames(page)).toEqual(['Heat', 'Collateral', 'Casino']);
    await moveTo(page, row(page, 'Heat'), 'Vu · bof');
    await expect(state(page, 'Heat')).toHaveText('Bof');
    await expect(page.locator('.toast')).toContainText('Heat → 😐 Vu · bof');
    expect((await readAnswers(page))[key('Heat')]).toBe('seen:meh');
    await expect.poll(() => rankedNames(page)).toEqual(['Heat', 'Collateral', 'Casino']);
    // Un « bof » remonte en « bien » de la même façon.
    await moveTo(page, row(page, 'Casino'), 'Vu · bien');
    await expect(state(page, 'Casino')).toHaveText('Bien');
    expect((await readAnswers(page))[key('Casino')]).toBe('seen:good');
    await expect.poll(() => rankedNames(page)).toEqual(['Heat', 'Collateral', 'Casino']);
  });

  test('mon classement : « Reclasser » dans la liste d’un titre classé seulement ; il redevient « non classé »', async ({ page }) => {
    await open(page, '#/rank/movie');
    await openRanking(page);
    // Plus de bouton à part sur la ligne : seulement l'état.
    await expect(row(page, 'Heat').locator('.btn')).toHaveCount(1);
    await row(page, 'Heat').locator('.status-btn').click();
    await expect(sheet(page).locator('.status-choice')).toHaveText([/Vu · bien/, /Vu · bof/, /Envie/, /Pas envie/, /À trier/, /Reclasser.*nouveaux duels/]);
    await sheet(page).getByRole('button', { name: 'Reclasser', exact: true }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Heat → ↺ Reclasser');
    await expect.poll(() => rankedNames(page)).toEqual(['Collateral', 'Casino']);
    expect((await readAnswers(page))[key('Heat')]).toBe('seen:good'); // toujours vu et aimé
    // Titre non classé : pas de « Reclasser ».
    await row(page, 'Heat').locator('.status-btn').click();
    await expect(sheet(page).getByRole('button', { name: 'Reclasser', exact: true })).toHaveCount(0);
  });

  test('wishlist priorisée : « Re-prioriser » dans la liste, le titre quitte l’ordre de priorité', async ({ page }) => {
    await open(page, '#/wishlist');
    await page.locator('button.chip', { hasText: 'Films' }).click(); // l'ordre de priorité est par catégorie
    await row(page, 'Memento').locator('.status-btn').click();
    await sheet(page).getByRole('button', { name: 'Re-prioriser', exact: true }).click();
    await expect.poll(() => readMeta(page, 'ranking:wish:movie')).toEqual([]);
    expect((await readAnswers(page))[key('Memento')]).toBe('wish');
  });

  test('mon classement : vers la wishlist, après confirmation ; retiré du classement', async ({ page }) => {
    await open(page, '#/rank/movie');
    await openRanking(page);
    page.once('dialog', (d) => d.dismiss()); // « Heat » quittera ton classement : non
    await moveTo(page, row(page, 'Heat'), 'Envie (wishlist)');
    expect((await readAnswers(page))[key('Heat')]).toBe('seen:good');
    await page.keyboard.press('Escape');
    page.once('dialog', (d) => d.accept());
    await moveTo(page, row(page, 'Heat'), 'Envie (wishlist)');
    await expect.poll(async () => (await readAnswers(page))[key('Heat')]).toBe('wish');
    await expect.poll(() => rankedNames(page)).toEqual(['Collateral', 'Casino']);
    expect(await readMeta(page, 'ranking:movie')).toEqual([key('Collateral'), key('Casino')]);
  });

  test('wishlist : envie → vu · bien ; « à trier » efface la réponse et le sort de la wishlist priorisée', async ({ page }) => {
    await open(page, '#/wishlist');
    await moveTo(page, row(page, 'Memento'), 'À trier');
    await expect(row(page, 'Memento')).toHaveCount(0);
    const answers = await readAnswers(page);
    expect(answers[key('Memento')]).toBeUndefined();
    expect(await readMeta(page, 'ranking:wish:movie')).toEqual([]);
  });

  test('mes listes : pas envie → envie, puis → vu · bof, puis → à trier', async ({ page }) => {
    await open(page, '#/lists');
    await page.locator('button.chip', { hasText: 'Pas vus' }).click();
    await moveTo(page, row(page, 'Matrix'), 'Envie (wishlist)');
    await expect.poll(async () => (await readAnswers(page))[key('Matrix')]).toBe('wish');
    await page.goto('/#/wishlist');
    await moveTo(page, row(page, 'Matrix'), 'Vu · bof');
    await expect.poll(async () => (await readAnswers(page))[key('Matrix')]).toBe('seen:meh');
    await page.goto('/#/lists');
    await moveTo(page, row(page, 'Matrix'), 'À trier');
    await expect.poll(async () => (await readAnswers(page))[key('Matrix')]).toBeUndefined();
  });

  test('fiche : les 5 états directement, l’actuel marqué', async ({ page }) => {
    await open(page, '#/lists');
    await row(page, 'Casino').locator('.row-main').click();
    const fiche = page.getByRole('dialog', { name: 'Fiche de Casino' });
    const choices = fiche.locator('.fiche-actions .status-choice');
    await expect(choices).toHaveCount(5);
    await expect(fiche.getByRole('button', { name: 'Vu · bof', exact: true })).toBeDisabled();
    await fiche.getByRole('button', { name: 'Pas envie', exact: true }).click();
    await expect.poll(async () => (await readAnswers(page))[key('Casino')]).toBe('unseen');
    await expect(fiche.getByRole('button', { name: 'Pas envie', exact: true })).toBeDisabled();
    // Les 5 boutons tiennent dans la fiche (une ou deux lignes).
    const width = page.viewportSize()!.width;
    for (const c of await choices.all()) expect((await c.boundingBox())!.x + (await c.boundingBox())!.width).toBeLessThanOrEqual(width);
  });
});
