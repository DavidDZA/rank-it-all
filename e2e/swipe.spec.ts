import { expect, test, type Page } from '@playwright/test';
import { mockTmdbApi, readAnswers, readMeta, seed, title } from './helpers';

/** Swipe : chaque geste, bouton ou touche enregistre la bonne réponse. Le tirage est aléatoire : on lit la carte affichée. */
const NAMES = ['Inception', 'Parasite', 'Drive', 'Whiplash'];
const films = NAMES.map((n, i) => title('movie', i + 1, n));
const keyOf = (name: string) => films.find((f) => f.title === name)!.key;

/** Titre de la carte du dessus (pas celle de derrière). */
const current = (page: Page) => page.locator('.swipe-card:not(.card-behind) .title-main');

async function open(page: Page, extra: Parameters<typeof seed>[1] = {}) {
  await seed(page, { titles: films, ...extra }, '#/swipe/movie');
  await expect(current(page)).toBeVisible();
}

/** Clique sur un bouton du swipe et attend la carte suivante ; renvoie le titre qui était affiché. */
async function answer(page: Page, button: string): Promise<string> {
  const name = (await current(page).textContent())!;
  await page.getByRole('button', { name: button, exact: true }).click();
  await expect(page.locator('.swipe-card:not(.card-behind)').getByText(name, { exact: true })).toHaveCount(0);
  return name;
}

/** Glisse la carte du dessus de (dx, dy) pixels : à la souris sur PC, au doigt sur téléphone. */
async function drag(page: Page, dx: number, dy: number, touch: boolean) {
  const box = (await page.locator('.swipe-card:not(.card-behind)').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const steps = 10;
  if (!touch) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let s = 1; s <= steps; s++) await page.mouse.move(x + (dx * s) / steps, y + (dy * s) / steps);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let s = 1; s <= steps; s++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * s) / steps, y: y + (dy * s) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Appui sur la carte du dessus, puis déplacements et lâcher pas à pas (souris sur PC, doigt sur téléphone). */
async function press(page: Page, touch: boolean) {
  const box = (await page.locator('.swipe-card:not(.card-behind)').boundingBox())!;
  const x0 = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  else {
    await page.mouse.move(x0, y0);
    await page.mouse.down();
  }
  return {
    /** Déplace le doigt à (dx, dy) du point de départ. */
    async move(dx: number, dy: number) {
      const p = { x: x0 + dx, y: y0 + dy };
      if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
      else await page.mouse.move(p.x, p.y, { steps: 5 });
    },
    async release() {
      if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
    },
  };
}

const guide = (page: Page) => page.locator('.swipe-guide');

test.describe('swipe 4 coins', () => {
  test('les 4 boutons : vu bien, envie, pas envie, vu bof ; puis « Tout est trié »', async ({ page }) => {
    await open(page);
    const good = await answer(page, 'Vu · bien');
    const wish = await answer(page, 'Envie');
    const unseen = await answer(page, 'Pas envie');
    const meh = await answer(page, 'Vu · bof');
    await expect(page.getByText('Tout est trié !')).toBeVisible();
    expect(await readAnswers(page)).toEqual({ [keyOf(good)]: 'seen:good', [keyOf(wish)]: 'wish', [keyOf(unseen)]: 'unseen', [keyOf(meh)]: 'seen:meh' });
    // « Annuler » reste possible une fois tout trié.
    await page.getByRole('button', { name: '↶ Annuler' }).click();
    await expect(current(page)).toHaveText(meh);
    await expect.poll(async () => (await readAnswers(page))[keyOf(meh)]).toBeUndefined();
    await answer(page, 'Vu · bof');
    await expect(page.locator('.pill', { hasText: '🔥' })).toHaveText('🔥 4');
    // Chaque tri compte dans l'activité du jour (série, badges).
    const activity = await readMeta<Record<string, number>>(page, 'activity');
    expect(Object.values(activity ?? {})).toEqual([4]);
  });

  test('vrai geste vers un coin (souris ou doigt)', async ({ page, isMobile }) => {
    await open(page);
    const name = (await current(page).textContent())!;
    await drag(page, 160, -140, isMobile); // ↗ vu, bien
    await expect.poll(() => readAnswers(page)).toEqual({ [keyOf(name)]: 'seen:good' });
    const next = (await current(page).textContent())!;
    await drag(page, -160, 140, isMobile); // ↙ pas envie
    await expect.poll(() => readAnswers(page)).toEqual({ [keyOf(name)]: 'seen:good', [keyOf(next)]: 'unseen' });
  });

  test('geste sans direction claire : rien d’enregistré, la carte revient, un conseil s’affiche', async ({ page, isMobile }) => {
    await open(page);
    const name = (await current(page).textContent())!;
    await drag(page, 200, 0, isMobile); // tout droit à droite : pas un coin
    await expect(page.getByText('Swipe en diagonale, vers un coin')).toBeVisible();
    await expect(current(page)).toHaveText(name);
    expect(await readAnswers(page)).toEqual({});
  });

  test('« Annuler » remet la carte et efface la réponse ; « Passer » n’enregistre rien', async ({ page }) => {
    await open(page);
    const name = await answer(page, 'Vu · bien');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(current(page)).toHaveText(name);
    await expect.poll(() => readAnswers(page)).toEqual({});
    await expect(page.locator('.pill', { hasText: '🔥' })).toHaveText('🔥 0');
    await answer(page, 'Passer');
    expect(await readAnswers(page)).toEqual({});
  });

  test('titres déjà triés : plus proposés', async ({ page }) => {
    await open(page, { answers: [{ key: films[0].key, status: 'seen' }, { key: films[1].key, status: 'unseen' }, { key: films[2].key, status: 'wish' }] });
    await expect(current(page)).toHaveText('Whiplash');
    await answer(page, 'Vu · bien');
    await expect(page.getByText('Tout est trié !')).toBeVisible();
  });

  test('clavier : 9 vu bien, 7 envie, 1 pas envie, 3 vu bof', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pas de clavier sur téléphone');
    await open(page);
    const expected: Record<string, string> = {};
    for (const [key, value] of [['9', 'seen:good'], ['7', 'wish'], ['1', 'unseen'], ['3', 'seen:meh']]) {
      const name = (await current(page).textContent())!;
      await page.keyboard.press(key);
      expected[keyOf(name)] = value;
      await expect.poll(() => readAnswers(page)).toEqual(expected);
    }
  });

  test('repères des 4 coins : affichés dès l’appui, le coin visé s’allume, cachés au lâcher', async ({ page, isMobile }) => {
    await open(page);
    await expect(guide(page).locator('.guide-zone')).toHaveText(['↖ ENVIE 💖', 'VU 👍 ↗', '↙ PAS ENVIE 💤', 'VU 😐 ↘']);
    await expect(guide(page)).toHaveCSS('opacity', '0'); // rien tant qu'on n'appuie pas
    const name = (await current(page).textContent())!;
    const finger = await press(page, isMobile);
    await expect(guide(page)).toHaveClass(/visible/);
    await expect(guide(page)).toHaveCSS('opacity', '1');
    await finger.move(40, -40); // vers ↗, sans aller jusqu'au bout
    await expect(guide(page)).toHaveAttribute('data-aim', 'ur');
    await finger.move(-40, 40); // vers ↙
    await expect(guide(page)).toHaveAttribute('data-aim', 'dl');
    await finger.release(); // trop court : la carte revient, rien n'est enregistré
    await expect(guide(page)).not.toHaveClass(/visible/);
    await expect(current(page)).toHaveText(name);
    expect(await readAnswers(page)).toEqual({});
  });

  test('plus d’étiquette « ✨ Comme … » sur les titres recommandés', async ({ page }) => {
    await open(page, { titles: [films[0]], meta: { 'boosts:movie': { [films[0].key]: { s: 2, from: 'Matrix' } } } });
    await expect(current(page)).toHaveText('Inception');
    await expect(page.locator('.swipe-card:not(.card-behind)')).not.toContainText('Comme');
    await expect(page.locator('.card-tag')).toHaveCount(0);
  });
});

test.describe('saga', () => {
  // Saga Alien (3 films sortis), et deux films hors saga très peu votés : la saga sort presque toujours en premier,
  // et il reste des cartes après elle.
  const alien = [title('movie', 101, 'Alien', { year: 1979 }), title('movie', 102, 'Aliens', { year: 1986 }), title('movie', 103, 'Alien 3', { year: 1992 })].map((t) => ({
    ...t,
    collectionId: 8091,
  }));
  const others = [title('movie', 1, 'Drive', { voteCount: 1 }), title('movie', 2, 'Heat', { voteCount: 1 })];
  const SAGA = {
    name: 'Alien - Saga',
    parts: alien.map((t) => ({ id: t.tmdbId, title: t.title, original_title: t.title, release_date: `${t.year}-06-01`, genre_ids: [878], vote_count: 900 })),
  };
  const dropButton = (page: Page) => page.getByRole('button', { name: /Pas envie de la saga/ });

  async function openSaga(page: Page) {
    await mockTmdbApi(page, { '/collection/8091': SAGA });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
    await open(page, { titles: [...alien, ...others], meta: { lastSync: Date.now() } });
    // Un film hors saga peut quand même sortir avant : on le trie, la saga suit.
    const otherNames = others.map((o) => o.title);
    while (otherNames.includes((await current(page).textContent())!)) await answer(page, 'Vu · bien');
    await expect(current(page)).toHaveText('Alien'); // la saga commence par son premier film
  }

  test('« Pas envie de la saga » : tous ses films en « pas envie » d’un coup, puis « Annuler » les remet', async ({ page }) => {
    await openSaga(page);
    const before = await readAnswers(page);
    await expect(dropButton(page)).toHaveText('💤 Pas envie de la saga (3)');
    // Sur l'affiche, en bas et centré (pas en dessous).
    const poster = (await page.locator('.swipe-card:not(.card-behind) .card-poster').boundingBox())!;
    const button = (await dropButton(page).boundingBox())!;
    expect(button.y).toBeGreaterThan(poster.y + poster.height / 2);
    expect(button.y + button.height).toBeLessThanOrEqual(poster.y + poster.height);
    expect(Math.abs(button.x + button.width / 2 - (poster.x + poster.width / 2))).toBeLessThan(2);
    await dropButton(page).click();
    await expect(page.getByText('Saga Alien : 3 films écartés')).toBeVisible();
    await expect.poll(() => readAnswers(page)).toEqual({ ...before, 'movie:101': 'unseen', 'movie:102': 'unseen', 'movie:103': 'unseen' });
    await expect(page.locator('.swipe-card:not(.card-behind) .title-main', { hasText: /^Alien/ })).toHaveCount(0);
    await expect(page.locator('.pill', { hasText: '🔥' })).toHaveText(`🔥 ${Object.keys(before).length + 3}`);

    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(current(page)).toHaveText('Alien');
    await expect.poll(() => readAnswers(page)).toEqual(before);
    await expect(dropButton(page)).toHaveText('💤 Pas envie de la saga (3)');
  });

  test('le bouton s’efface pendant le glissement, et revient si on lâche sans choisir', async ({ page, isMobile }) => {
    await openSaga(page);
    await expect(dropButton(page)).toHaveCSS('opacity', '1');
    const finger = await press(page, isMobile);
    await finger.move(40, -40); // la carte bouge, sans aller jusqu'au coin
    await expect(dropButton(page)).toHaveCSS('opacity', '0');
    await finger.release();
    await expect(dropButton(page)).toHaveCSS('opacity', '1');
    await expect(current(page)).toHaveText('Alien');
    // Un simple toucher (fiche) ne l'efface pas.
    const tap = await press(page, isMobile);
    await expect(dropButton(page)).toHaveCSS('opacity', '1');
    await tap.release();
  });

  test('le bouton compte les films restant à trier, et disparaît au dernier', async ({ page }) => {
    await openSaga(page);
    await answer(page, 'Vu · bien');
    await expect(current(page)).toHaveText('Aliens');
    await expect(dropButton(page)).toHaveText('💤 Pas envie de la saga (2)');
    await answer(page, 'Vu · bof');
    await expect(current(page)).toHaveText('Alien 3');
    await expect(dropButton(page)).toHaveCount(0); // un seul film : « Pas envie » suffit
  });
});

test.describe('swipe 2 directions', () => {
  test('vu → aimé ou bof ; pas vu → wishlist ou pas envie', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('swipe-mode', 'horizontal'));
    await open(page);
    await expect(page.getByRole('heading', { name: 'Tu l’as vu ?' })).toBeVisible();

    const expected: Record<string, string> = {};
    for (const [first, question, second, value] of [
      ['Vu', 'Vu ! Tu as aimé ?', 'Aimé', 'seen:good'],
      ['Vu', 'Vu ! Tu as aimé ?', 'Bof', 'seen:meh'],
      ['Pas vu', 'Pas vu… envie de le voir ?', 'Wishlist', 'wish'],
      ['Pas vu', 'Pas vu… envie de le voir ?', 'Pas envie', 'unseen'],
    ]) {
      const name = (await current(page).textContent())!;
      await page.getByRole('button', { name: first, exact: true }).click();
      await expect(page.getByRole('heading', { name: question })).toBeVisible();
      await expect(current(page)).toHaveText(name); // même carte, 2e question
      await page.getByRole('button', { name: second, exact: true }).click();
      expected[keyOf(name)] = value;
      await expect.poll(() => readAnswers(page)).toEqual(expected);
    }
    await expect(page.getByText('Tout est trié !')).toBeVisible();
  });

  test('« Annuler » pendant la 2e question revient à la 1re, sans rien enregistrer', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('swipe-mode', 'horizontal'));
    await open(page);
    await page.getByRole('button', { name: 'Vu', exact: true }).click();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tu l’as vu ?' })).toBeVisible();
    expect(await readAnswers(page)).toEqual({});
  });

  test('repères gauche / droite, selon la question', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('swipe-mode', 'horizontal'));
    await open(page);
    await expect(guide(page).locator('.guide-zone')).toHaveText(['← PAS VU 🙈', 'VU ✅ →']);
    const finger = await press(page, isMobile);
    await finger.move(-40, 0);
    await expect(guide(page)).toHaveClass(/visible/);
    await expect(guide(page)).toHaveAttribute('data-aim', 'left');
    await finger.release();
    await expect(guide(page)).not.toHaveClass(/visible/);
    await page.getByRole('button', { name: 'Vu', exact: true }).click();
    await expect(guide(page).locator('.guide-zone')).toHaveText(['← BOF 😐', 'AIMÉ 👍 →']);
  });
});
