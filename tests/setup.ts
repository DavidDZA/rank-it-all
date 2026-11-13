// Réglage commun des tests Vitest.
//
// La langue de l'« appareil » est fixée au français : depuis le 13/11, la langue du catalogue vient de celle de
// l'appareil (language.ts), et Node la prend du système. Sans ce réglage, un test passait sur un PC en français et
// échouait sur la machine de GitHub (en anglais), qui bloquait alors le déploiement. Les tests de langue
// (langue.test.ts) choisissent la leur.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'language', { get: () => 'fr-FR', configurable: true });
  Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'], configurable: true });
}
