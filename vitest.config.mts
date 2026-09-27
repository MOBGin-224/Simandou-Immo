import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Résolution native des alias de tsconfig.json (`@/*` vers `src/*`).
  // Aucune dépendance supplémentaire n'est nécessaire.
  resolve: { tsconfigPaths: true },
  test: {
    // Environnement Node : au Lot 0, les tests portent sur le domaine et les
    // règles métier, pas sur le rendu. L'environnement jsdom et React Testing
    // Library seront ajoutés avec le premier test de composant.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
  },
});
