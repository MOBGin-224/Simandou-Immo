# ADR-005 : Supabase comme fournisseur PostgreSQL managé

## Status

Accepted

## Date

2026-09-19

## Context

Le produit a besoin d'un PostgreSQL hébergé pour les environnements development, staging et production, sans administration système à la charge de l'équipe.

Supabase répond à ce besoin, mais propose aussi une plateforme complète : authentification, stockage, API auto-générée, politiques RLS. Adopter ces briques rendrait le produit difficilement portable.

Formalisation rétroactive le 2026-09-26.

## Decision

Supabase est utilisé **uniquement comme fournisseur PostgreSQL managé**.

| Environnement | Base de données | Application |
|---|---|---|
| Local | PostgreSQL via Docker | Next.js local |
| Development | Supabase PostgreSQL | Vercel |
| Staging | Supabase PostgreSQL | Vercel |
| Production | Supabase PostgreSQL | Vercel |

Contraintes de portabilité, sans exception :

1. L'accès aux données passe **exclusivement** par Drizzle.
2. L'autorisation est implémentée dans le **service applicatif**, jamais par des politiques RLS.
3. L'authentification repose sur Better Auth, pas sur Supabase Auth.
4. Le stockage de fichiers ne dépend pas de Supabase Storage.
5. Aucune fonctionnalité métier ne dépend d'une capacité propre à Supabase.

**La chaîne de connexion est la seule surface d'adhérence au fournisseur.**

## Alternatives

**Adopter la plateforme Supabase complète.** Écartée : gain de vitesse initial réel, mais verrouillage sur l'authentification, le stockage et surtout le modèle d'autorisation, qui deviendrait dépendant de RLS.

**Neon, Railway, RDS, autre PostgreSQL managé.** Non écartés. Ils restent interchangeables précisément grâce aux contraintes ci-dessus. Supabase est retenu pour l'offre de départ et l'outillage, pas pour un verrou technique.

**PostgreSQL auto-hébergé sur VPS.** Écartée : charge d'administration, de sauvegarde et de sécurité disproportionnée pour l'équipe actuelle.

## Reasons

1. Le besoin réel est un PostgreSQL fiable et sauvegardé, pas une plateforme applicative.
2. RLS déplacerait l'autorisation dans la base, alors que le produit exige un point de décision unique, testable et lisible dans le code.
3. Conserver la portabilité coûte peu aujourd'hui et coûterait très cher à rétablir plus tard.

## Consequences

Avantages : administration déléguée, changement d'hébergeur possible sans réécriture applicative.

Compromis : une part des fonctionnalités payées n'est pas utilisée, et certaines briques (authentification, stockage) demandent un travail que la plateforme aurait fourni. C'est le prix explicite de la portabilité.

## Security Impact

Les identifiants de connexion sont des secrets d'environnement, jamais versionnés.

L'absence de RLS signifie que la base ne constitue pas une seconde barrière d'isolation. L'isolation multi-tenant repose entièrement sur le service d'autorisation, ce qui rend ses tests de refus obligatoires et non négociables.

## Data Impact

Aucun. Le schéma reste du PostgreSQL standard, restaurable chez n'importe quel hébergeur compatible.

## Operational Impact

Sauvegardes fournies par la plateforme, mais la **procédure de restauration reste de notre responsabilité** et doit être testée réellement.

Le PostgreSQL local sous Docker doit rester en version compatible avec celle des environnements distants.

## Migration

Changement d'hébergeur : sauvegarde logique, restauration chez le nouveau fournisseur, mise à jour de la chaîne de connexion. Aucun code applicatif à modifier, tant que les contraintes de portabilité sont respectées.

## Related Documents

- `docs/07-operations/deployment.md`
- `docs/04-technical/database.md`
- `docs/00-decisions/decision-register.md` (DEC-007)

## Related ADRs

- ADR-003, ADR-004, ADR-006, ADR-007
