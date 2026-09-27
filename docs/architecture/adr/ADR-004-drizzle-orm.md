# ADR-004 : Drizzle ORM

## Status

Accepted

## Date

2026-09-19

## Context

L'accès aux données doit satisfaire trois exigences simultanées : typage réel dérivé du schéma, migrations versionnées, et transparence des requêtes générées, puisque les requêtes financières et les vérifications de périmètre sont au cœur du produit.

Formalisation rétroactive le 2026-09-26.

## Decision

**Drizzle ORM** est la couche d'accès aux données unique.

Règles :

1. Le schéma Drizzle est la **définition unique** des tables. Les types métier en sont dérivés, jamais réécrits à la main.
2. Toute évolution de schéma passe par une **migration versionnée**.
3. Aucun accès aux données ne contourne Drizzle, ni depuis un module métier, ni depuis une route.
4. Aucun SQL concaténé à partir d'une entrée utilisateur.

## Alternatives

**Prisma.** Écartée principalement pour l'opacité relative des requêtes générées et le poids du moteur à l'exécution, sur un produit dont les requêtes financières doivent rester lisibles et indexables de façon prévisible.

**SQL brut avec un simple pilote.** Écartée : perte du typage dérivé du schéma et absence d'outillage de migration, pour un gain de contrôle que Drizzle fournit déjà.

**TypeORM, Sequelize.** Écartées sur la qualité du typage TypeScript.

## Reasons

1. Les types sont dérivés du schéma, ce qui rend impossible la divergence silencieuse entre la base et le code.
2. Les requêtes générées restent proches du SQL, donc auditables et optimisables : indispensable pour les requêtes de solde qui agrègent deux tables de créances.
3. Le générateur de migrations produit des fichiers SQL lisibles, relus avant application.
4. Drizzle ne dépend que d'une connexion PostgreSQL, ce qui préserve la portabilité voulue par ADR-005.

## Consequences

Avantages : typage fiable, requêtes prévisibles, migrations explicites.

Compromis : moins d'abstractions prêtes à l'emploi qu'un ORM plus lourd. Les relations complexes s'écrivent plus explicitement. C'est accepté, et cohérent avec l'exigence de lisibilité du modèle financier.

## Security Impact

Positif : les requêtes paramétrées éliminent l'injection SQL dans l'usage normal.

La vérification d'autorisation reste de la responsabilité du service applicatif. Drizzle n'en fournit aucune, et n'est pas censé en fournir.

## Data Impact

Le schéma Drizzle et les migrations constituent l'historique réel de la structure de données. Les énumérations PostgreSQL sont déclarées via `pgEnum`, en cohérence avec DEC-021.

## Operational Impact

Les migrations s'appliquent dans le pipeline de déploiement, de manière non destructive, et sont vérifiées en staging avant production.

## Migration

Sans objet : décision initiale.

Un changement d'ORM impliquerait de réécrire la couche d'accès mais non le schéma, puisque celui-ci reste du PostgreSQL standard.

## Related Documents

- `docs/04-technical/database.md`
- `docs/04-technical/engineering-standards.md`

## Related ADRs

- ADR-003, ADR-005, ADR-006
