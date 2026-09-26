# ADR-010 : Créance de charge distincte et allocation multi-créances

## Status

Accepted

## Date

2026-09-19

## Context

Un locataire doit à son bailleur deux choses de nature différente : un **loyer**, contractuel et périodique, et des **parts de charges communes**, dérivées de factures réelles réparties entre les logements.

L'attente métier est double et apparemment contradictoire :

```text
Le locataire voit un montant global à payer.
Le système conserve les composantes séparées.
```

Le schéma initialement esquissé rendait cette attente irréalisable : la table d'allocation ne référençait que les échéances de loyer, ce qui interdisait techniquement d'imputer un paiement à une charge.

Formalisation rétroactive le 2026-09-26.

## Decision

Une **part de charge est une créance payable**, distincte de la créance de loyer.

Le modèle comporte **deux types de créance**, partageant la même structure financière et le même cycle de statut :

```text
rent_installments    créance de loyer
charge_allocations   créance de charge
```

Chacune porte : `amount_due`, `amount_paid`, `balance`, `currency`, `due_date`, `status`.

### Allocation

Un paiement est relié aux créances qu'il règle par des **allocations**. Chaque allocation référence **exactement une** créance, par une contrainte d'exclusion mutuelle vérifiée par PostgreSQL :

```sql
CHECK (
  (rent_installment_id IS NOT NULL)::int
  + (charge_allocation_id IS NOT NULL)::int
  = 1
)
```

L'allocation **multi-créances fait partie du périmètre MVP** : un paiement unique peut régler du loyer et une ou plusieurs charges.

Ordre d'allocation automatique, déterministe :

```text
1. date d'échéance croissante
2. à date égale : loyer avant charge
3. à date et type égaux : date de création croissante
```

### Total dû

```text
Total dû = somme des soldes des créances ouvertes, loyers et charges confondus
```

Ce total est calculé **côté serveur**. Le frontend ne le recompose jamais.

### Paiement supérieur au montant dû

Refusé, avec le code `AMOUNT_EXCEEDS_OUTSTANDING`. Le MVP ne comporte ni crédit, ni avoir, ni trop-perçu.

## Alternatives

**Charge comme simple information affichée.** Écartée : le locataire verrait un montant sans pouvoir le régler, et le système ne saurait jamais si une charge a été payée.

**Fusionner la charge dans l'échéance de loyer.** Écartée : détruit la séparation des composantes exigée par le métier, rend la quittance incapable de ventiler, et empêche des dates d'échéance différentes.

**Créance générique unique avec un champ de type.** Écartée : l'attribut discriminant deviendrait un polymorphisme non contraint, alors que deux tables réelles permettent des clés étrangères vérifiées et des contraintes propres à chaque type.

**Accepter le paiement excédentaire et créer un crédit.** Écartée : introduit une entité financière non prévue au périmètre, et contredit l'invariant de solde jamais négatif. Classée Future Evolution.

## Reasons

1. C'est la seule structure qui satisfait simultanément le montant global et la séparation des composantes.
2. La double clé étrangère exclusive donne l'intégrité référentielle réelle qu'un polymorphisme ne donnerait pas.
3. L'ordre d'allocation déterministe rend la répartition reproductible, donc testable et explicable au locataire.
4. Le refus du paiement excédentaire évite d'introduire au MVP une mécanique de solde créditeur avec son propre cycle de vie.

## Consequences

Avantages : une quittance peut ventiler par composante ; un tableau de bord peut distinguer impayés de loyer et impayés de charges.

Compromis : toute requête de solde agrège **deux tables**. Les index doivent être symétriques, et l'oubli de l'une des deux est un défaut fonctionnel silencieux.

Compromis : la confirmation d'un paiement met à jour plusieurs créances de types différents dans une même transaction. Cette transaction est le point le plus sensible du produit.

## Security Impact

Un locataire ne doit jamais voir la part due par un autre logement. L'explication du calcul transmise au locataire contient la méthode et le nombre de logements, jamais les montants des autres.

Une allocation ne peut viser qu'une créance appartenant au locataire du paiement et au périmètre de l'appelant.

## Data Impact

`charge_allocations` porte les colonnes financières et son propre statut.

`lease_id` et `tenant_user_id` sont renseignés à la publication depuis le bail actif, et **figés** ensuite. Un logement vacant produit une créance sans locataire redevable.

Invariants vérifiés avant publication, puis jamais violés :

```text
somme des parts = montant total de la charge
solde >= 0
montant payé <= montant dû
```

`amount_paid` et `balance` sont dérivés et stockés. La source de vérité reste la somme des allocations confirmées, et un contrôle périodique doit pouvoir détecter une divergence.

## Operational Impact

La publication d'une charge est atomique et non rejouable : une seconde tentative retourne un conflit.

L'annulation d'une charge publiée annule ses créances sans les supprimer, et conserve les allocations déjà réalisées.

Le contrôle d'intégrité post-restauration doit vérifier les soldes des **deux** types de créance.

## Migration

Sans objet : décision initiale.

Introduction future des crédits : ajouter une entité dédiée. Aucune modification des deux tables de créances n'est requise.

## Related Documents

- `docs/03-domain/business-rules.md`
- `docs/04-technical/database.md`
- `docs/04-technical/api.md`
- `docs/00-decisions/decision-register.md` (DEC-005, DEC-022, DEC-023)

## Related ADRs

- ADR-003, ADR-004
