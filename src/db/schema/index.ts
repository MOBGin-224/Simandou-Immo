/**
 * Point d'entrée unique du schéma.
 *
 * Le schéma Drizzle est la définition unique des tables (ADR-004). Les types
 * métier en sont dérivés, jamais réécrits à la main.
 *
 * Périmètre du Lot 1 : organisations, utilisateurs, accès, périmètre
 * gestionnaire, immeubles, appartements, plus la totalité des énumérations du
 * MVP (MVP-BACKLOG-005).
 *
 * Périmètre du Lot 2 : tables d'authentification de Better Auth
 * (MVP-BACKLOG-008).
 */
export * from './enums';
export * from './organizations';
export * from './users';
export * from './properties';
export * from './access';
export * from './auth';
