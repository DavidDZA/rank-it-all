import { defineConfig } from 'vitest/config';

// Configuration séparée de vite.config.ts : pas besoin du plugin PWA pour les tests.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Langue de l'appareil fixée au français : mêmes résultats sur un PC en français et sur GitHub (en anglais).
    setupFiles: ['tests/setup.ts'],
  },
});
