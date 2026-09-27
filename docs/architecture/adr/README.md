# Architecture Decision Records

Ce dossier conserve les décisions d'architecture de SIMANDOU IMMO, au format imposé par `docs/04-technical/architecture-governance.md`.

## Rôle des ADR par rapport au registre de décisions

Les deux documents ne font pas le même travail et ne doivent pas être confondus.

| | Registre de décisions | ADR |
|---|---|---|
| Emplacement | `docs/00-decisions/decision-register.md` | `docs/architecture/adr/` |
| Répond à | Quelle décision est verrouillée, consolidée ou ouverte ? | Pourquoi cette décision, et qu'implique-t-elle ? |
| Portée | Toutes les décisions, produit comprises | Décisions structurantes d'architecture |
| Autorité | **Rang 1**, fait foi sur le statut | Documente le raisonnement |

En cas de divergence sur le **statut** d'une décision, le registre fait foi.

## Décisions enregistrées

| ADR | Titre | Statut |
|---|---|---|
| [ADR-001](ADR-001-architecture-modular-monolith.md) | Architecture modular monolith | Accepted |
| [ADR-002](ADR-002-nextjs-react-typescript.md) | Next.js, React et TypeScript strict | Accepted |
| [ADR-003](ADR-003-postgresql-source-de-verite.md) | PostgreSQL comme source de vérité | Accepted |
| [ADR-004](ADR-004-drizzle-orm.md) | Drizzle ORM | Accepted |
| [ADR-005](ADR-005-supabase-postgresql-manage.md) | Supabase comme fournisseur PostgreSQL managé, et hébergement Vercel | Accepted |
| [ADR-006](ADR-006-better-auth.md) | Better Auth pour l'authentification | Accepted |
| [ADR-007](ADR-007-autorisation-role-et-perimetre.md) | Autorisation par rôle et périmètre | Accepted |
| [ADR-008](ADR-008-onboarding-par-invitation.md) | Onboarding par invitation | Accepted |
| [ADR-009](ADR-009-adapters-services-externes.md) | Adapters pour les services externes | Accepted |
| [ADR-010](ADR-010-creance-de-charge-et-allocation.md) | Créance de charge distincte et allocation multi-créances | Accepted |
| [ADR-011](ADR-011-pwa-responsive-mobile-first.md) | PWA responsive mobile first | Accepted |
| [ADR-012](ADR-012-jobs-planifies.md) | Jobs planifiés via Cron de plateforme | Accepted |

Les ADR-001 à ADR-005 et ADR-007 à ADR-012 sont des **formalisations rétroactives** : les décisions étaient déjà appliquées dans la documentation avant la rédaction des ADR, le 2026-09-26. ADR-006 est la première ADR rédigée au moment même de la décision.

## Numéros réservés

Deux ADR sont prévues par la gouvernance mais ne peuvent pas être rédigées tant que la décision correspondante est ouverte. Leurs numéros sont réservés afin que la numérotation reste stable.

| ADR | Sujet | Décision bloquante |
|---|---|---|
| ADR-013 | Fournisseur de stockage objet | DEC-033, ouverte |
| ADR-014 | Fournisseur de paiement | DEC-034, ouverte |

## Règles

1. Un numéro d'ADR est **définitif**. Il n'est jamais réattribué, même si l'ADR est remplacée.
2. Une décision remplacée passe en `Superseded` et cite l'ADR qui la remplace. Son contenu n'est pas réécrit.
3. Une ADR se rédige **avant** l'implémentation de la décision qu'elle porte, sauf formalisation rétroactive explicitement signalée.
4. Toute ADR suit le template complet de `docs/04-technical/architecture-governance.md`, sections incluses même lorsqu'une section conclut à un impact nul.
5. Une correction de bug, un changement de texte, un ajustement CSS local ou un refactor sans changement de contrat ne donnent pas lieu à une ADR.
