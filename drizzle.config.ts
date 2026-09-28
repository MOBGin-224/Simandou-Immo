import { defineConfig } from 'drizzle-kit';

// Charge .env sans dépendance externe : Node 20.12+ fournit loadEnvFile.
// L'absence du fichier n'est pas une erreur, les variables peuvent venir de
// l'environnement (CI, Vercel).
try {
  process.loadEnvFile('.env');
} catch {
  // .env absent : on s'appuie sur l'environnement déjà en place.
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // Les identifiants TypeScript sont en camelCase, les colonnes en snake_case
  // (DEC-011). Cette option fait la conversion une fois pour toutes, au lieu de
  // répéter le nom de chaque colonne et de risquer une divergence.
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
