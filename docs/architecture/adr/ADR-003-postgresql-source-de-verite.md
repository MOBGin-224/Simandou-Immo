# ADR-003 : PostgreSQL comme source de vérité

## Status

Accepted

## Date

2026-09-19

## Context

Le cœur du produit est un modèle financier : créances de loyer, créances de charge, paiements, allocations, soldes. Ces données ont des invariants stricts qui ne tolèrent aucune approximation :

```text
solde d'une créance                >= 0
montant payé                       <= montant dû
somme des parts d'une charge       =  montant total de la charge
somme des allocations d'un paiement <= montant du paiement
```

Ces invariants doivent tenir même en cas de requêtes concurrentes, de double-clic ou de rejeu d'un webhook.

Formalisation rétroactive le 2026-09-26.

## Decision

**PostgreSQL est la source de vérité unique** du produit.

Conséquences directes :

1. Les invariants critiques sont exprimés comme **contraintes de base** (`CHECK`, `UNIQUE`, clés étrangères), pas seulement comme validations applicatives.
2. Toute opération multi-écritures s'exécute dans une **transaction**.
3. Aucun autre système ne détient une donnée métier de référence. Un cache est toujours reconstructible.
4. Les colonnes dérivées (`amount_paid`, `balance`) sont stockées pour la performance, mais restent recalculables depuis les allocations, et un contrôle d'intégrité périodique doit pouvoir détecter une divergence.

## Alternatives

**Base orientée documents (MongoDB et équivalents).** Écartée : l'absence de transactions multi-documents naturelles et de contraintes déclaratives déplacerait tous les invariants financiers dans le code applicatif.

**Validation uniquement applicative sur une base permissive.** Écartée : une validation applicative est contournable par un script de maintenance, une correction manuelle ou un bug de concurrence. Une contrainte de base ne l'est pas.

**Moteur SQL alternatif (MySQL, SQL Server).** Écartée sur la richesse du typage, les index partiels, les contraintes d'exclusion et la maturité de l'écosystème d'outillage.

## Reasons

1. Un produit qui manipule l'argent d'un tiers doit faire respecter ses invariants par le moteur de données, pas par la discipline des développeurs.
2. Les index partiels permettent d'indexer précisément les créances ouvertes, qui sont la requête la plus fréquente du produit.
3. Le typage `bigint` autorise la convention monétaire en entier sans aucun recours au flottant.

## Consequences

Avantages : les invariants sont garantis, y compris contre un accès qui contournerait l'application.

Compromis : une contrainte de base est plus coûteuse à faire évoluer qu'une règle applicative. C'est accepté, et c'est précisément pourquoi la migration initiale ne doit être écrite qu'après verrouillage des énumérations et du modèle financier.

Une migration déjà appliquée en production ne doit jamais être modifiée.

## Security Impact

Positif. L'isolation entre organisations repose sur des colonnes `organization_id` réelles et des clés étrangères vérifiées, non sur une convention de nommage.

L'autorisation reste implémentée dans le service applicatif, jamais dans des politiques RLS, afin de garder un point de décision unique et testable.

## Data Impact

C'est l'objet même de l'ADR. Conventions retenues : UUID, `snake_case`, horodatages explicites, montants en entier avec devise explicite, archivage par `archived_at` sans suppression physique.

## Operational Impact

La sauvegarde et la restauration de PostgreSQL deviennent la procédure de reprise la plus critique du produit. Une restauration doit être réellement testée, pas seulement documentée.

## Migration

Sans objet : décision initiale.

## Related Documents

- `docs/04-technical/database.md`
- `docs/03-domain/business-rules.md`
- `docs/07-operations/disaster-recovery.md`

## Related ADRs

- ADR-001, ADR-004, ADR-005, ADR-010
