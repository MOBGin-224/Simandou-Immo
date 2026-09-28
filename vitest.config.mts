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

    /*
     * Délais élargis pour les tests adossés à PostgreSQL.
     *
     * Chaque fichier de test qui touche la base démarre son propre PGlite et y
     * applique la vraie migration. Vitest exécute les fichiers en parallèle, un
     * worker par fichier : une dizaine de moteurs PostgreSQL se lancent donc en
     * même temps, et un démarrage qui prend quatre secondes seul peut en prendre
     * vingt sous cette charge.
     *
     * Les valeurs par défaut, 5 secondes par test et 10 par hook, sont calibrées
     * pour des tests unitaires sans base. Les conserver ne rendrait pas la suite
     * plus rapide : elle échouerait par intermittence sur une machine chargée, ce
     * qui est le pire des deux mondes puisqu'un échec cesserait alors de signifier
     * qu'une règle est cassée.
     */
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
