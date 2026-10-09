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
 *
 * Périmètre du Lot 6 : invitations et immeubles qu'elles attribuent
 * (MVP-BACKLOG-025).
 *
 * Périmètre du Lot 8 : contrats, c'est-à-dire les relations locatives
 * (MVP-BACKLOG-032).
 *
 * Périmètre du Lot 9 : échéances de loyer, première des deux créances du MVP
 * (MVP-BACKLOG-036).
 *
 * Périmètre du Lot 10 : charges communes et créances de charge, seconde créance
 * du MVP (MVP-BACKLOG-051, DEC-005).
 */
export * from './enums';
export * from './organizations';
export * from './users';
export * from './properties';
export * from './access';
export * from './auth';
export * from './invitations';
export * from './leases';
export * from './rents';
export * from './charges';
