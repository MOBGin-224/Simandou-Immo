# Database Schema & Migration Specification

## 1. Objet du document

Ce document **tient lieu de modèle de données du produit** (DEC-030). Aucun document « Data Model » séparé n'existe ni ne sera créé.

Il transforme le modèle conceptuel en spécification de base de données exploitable par l'équipe de développement et Claude Code.

> **Décisions structurantes appliquées dans ce document**
>
> | Décision | Effet |
> |---|---|
> | DEC-005 | Une part de charge est une **créance payable** distincte du loyer |
> | DEC-014 | Montants en **entier minor unit** + devise ISO explicite |
> | DEC-015 | Enum `receivable_status` partagé loyer / charge |
> | DEC-016 | `payment_status` sans `INITIATED` ni `REFUNDED` |
> | DEC-017 / DEC-018 | Cycles distincts pour incident et intervention |
> | DEC-019 | `apartment_status` = `VACANT` / `OCCUPIED` / `MAINTENANCE` |
> | DEC-020 | `archived_at` seul ; `deleted_at` banni ; pas de valeur `ARCHIVED` dans les enums |
> | DEC-021 | Enums PostgreSQL pour les statuts fermés, `text` + `CHECK` pour les listes extensibles |
> | DEC-022 | `payment_allocations` à double FK exclusive |
> | DEC-024 | Tables de liaison documentaire explicites, aucune relation polymorphe |
> | DEC-025 | Pas de tables `permissions` / `access_permissions` au MVP |

Il définit :

- les tables ;
- les colonnes principales ;
- les types de données ;
- les clés primaires ;
- les clés étrangères ;
- les relations ;
- les contraintes ;
- les index ;
- les statuts ;
- les règles d'intégrité ;
- les principes d'archivage ;
- les migrations ;
- les données de démonstration ;
- les règles spécifiques à PostgreSQL et Drizzle ORM.

Le schéma doit être conçu pour le MVP tout en évitant les choix qui rendraient les évolutions futures inutilement difficiles.

---

# 2. Principes de base de données

## DB-001 : PostgreSQL est la source de vérité

Toutes les données métier persistantes doivent être stockées dans PostgreSQL.

---

## DB-002 : Les relations métier doivent être représentées explicitement

Une relation importante du produit doit être représentée par une relation de base de données explicite.

Exemple :

```text
Immeuble
    ↓
Appartement
    ↓
Contrat
    ↓
Locataire
```

---

## DB-003 : Les données critiques ne doivent pas être dupliquées sans nécessité

Le système doit éviter de stocker plusieurs copies indépendantes de la même valeur.

Exemple :

Le montant contractuel appartient au contrat.

L'échéance conserve le montant applicable à sa propre période afin de préserver l'historique.

---

## DB-004 : Les données historiques doivent être conservées

Les opérations financières et les relations locatives importantes ne doivent pas être supprimées physiquement dans le fonctionnement normal.

---

## DB-005 : Toutes les dates doivent être explicites

Les dates de création, modification, début, fin et confirmation doivent être distinguées lorsqu'elles représentent des événements différents.

---

# 3. Convention de nommage

Les tables utilisent le **snake_case** au niveau PostgreSQL.

Exemples :

```text
organizations
users
properties
apartments
leases
rent_installments
payments
charges
charge_allocations
incidents
interventions
expenses
```

Les propriétés TypeScript peuvent utiliser le conventionnement retenu dans l'application.

Les identifiants doivent utiliser une convention uniforme.

---

# 4. Stratégie d'identifiants

Pour les entités métier, utiliser des identifiants uniques non prédictibles.

Une stratégie UUID peut être utilisée.

Exemple conceptuel :

```text
id UUID PRIMARY KEY
```

Les références visibles par l'utilisateur restent distinctes.

Exemple :

```text
ID technique
8b7e...

Référence paiement
PAY-2026-000482

Appartement
A04
```

---

# 5. Timestamps

Les tables métier principales doivent généralement posséder :

```text
created_at
updated_at
```

Lorsque pertinent :

```text
archived_at
activated_at
revoked_at
confirmed_at
published_at
terminated_at
```

`deleted_at` est **banni** du modèle du MVP (DEC-020) : l'archivage est porté exclusivement par `archived_at`.

Les timestamps seront stockés de manière compatible avec les fuseaux horaires.

---

# 6. Organisation

## Table : `organizations`

### Objectif

Représente l'espace de gestion principal.

### Colonnes

| Colonne | Type conceptuel | Contraintes |
|---|---|---|
| id | UUID | PK |
| name | varchar | NOT NULL |
| type | enum `organization_type` | NOT NULL |
| default_currency | char(3) | NOT NULL, `'GNF'` par défaut |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| archived_at | timestamptz | NULL |

### Types d'organisation MVP

```text
organization_type

INDIVIDUAL
COMPANY
```

### Archivage

Conformément à DEC-020, `organizations` n'a **pas** de colonne `status`.

L'archivage est porté uniquement par `archived_at`.

---

# 7. Utilisateurs

## Table : `users`

### Objectif

Représente l'identité numérique d'une personne.

### Colonnes principales

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| full_name | varchar | NOT NULL |
| phone | varchar | UNIQUE lorsque non nul |
| email | varchar | UNIQUE lorsque non nul |
| status | enum `user_status` | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| last_login_at | timestamptz | NULL |
| archived_at | timestamptz | NULL |

### Statuts

```text
user_status

PENDING_ACTIVATION
ACTIVE
SUSPENDED
```

`ARCHIVED` n'est pas une valeur de cet enum, l'archivage est porté par `archived_at` (DEC-020).

`REVOKED` n'est pas un statut d'utilisateur : la révocation concerne un **accès**, pas une personne. Voir `user_access.status`.

### Authentification

L'authentification est assurée par **Better Auth** avec son adaptateur Drizzle (DEC-032). Les tables correspondantes vivent dans notre PostgreSQL et sont versionnées par nos migrations.

```text
users          table métier, sert également de modèle utilisateur à Better Auth
accounts       identifiants de connexion, dont le hash du mot de passe
sessions       sessions actives, révocables individuellement
verifications  jetons de vérification et de réinitialisation
```

Règles :

1. `users.id` reste la **clé métier unique** référencée par toutes les autres tables. Aucun identifiant d'authentification parallèle n'est créé.
2. Aucun secret d'authentification ne figure dans `users` : les identifiants sont isolés dans `accounts`.
3. Les champs métier de `users` (`full_name`, `phone`, `status`, `archived_at`) sont déclarés comme champs additionnels du modèle utilisateur.
4. L'identification se fait par **téléphone et mot de passe**. L'OTP est reporté avec DEC-008.
5. Le code métier n'accède jamais à ces tables directement : il passe par le service interne d'authentification.

---

# 8. Rôles

Aucune table `roles` n'est créée au MVP.

Le rôle est porté par une colonne enum sur `user_access` :

```text
role

OWNER
MANAGER
TENANT
```

Une table de rôles ne deviendrait utile que si des rôles définissables par l'utilisateur apparaissaient, ce qui est hors périmètre MVP.

---

# 9. Accès

## Table : `user_access`

Cette table représente le rattachement d'un utilisateur à une organisation avec un rôle.

### Colonnes

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK users, NOT NULL |
| organization_id | UUID | FK organizations, NOT NULL |
| role | enum `role` | NOT NULL |
| status | enum `user_access_status` | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| revoked_at | timestamptz | NULL |

### Statuts

```text
user_access_status

ACTIVE
SUSPENDED
REVOKED
```

### Contraintes

```text
UNIQUE (user_id, organization_id, role)
```

Un même utilisateur peut détenir plusieurs rôles dans la même organisation.

Cela permet notamment à un propriétaire d'agir également comme gestionnaire sans créer de second compte (DEC-003).

**L'unicité couvre aussi une ligne révoquée.** Un gestionnaire réinvité réutilise donc sa ligne : elle repasse à `ACTIVE` et son `revoked_at` est effacé (DEC-043). Aucun second compte, ni seconde ligne. Le rattachement n'est créé qu'à l'**acceptation** d'une invitation, `user_access_status` n'ayant pas d'état « en attente » (DEC-041).

---

# 10. Périmètre d'accès des gestionnaires

## Table : `manager_property_access`

Permet d'indiquer à quels immeubles un gestionnaire peut accéder.

### Colonnes

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| user_access_id | UUID | FK user_access, NOT NULL |
| property_id | UUID | FK properties, NOT NULL |
| access_level | enum `access_level` | NOT NULL |
| created_at | timestamptz | NOT NULL |
| revoked_at | timestamptz | NULL |

### access_level

```text
access_level

MANAGE      seule valeur du MVP
```

La valeur unique est conservée afin de ne pas bloquer une granularité future (DEC-025), sans introduire de logique conditionnelle au MVP.

### Contraintes

```text
UNIQUE (user_access_id, property_id)
```

### Règle

Le périmètre est une **liste explicite** d'immeubles (DEC-042). Les immeubles créés plus tard ne s'y ajoutent jamais d'eux-mêmes. Un gestionnaire actif a toujours au moins un immeuble.

**L'unicité couvre aussi les lignes révoquées.** Attribuer de nouveau un immeuble retiré auparavant réactive donc sa ligne en effaçant `revoked_at`, au lieu d'en insérer une seconde.

Un gestionnaire peut avoir accès à plusieurs immeubles.

Un immeuble peut avoir plusieurs gestionnaires.

---

# 11. Permissions

> **DEC-025 : périmètre MVP.**
>
> Les tables `permissions` et `access_permissions` **ne sont pas créées au MVP**.

Le catalogue des permissions est défini **en code** sous forme de constante, au format `resource.action` :

```text
property.create
property.read
property.update
property.archive

apartment.create
apartment.read
apartment.update
apartment.archive

manager.invite
manager.read
manager.update
manager.revoke

tenant.create
tenant.read
tenant.update
tenant.invite
tenant.revoke

lease.create
lease.read
lease.update
lease.terminate

rent.read
rent.generate

payment.create
payment.read
payment.cancel

receipt.read

charge.create
charge.read
charge.publish

incident.create
incident.read
incident.update

intervention.create
intervention.update

expense.create
expense.read
expense.update

document.upload
document.read

report.read
activity.read
audit.read
```

Chaque rôle est associé statiquement à un sous-ensemble de ce catalogue.

L'évaluation combine **rôle + périmètre** :

```text
can(user, permission, resource)
=
role possède permission
ET
resource appartient à l'organisation de l'utilisateur
ET
si MANAGER : resource rattachée à un property du scope
```

La délégation fine par gestionnaire est classée `FUT-FEAT-017`. Son ajout futur consistera à introduire les deux tables et une étape d'intersection supplémentaire, sans modifier la signature du service.

---

# 12. Liste de permissions et évolution

La liste ci-dessus est **exhaustive pour le MVP**.

Toute nouvelle permission doit :

1. correspondre à une capacité déjà présente dans le périmètre MVP ;
2. être ajoutée au catalogue en code ;
3. être couverte par un test d'autorisation positif et négatif.

Une permission ne crée jamais une fonctionnalité.

---

# 13. Immeubles

## Table : `properties`

### Colonnes

| Colonne | Type |
|---|---|
| id | UUID |
| organization_id | UUID FK organizations NOT NULL |
| name | varchar NOT NULL |
| address | text |
| city | varchar |
| district | varchar |
| description | text |
| created_at | timestamptz NOT NULL |
| updated_at | timestamptz NOT NULL |
| archived_at | timestamptz NULL |

### Archivage

Conformément à DEC-020, `properties` n'a **pas** de colonne `status`.

Un immeuble est actif tant que `archived_at IS NULL`.

### Relation

```text
organization 1 → N properties
```

---

# 14. Appartements

## Table : `apartments`

### Colonnes

| Colonne | Type |
|---|---|
| id | UUID |
| property_id | UUID FK properties NOT NULL |
| number | varchar NOT NULL |
| floor | integer |
| type | varchar |
| area | numeric |
| status | enum `apartment_status` NOT NULL, **GELÉE** depuis le Lot 8b |
| under_maintenance | boolean NOT NULL DEFAULT false |
| reference_rent_amount | bigint NULL |
| currency | char(3) NULL |
| created_at | timestamptz NOT NULL |
| updated_at | timestamptz NOT NULL |
| archived_at | timestamptz NULL |

### Occupation et maintenance, depuis le Lot 8b

**L'occupation d'un logement est DÉRIVÉE de son bail** (DEC-050). Elle n'est plus saisie, et ne se lit plus dans `apartments` :

```text
un bail ACTIVE sur ce logement   OCCUPIED
aucun bail ACTIVE                VACANT
```

Deux colonnes en découlent.

`under_maintenance` est **la seule saisie qui reste**, et elle est INDÉPENDANTE de l'occupation : un logement peut être en travaux qu'il soit loué ou vide, et DEC-050 point 2 le dit explicitement. Les fondre dans une valeur unique ferait disparaître « occupé » dès que des travaux sont déclarés, c'est-à-dire cacherait le bail qui court.

`status` est **gelée** : plus rien ne la lit ni ne l'écrit. Elle est conservée, et non supprimée, parce que DEC-050 point 3 demande de préserver l'historique sans réécrire les statuts déjà saisis. Sa suppression est une opération irréversible, qui attend l'accord du fondateur.

L'énumération reste donc en base, inchangée :

```text
apartment_status   GELEE

VACANT
OCCUPIED
MAINTENANCE
```

`AVAILABLE` n'est pas utilisé : le terme officiel est « Vacant ».

`RESERVED` est hors périmètre MVP.

`ARCHIVED` n'est pas une valeur de cet enum : l'archivage est porté par `archived_at` (DEC-020). **Archiver ne clôture aucun bail** : un logement archivé qui porte encore un bail en cours reste donc annoncé occupé, parce que c'est la vérité, et que la masquer cacherait une situation qui demande une décision.

### Compteurs d'un immeuble

```text
apartment_count    logements non archives
occupied_count     ceux qui portent un bail en cours
vacant_count       apartment_count - occupied_count
maintenance_count  ceux dont under_maintenance est vrai
```

Les deux premiers se répartissent exactement le parc. **`maintenance_count` CHEVAUCHE les deux autres** et n'entre pas dans cette somme : un écran qui l'additionnerait annoncerait plus de logements qu'il n'en existe.

### Contraintes

Le numéro d'appartement doit être unique dans un immeuble.

```text
UNIQUE (property_id, number)
```

`reference_rent_amount` et `currency` sont soit tous deux nuls, soit tous deux renseignés :

```text
CHECK (
  (reference_rent_amount IS NULL) = (currency IS NULL)
)
```

---

# 15. Locataires

Il ne doit pas y avoir une table `tenants` qui duplique intégralement `users`.

Le locataire repose sur :

```text
users
+
relation locative
```

## Table `tenant_profiles` : NON CRÉÉE AU MVP

> **DEC-046.** La table `tenant_profiles` **n'est pas créée au MVP**. Elle ne porterait que `id` et `user_id`, et `leases.tenant_user_id` référence `users`, pas elle. La distinction entre la personne et le rôle, seule raison d'être de cette table, est déjà portée par `user_access.role`.

Le locataire est donc, au MVP :

```text
users         l'IDENTITE METIER du locataire (DEC-051), profil preliminaire
              en PENDING_ACTIVATION pour qui n'a pas encore de compte (BR-008)
user_access   le DROIT D'ACCES au produit, role TENANT, cree a l'acceptation
              d'une invitation. Facultatif : un locataire peut ne pas en avoir
invitations   le contexte locatif PREVU : property_id et apartment_id
leases        la relation locative REELLE (BR-020), celle qui porte le logement
```

L'identifiant de la ressource locataire est **`users.id`**, celui de la PERSONNE (DEC-051).

> **Ce que DEC-051 a changé, et pourquoi.** L'identifiant était `user_access.id` au Lot 7, où un locataire était une personne invitée à l'espace locataire. Au Lot 8, une personne peut être locataire **sans aucun accès** : celle qui n'utilisera jamais l'application. Un identifiant d'accès l'aurait rendue impossible à désigner, et l'aurait fait disparaître de la liste des locataires. L'identité métier est donc la personne, et `user_access` reste un droit d'accès.

La ressource locataire est le couple **personne et organisation** : `users` ne porte pas d'organisation, à dessein, une personne pouvant être locataire chez deux bailleurs. L'organisation se résout dans le périmètre de l'appelant, et n'est jamais devinée.

Une personne est locataire d'une organisation dès que l'une de ces trois traces existe :

```text
invitations   une invitation locataire, ouverte ou acceptee
user_access   un acces de role TENANT, de tout statut
leases        une relation locative, en cours ou terminee
```

Aucune des trois n'est obligatoire pour les deux autres. C'est ce qui permet les deux situations que DEC-051 veut représenter : une personne invitée qui n'a pas encore de bail, et une personne qui occupe un logement sans avoir jamais eu de compte.

La distinction reste donc propre entre :

**Personne**

et :

**Rôle locataire**

Une table dédiée pourra être ajoutée lorsqu'un attribut propre au rôle locataire existera réellement. Au MVP, il n'en existe aucun.

---
# 16. Contrats

## Table : `leases`

### Colonnes

| Colonne | Type |
|---|---|
| id | UUID |
| organization_id | UUID FK organizations NOT NULL |
| property_id | UUID FK properties NOT NULL |
| apartment_id | UUID FK apartments NOT NULL |
| tenant_user_id | UUID FK users NOT NULL |
| start_date | date NOT NULL |
| end_date | date NULL |
| rent_amount | bigint NOT NULL |
| currency | char(3) NOT NULL |
| due_day | smallint NOT NULL |
| deposit_amount | bigint NOT NULL DEFAULT 0 |
| status | enum `lease_status` NOT NULL |
| termination_reason | varchar(200) NULL |
| created_at | timestamptz NOT NULL |
| updated_at | timestamptz NOT NULL |
| terminated_at | timestamptz NULL |

`termination_reason` a été AJOUTÉE au Lot 8 : l'API documente une raison de clôture (section 17) et BR-033 demande de la conserver. Texte libre et non énumération, la documentation n'en donnant qu'un exemple, « move_out » : inventer la liste des autres serait décider d'un vocabulaire métier. La convention du projet pour une liste destinée à s'étendre est d'ailleurs le texte sous contrainte, comme `charge_type` ou `incident_category`.

### Statuts

```text
lease_status

DRAFT
ACTIVE
ENDED
CANCELLED
```

> **`DRAFT` et `CANCELLED` ne sont pas atteints au MVP.** L'énumération a été figée d'emblée pour les lots suivants (DEC-021), comme toutes les autres. Mais aucun document ne donne de comportement de brouillon à un bail, contrairement à la charge dont l'API décrit explicitement le `DRAFT`, et les routes documentées sont la création, la consultation, la modification et la clôture. **Un bail naît donc ACTIF**, et c'est le cas d'usage qui l'écrit, le défaut de la colonne restant `DRAFT` pour le jour où un brouillon aura un sens.

### Notes

`organization_id` et `property_id` sont dénormalisés depuis `apartments` afin de permettre les vérifications d'isolation et de périmètre **sans jointure**, conformément à l'exigence de contrôle d'accès systématique.

Ils doivent rester cohérents avec l'appartement référencé.

La colonne `document_id` est **supprimée** : les documents contractuels sont rattachés via la table de liaison `lease_documents` (DEC-024).

### Contraintes

```text
CHECK (rent_amount >= 0)
CHECK (deposit_amount >= 0)
CHECK (due_day BETWEEN 1 AND 31)
CHECK (end_date IS NULL OR end_date >= start_date)
```

---

# 17. Contraintes sur les contrats

Le schéma ou la logique métier doit empêcher deux contrats actifs incompatibles pour le même appartement sur la même période.

PostgreSQL peut utiliser une stratégie d'exclusion ou cette vérification peut être faite dans une transaction métier.

La règle doit être garantie côté backend.

> **Ce que le Lot 8 a retenu.** Deux **index d'unicité partiels**, et non une contrainte d'exclusion : au MVP, un logement n'a jamais plus d'un bail en cours, donc la question du chevauchement de périodes ne se pose pas, et un index partiel est plus simple à lire comme à expliquer.
>
> ```text
> leases_one_active_per_apartment                 (apartment_id) WHERE status = 'ACTIVE'
> leases_one_active_per_tenant_and_organization   (organization_id, tenant_user_id) WHERE status = 'ACTIVE'
> ```
>
> Le premier porte BR-028, le second DEC-049. Les deux sont doublés d'un pré-contrôle par lecture dans le cas d'usage, qui existe pour une seule raison : donner un message qui ORIENTE, là où la contrainte ne dirait que « violation d'unicité ». C'est l'index qui arbitre, jamais le pré-contrôle, deux créations simultanées passant chacune celui-ci.
>
> Les baux `ENDED` et `CANCELLED` sont hors de ces index : un logement compte autant de baux terminés qu'il a eu d'occupants successifs (BR-027), et c'est de là que son historique se reconstruit (section 18).

---

# 18. Historique locatif

L'historique peut être reconstruit à partir des contrats.

Il n'est pas nécessaire de dupliquer systématiquement cette information dans une table séparée.

Une table `occupancy_history` peut être ajoutée uniquement si des besoins de performance ou de reporting le justifient.

---

# 19. Créances

Le MVP comporte **deux types de créance** (DEC-005) :

```text
rent_installments     créance de loyer
charge_allocations    créance de charge
```

Les deux partagent :

- la même structure financière : `amount_due`, `amount_paid`, `balance`, `currency` ;
- le même enum de statut `receivable_status` (DEC-015) ;
- le même mécanisme d'allocation (DEC-022).

## Table : `rent_installments`

Créance de loyer pour une période précise.

### Colonnes

| Colonne | Type |
|---|---|
| id | UUID |
| organization_id | UUID FK organizations NOT NULL |
| lease_id | UUID FK leases NOT NULL |
| property_id | UUID FK properties NOT NULL |
| apartment_id | UUID FK apartments NOT NULL |
| tenant_user_id | UUID FK users NOT NULL |
| period_start | date NOT NULL |
| due_date | date NOT NULL |
| amount_due | bigint NOT NULL |
| amount_paid | bigint NOT NULL DEFAULT 0 |
| balance | bigint NOT NULL |
| currency | char(3) NOT NULL |
| status | enum `receivable_status` NOT NULL |
| created_at | timestamptz NOT NULL |
| updated_at | timestamptz NOT NULL |

`period_start` remplace `period` : une date normalisée au premier jour de la période, jamais une chaîne libre.

### Statuts

```text
receivable_status

UNPAID
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

« À venir » n'est pas stocké : c'est un affichage dérivé lorsque `status = UNPAID` et `due_date > current_date`.

---

# 20. Unicité des créances

Pour un contrat donné et une période donnée, il ne doit exister qu'une seule créance de loyer.

```text
UNIQUE (lease_id, period_start)
```

Pour une charge donnée et un appartement donné, il ne doit exister qu'une seule créance de charge.

```text
UNIQUE (charge_id, apartment_id)
```

Ces contraintes garantissent l'idempotence de la génération mensuelle et de la publication des charges.

---

# 21. Calcul du solde

`amount_paid` et `balance` sont **dérivés** et stockés pour la performance.

La **source de vérité** reste la somme des allocations rattachées à des paiements confirmés.

```text
amount_paid = somme(payment_allocations.amount)
              sur les paiements en statut CONFIRMED

balance     = amount_due - amount_paid
```

Invariants vérifiés en transaction :

```text
balance >= 0
amount_paid >= 0
amount_paid <= amount_due
```

Ces deux colonnes ne doivent jamais être modifiées en dehors de la transaction qui crée, annule ou corrige une allocation.

Un contrôle d'intégrité périodique doit pouvoir recalculer `amount_paid` et `balance` depuis les allocations et détecter toute divergence.

---

# 22. Allocations de paiement

Le paiement est distinct de son affectation à une créance.

Conformément à DEC-022, une allocation référence **exactement une** créance, de l'un des deux types.

## Table : `payment_allocations`

### Colonnes

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| payment_id | UUID | FK payments, NOT NULL |
| rent_installment_id | UUID | FK rent_installments, NULL |
| charge_allocation_id | UUID | FK charge_allocations, NULL |
| amount | bigint | NOT NULL, `CHECK (amount > 0)` |
| currency | char(3) | NOT NULL |
| created_at | timestamptz | NOT NULL |

### Contrainte d'exclusion mutuelle

```sql
CHECK (
  (rent_installment_id IS NOT NULL)::int
  + (charge_allocation_id IS NOT NULL)::int
  = 1
)
```

Aucune relation polymorphe non contrainte n'est utilisée : les deux clés étrangères sont réelles et vérifiées par PostgreSQL.

### Unicité

Un paiement ne doit pas être alloué deux fois à la même créance :

```sql
CREATE UNIQUE INDEX ON payment_allocations (payment_id, rent_installment_id)
  WHERE rent_installment_id IS NOT NULL;

CREATE UNIQUE INDEX ON payment_allocations (payment_id, charge_allocation_id)
  WHERE charge_allocation_id IS NOT NULL;
```

### Ordre d'allocation automatique

Lorsque le locataire règle un montant global, l'allocation suit un ordre **déterministe** :

```text
1. due_date croissante
2. à date égale : loyer avant charge
3. à date et type égaux : created_at croissante
```

### Invariants

```text
somme(allocations d'un paiement) <= payment.amount
allocation.amount <= receivable.balance au moment de l'allocation
allocation.currency = receivable.currency = payment.currency
```

Un paiement dont le montant dépasse le total dû restant est **refusé** avec `AMOUNT_EXCEEDS_OUTSTANDING` (DEC-023).

---

# 23. Paiements

## Table : `payments`

### Colonnes

| Colonne | Type |
|---|---|
| id | UUID |
| organization_id | UUID FK organizations NOT NULL |
| tenant_user_id | UUID FK users NOT NULL |
| property_id | UUID FK properties NOT NULL |
| apartment_id | UUID FK apartments NOT NULL |
| amount | bigint NOT NULL `CHECK (amount > 0)` |
| currency | char(3) NOT NULL |
| method | enum `payment_method` NOT NULL |
| provider | varchar NULL |
| provider_transaction_id | varchar NULL |
| reference | varchar NULL |
| status | enum `payment_status` NOT NULL |
| paid_at | date NOT NULL |
| confirmed_at | timestamptz NULL |
| cancelled_at | timestamptz NULL |
| created_by | UUID FK users NULL |
| created_at | timestamptz NOT NULL |
| updated_at | timestamptz NOT NULL |

### Statuts

Voir DEC-016 :

```text
payment_status

PENDING
CONFIRMED
FAILED
CANCELLED
```

`INITIATED` n'existe pas. `REFUNDED` est hors MVP.

### Méthodes

```text
payment_method

CASH
BANK_TRANSFER
MOBILE_MONEY
OTHER
```

### Notes

`initiated_at` est remplacé par `created_at`, qui porte déjà cette information.

`paid_at` est la **date métier** du paiement, distincte de `created_at` qui est l'horodatage technique d'enregistrement. Pour un paiement en espèces enregistré avec retard, les deux diffèrent.

Le paiement ne porte **pas** de période : la période appartient aux créances auxquelles il est alloué.

---

# 24. Référence fournisseur

`provider_transaction_id` doit être indexé lorsqu'il est utilisé.

Pour un fournisseur donné, cette référence doit être unique.

Exemple conceptuel :

```text
UNIQUE(provider, provider_transaction_id)
```

Cela protège contre les doubles confirmations.

---

# 25. Paiements manuels

Pour les paiements manuels :

```text
provider                = NULL
provider_transaction_id = NULL
method                  = CASH | BANK_TRANSFER | MOBILE_MONEY | OTHER
created_by              = utilisateur ayant enregistré l'opération
status                  = CONFIRMED
confirmed_at            = horodatage de l'enregistrement
```

Le système doit conserver clairement l'origine de l'opération.

Règle d'intégrité :

```sql
CHECK (
  (provider IS NULL AND provider_transaction_id IS NULL)
  OR
  (provider IS NOT NULL AND provider_transaction_id IS NOT NULL)
)
```

Un paiement manuel est `CONFIRMED` dès sa création : c'est le gestionnaire qui atteste de la réception. Un paiement digital ne peut jamais être confirmé de cette manière (DEC-009).

---

# 26. Idempotency Keys

## Table : `idempotency_keys`

Utile pour les opérations sensibles.

### Colonnes

```text
id
key
user_id
operation
request_hash
response_payload
status_code
created_at
expires_at
```

Les clés doivent être uniques dans le contexte approprié.

---

# 27. Quittances

## Table : `receipts`

### Colonnes

```text
id
payment_id
receipt_number
document_id
issued_at
created_at
```

La quittance référence le paiement source.

---

# 28. Charges

## Table : `charges`

### Colonnes

| Colonne | Type |
|---|---|
| id | UUID |
| organization_id | UUID FK organizations NOT NULL |
| property_id | UUID FK properties NOT NULL |
| type | text NOT NULL + `CHECK` |
| period_start | date NOT NULL |
| due_date | date NOT NULL |
| total_amount | bigint NOT NULL `CHECK (total_amount > 0)` |
| currency | char(3) NOT NULL |
| allocation_method | enum `allocation_method` NOT NULL |
| status | enum `charge_status` NOT NULL |
| supplier_name | varchar NULL |
| published_at | timestamptz NULL |
| cancelled_at | timestamptz NULL |
| created_by | UUID FK users NOT NULL |
| created_at | timestamptz NOT NULL |
| updated_at | timestamptz NOT NULL |

### Statuts

```text
charge_status

DRAFT
PUBLISHED
CANCELLED
```

`due_date` est portée par la charge et recopiée sur chaque créance produite à la publication.

La colonne `document_id` est **supprimée** : le justificatif est rattaché via `charge_documents` (DEC-024).

---

# 29. Types de charges

Liste extensible sans changement de logique, implémentée en `text` + `CHECK` (DEC-021) :

```text
WATER
ELECTRICITY
SECURITY
CLEANING
OTHER
```

Méthodes de répartition, enum `allocation_method` (DEC-029) :

```text
EQUAL          MVP
CUSTOM         hors MVP
CONSUMPTION    hors MVP
```

Le MVP n'accepte que `EQUAL`.

---

# 30. Créances de charge

> **DEC-005, décision verrouillée.**
>
> Une part de charge est une **créance payable**, au même titre qu'une échéance de loyer.

## Table : `charge_allocations`

Cette table porte la part individuelle **et son cycle de règlement**.

### Colonnes

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK organizations, NOT NULL |
| charge_id | UUID | FK charges, NOT NULL |
| property_id | UUID | FK properties, NOT NULL |
| apartment_id | UUID | FK apartments, NOT NULL |
| lease_id | UUID | FK leases, NULL |
| tenant_user_id | UUID | FK users, NULL |
| period_start | date | NOT NULL |
| due_date | date | NOT NULL |
| amount_due | bigint | NOT NULL, `CHECK (amount_due >= 0)` |
| amount_paid | bigint | NOT NULL DEFAULT 0 |
| balance | bigint | NOT NULL, `CHECK (balance >= 0)` |
| currency | char(3) | NOT NULL |
| status | enum `receivable_status` | NOT NULL |
| calculation_basis | jsonb | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

### Contraintes

```text
UNIQUE (charge_id, apartment_id)
```

### Statut

Même enum que les échéances de loyer : `receivable_status` (DEC-015).

### lease_id et tenant_user_id

Renseignés à la publication à partir du bail actif de l'appartement à cette date.

Ils restent **nuls** si l'appartement est vacant au moment de la publication : la créance existe alors au niveau du logement sans locataire redevable, et n'apparaît dans aucun espace locataire.

Ces colonnes ne sont jamais recalculées après publication : elles figent la situation locative au moment de la répartition.

### Cohérence avec la charge

```text
somme(charge_allocations.amount_due) = charges.total_amount
```

Cet invariant est vérifié **avant** la publication et ne doit jamais être violé ensuite.

---

# 31. Justification du calcul

`calculation_basis` conserve, en JSONB, la manière dont la part a été déterminée.

Format normalisé du MVP :

```json
{
  "method": "EQUAL",
  "totalAmount": 3600000,
  "unitCount": 12,
  "baseShare": 300000,
  "roundingAdjustment": 0
}
```

`roundingAdjustment` vaut `0` ou `1` selon que le logement a reçu ou non une unité du reste de la division entière.

Ce champ est **explicatif**, jamais une source de calcul : il permet au gestionnaire et au locataire de comprendre le montant affiché.

Les formats `CUSTOM` et `CONSUMPTION` seront normalisés lorsque ces méthodes entreront dans le périmètre.

---

# 32. Publication d'une charge

La publication est une **transaction atomique** :

```text
BEGIN

1. Vérifier que la charge est en statut DRAFT
2. Vérifier l'accès au périmètre
3. Calculer les parts selon allocation_method
4. Vérifier : somme(parts) = total_amount
5. Créer une charge_allocation par appartement concerné
     status     = UNPAID
     amount_due = part calculée
     amount_paid= 0
     balance    = amount_due
6. Passer la charge en PUBLISHED, renseigner published_at
7. Créer les notifications destinées aux locataires concernés
8. Journaliser l'activité et l'audit

COMMIT
```

Une charge déjà publiée ne peut pas être republiée : une seconde tentative doit être rejetée avec `CONFLICT`.

L'annulation d'une charge publiée annule ses créances (`status = CANCELLED`) sans les supprimer, et conserve les allocations de paiement déjà réalisées pour analyse.

---

# 33. Incidents

## Table : `incidents`

### Colonnes

```text
id                     UUID PK
organization_id        UUID FK organizations NOT NULL
property_id            UUID FK properties    NOT NULL
apartment_id           UUID FK apartments    NULL
lease_id               UUID FK leases        NULL
reported_by            UUID FK users         NOT NULL
category               text NOT NULL + CHECK
priority               enum incident_priority NOT NULL
title                  varchar NOT NULL
description            text
status                 enum incident_status  NOT NULL
assigned_at            timestamptz NULL
resolved_at            timestamptz NULL
closed_at              timestamptz NULL
created_at             timestamptz NOT NULL
updated_at             timestamptz NOT NULL
```

### Statuts

Voir DEC-017 :

```text
incident_status

OPEN
ASSIGNED
IN_PROGRESS
ON_HOLD
RESOLVED
CLOSED
```

Transitions autorisées :

```text
OPEN        -> ASSIGNED | IN_PROGRESS | CLOSED
ASSIGNED    -> IN_PROGRESS | ON_HOLD | CLOSED
IN_PROGRESS -> ON_HOLD | RESOLVED | CLOSED
ON_HOLD     -> IN_PROGRESS | CLOSED
RESOLVED    -> CLOSED | IN_PROGRESS
CLOSED      -> terminal
```

Toute autre transition doit être rejetée par le backend.

### Priorités

```text
incident_priority

LOW
NORMAL
URGENT
```

### Catégories

Liste extensible, `text` + `CHECK` (DEC-021) :

```text
PLUMBING
ELECTRICITY
AIR_CONDITIONING
LOCKSMITH
BUILDING
SECURITY
OTHER
```

### Note

`lease_id` fige la relation locative au moment du signalement, afin que l'historique reste attribuable après un changement de locataire.

---

# 34. Interventions

## Table : `interventions`

### Colonnes

```text
id                     UUID PK
organization_id        UUID FK organizations NOT NULL
incident_id            UUID FK incidents     NOT NULL
provider_id            UUID FK providers     NULL
provider_name          varchar NULL
scheduled_at           timestamptz NULL
started_at             timestamptz NULL
completed_at           timestamptz NULL
cancelled_at           timestamptz NULL
estimated_cost         bigint NULL
actual_cost            bigint NULL
currency               char(3) NULL
status                 enum intervention_status NOT NULL
notes                  text
created_by             UUID FK users NOT NULL
created_at             timestamptz NOT NULL
updated_at             timestamptz NOT NULL
```

### Statuts

Cycle **distinct** de celui de l'incident, voir DEC-018 :

```text
intervention_status

PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

La clôture d'une intervention ne clôture pas automatiquement l'incident.

Un incident peut porter plusieurs interventions.

### Contraintes

```text
CHECK (estimated_cost IS NULL OR estimated_cost >= 0)
CHECK (actual_cost   IS NULL OR actual_cost   >= 0)
CHECK ((actual_cost IS NULL) = (currency IS NULL) OR estimated_cost IS NOT NULL)
```

`provider_name` permet d'enregistrer un intervenant non référencé dans `providers`, cas fréquent sur le terrain.

---

# 35. Prestataires

## Table : `providers`

### Colonnes

```text
id
organization_id
name
phone
company
specialty
created_at
updated_at
```

Le modèle reste volontairement léger dans le MVP.

---

# 36. Dépenses

## Table : `expenses`

### Colonnes

```text
id                     UUID PK
organization_id        UUID FK organizations NOT NULL
property_id            UUID FK properties    NOT NULL
apartment_id           UUID FK apartments    NULL
incident_id            UUID FK incidents     NULL
intervention_id        UUID FK interventions NULL
provider_id            UUID FK providers     NULL
category               text NOT NULL + CHECK
amount                 bigint NOT NULL CHECK (amount >= 0)
currency               char(3) NOT NULL
expense_date           date NOT NULL
description            text
status                 enum expense_status NOT NULL
created_by             UUID FK users NOT NULL
created_at             timestamptz NOT NULL
updated_at             timestamptz NOT NULL
```

### Statuts

```text
expense_status

RECORDED
CANCELLED
```

### Catégories

Liste extensible, `text` + `CHECK` (DEC-021) :

```text
PLUMBING
ELECTRICITY
SECURITY
CLEANING
MAINTENANCE
REPAIR
SUPPLIES
OTHER
```

La colonne `document_id` est **supprimée** : les justificatifs sont rattachés via `expense_documents` (DEC-024).

### Distinction Charge / Expense

Une **dépense** est une sortie financière supportée par l'immeuble.

Une **charge** est un montant réparti entre les logements et refacturé aux locataires.

Les deux ne doivent jamais être confondues. Une charge peut avoir une dépense source, mais ce sont deux objets distincts.

---

# 37. Documents

## Table : `documents`

### Colonnes

```text
id
organization_id
storage_provider
storage_key
file_name
mime_type
file_size
uploaded_by
created_at
```

La base contient les métadonnées.

Le fichier réel est stocké dans le stockage objet.

---

# 38. Rattachement des documents

> **DEC-024, décision appliquée.**
>
> Aucune relation polymorphe `entity_type` / `entity_id` n'est utilisée.

Deux mécanismes, et deux seulement :

| Cas | Implémentation |
|---|---|
| Document unique généré par le système | Clé étrangère directe |
| Pièces jointes multiples ajoutées par un utilisateur | Table de liaison explicite |

## Clé étrangère directe

```text
receipts.document_id    quittance générée, relation 1-1
```

## Tables de liaison

```text
lease_documents
charge_documents
expense_documents
incident_documents
intervention_documents
```

Structure commune :

```text
id            UUID        PK
document_id   UUID        FK documents NOT NULL
<entity>_id   UUID        FK <entity>  NOT NULL
created_at    timestamptz NOT NULL

UNIQUE (document_id, <entity>_id)
```

Les colonnes `document_id` précédemment envisagées sur `leases`, `charges` et `expenses` sont **supprimées**.

## Conséquence

Un même document peut être rattaché à plusieurs entités du même type sans duplication du fichier.

La suppression d'une liaison ne supprime jamais le document sous-jacent : la gestion du cycle de vie des fichiers relève d'une opération de maintenance distincte.

---

# 39. Invitations

## Table : `invitations`

Une table commune gère les invitations de gestionnaires et de locataires.

### Colonnes

```text
id
organization_id
invited_by
target_user_id nullable      toujours renseigné : l'invité existe avant d'accepter (DEC-041)
role                         MANAGER ou TENANT, jamais OWNER
property_id nullable         réservé au locataire (Lot 7), nul pour un gestionnaire
apartment_id nullable        réservé au locataire (Lot 7)
contact                      le téléphone, ou l'email, auquel l'invitation est destinée
token_hash                   SHA-256 du jeton, en hexadécimal, unique
status
expires_at
issued_at                    émission du lien en vigueur, renouvelée à chaque renvoi
accepted_at
revoked_at
created_at
updated_at
```

Le jeton n'est **jamais** stocké en clair (SEC-INV-002) : il ne se réaffiche donc pas, et un lien perdu se renvoie. Renvoyer régénère le jeton dans la **même ligne** : même identifiant, ancien lien invalidé aussitôt, `issued_at` et `expires_at` renouvelés.

### Contraintes

```text
UNIQUE (token_hash)
UNIQUE PARTIEL (organization_id, target_user_id, role) WHERE status IN ('PENDING', 'SENT')
CHECK role <> 'OWNER'
CHECK expires_at > issued_at
CHECK (status = 'ACCEPTED') = (accepted_at IS NOT NULL)
CHECK (status = 'REVOKED') = (revoked_at IS NOT NULL)
```

L'index partiel garantit **une seule invitation ouverte** par personne, organisation et rôle.

## Table : `invitation_properties`

Immeubles du périmètre qu'une invitation de gestionnaire attribuera à l'acceptation (DEC-041). Un gestionnaire peut être invité sur plusieurs immeubles à la fois, ce que le seul `property_id` de `invitations` ne permet pas.

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| invitation_id | UUID | FK invitations, NOT NULL |
| property_id | UUID | FK properties, NOT NULL |
| created_at | timestamptz | NOT NULL |

```text
UNIQUE (invitation_id, property_id)
```

Au moins un immeuble, tous de l'organisation de l'invitation, aucun archivé. Ces règles sont portées par le cas d'usage : une contrainte de base ne peut pas comparer deux tables.

**Le périmètre est recopié à l'acceptation** dans `manager_property_access`. Les lignes d'`invitation_properties` ne sont jamais modifiées ensuite : elles documentent ce qui a été accordé.

---

# 40. Statuts des invitations

```text
pending
sent
accepted
expired
revoked
```

Une invitation acceptée ne doit pas être réutilisable.

Deux statuts ne se comportent pas comme leur nom l'annonce (DEC-041) :

```text
sent       jamais atteint au MVP : aucun envoi automatique n'existe (DEC-026).
           Il sera posé par l'adapter d'envoi, sans modifier le modèle.
expired    DÉRIVÉ à la lecture : une invitation ouverte dont expires_at est passé.
           Aucune tâche planifiée ne l'écrit. La valeur n'est stockée que lorsqu'une
           opération clôture elle-même une invitation périmée.
```

**Une invitation est ouverte** tant que son statut est `pending` ou `sent` ET que `expires_at` est dans le futur.

---

# 41. Notifications

## Table : `notifications`

### Colonnes

```text
id                     UUID PK
organization_id        UUID FK organizations NOT NULL
user_id                UUID FK users         NOT NULL
type                   text NOT NULL
title                  varchar NOT NULL
body                   text
channel                enum notification_channel NOT NULL
status                 enum notification_status  NOT NULL
read_at                timestamptz NULL
sent_at                timestamptz NULL
related_entity_type    text NULL
related_entity_id      UUID NULL
created_at             timestamptz NOT NULL
```

### Canaux

Voir DEC-027 :

```text
notification_channel

IN_APP      seul canal actif au MVP
SMS         défini, inactif
WHATSAPP    défini, inactif
EMAIL       défini, inactif
```

### Statuts de délivrance

```text
notification_status

PENDING
SENT
FAILED
```

L'état « lu » n'est pas un statut : il est porté par `read_at`.

### related_entity_type / related_entity_id

**Exception unique et strictement délimitée** à la règle anti-polymorphisme.

Justification : une notification est un **objet de navigation**, pas une donnée métier. Elle ne porte aucune intégrité référentielle, et son lien peut pointer vers une ressource ultérieurement archivée.

Conséquences obligatoires :

- ces colonnes ne portent **aucune clé étrangère** ;
- le frontend doit gérer le cas où la ressource cible n'existe plus ou n'est plus accessible ;
- aucune règle métier ne doit dépendre de ce lien ;
- la notification n'est jamais la source de vérité d'un statut métier.

### Portée de l'exception

Cette exception **ne remet pas en cause** la règle générale.

| Domaine | Règle |
|---|---|
| Documents | Tables de liaison explicites, **jamais** de polymorphisme (DEC-024) |
| Données métier | Clés étrangères réelles et contraintes |
| Allocations de paiement | Double FK exclusive avec `CHECK` (DEC-022) |
| **Notifications** | Seul cas où un lien souple est autorisé |

Aucune autre table ne doit introduire de couple `entity_type` / `entity_id`. Toute nouvelle demande en ce sens doit être refusée et traitée par une table de liaison explicite.

---

# 42. Préférences de notification

## Table : `notification_preferences`

### Colonnes conceptuelles

```text
id
user_id
event_type
channel
enabled
created_at
updated_at
```

Les préférences peuvent être complétées progressivement.

---

# 43. Journal d'activité

## Table : `activity_logs`

### Colonnes

```text
id
organization_id
user_id
action
entity_type
entity_id
metadata
created_at
```

`metadata` peut utiliser JSONB pour conserver les détails spécifiques de l'événement.

---

# 44. Audit log sensible

Pour les opérations critiques, un journal d'audit peut être distinct de l'activité utilisateur.

## Table : `audit_logs`

### Colonnes

```text
id
organization_id
actor_user_id
action
entity_type
entity_id
before_data
after_data
ip_address
user_agent
created_at
```

Les champs `before_data` et `after_data` peuvent être stockés en JSONB si nécessaire.

---

# 45. JSONB

JSONB peut être utilisé lorsque les données sont :

- variables ;
- événementielles ;
- secondaires ;
- difficiles à normaliser sans sur-complexifier le modèle.

Il ne faut cependant pas utiliser JSONB pour contourner systématiquement une bonne modélisation relationnelle.

Les données financières centrales restent relationnelles.

---

# 46. Enums et listes de référence

> **DEC-021, décision appliquée.**

| Nature de la liste | Implémentation |
|---|---|
| Statut fermé et stable, contrôlé par le domaine | Enum PostgreSQL natif (`pgEnum` Drizzle) |
| Liste métier destinée à s'étendre sans changement de logique | `text` + contrainte `CHECK` |
| Liste éditable par les utilisateurs | Table de référence : **aucune au MVP** |

## Enums PostgreSQL du MVP

```text
organization_type     INDIVIDUAL | COMPANY
user_status           PENDING_ACTIVATION | ACTIVE | SUSPENDED
user_access_status    ACTIVE | SUSPENDED | REVOKED
role                  OWNER | MANAGER | TENANT
access_level          MANAGE
apartment_status      VACANT | OCCUPIED | MAINTENANCE   GELEE, voir section 14
lease_status          DRAFT | ACTIVE | ENDED | CANCELLED
receivable_status     UNPAID | PARTIALLY_PAID | PAID | OVERDUE | CANCELLED
payment_status        PENDING | CONFIRMED | FAILED | CANCELLED
payment_method        CASH | BANK_TRANSFER | MOBILE_MONEY | OTHER
charge_status         DRAFT | PUBLISHED | CANCELLED
allocation_method     EQUAL
incident_status       OPEN | ASSIGNED | IN_PROGRESS | ON_HOLD | RESOLVED | CLOSED
incident_priority     LOW | NORMAL | URGENT
intervention_status   PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
invitation_status     PENDING | SENT | ACCEPTED | EXPIRED | REVOKED
expense_status        RECORDED | CANCELLED
notification_channel  IN_APP | SMS | WHATSAPP | EMAIL
notification_status   PENDING | SENT | FAILED
```

## Listes en `text` + `CHECK`

```text
charge_type           WATER | ELECTRICITY | SECURITY | CLEANING | OTHER
incident_category     PLUMBING | ELECTRICITY | AIR_CONDITIONING |
                      LOCKSMITH | BUILDING | SECURITY | OTHER
expense_category      PLUMBING | ELECTRICITY | SECURITY | CLEANING |
                      MAINTENANCE | REPAIR | SUPPLIES | OTHER
```

## Règles

1. Toutes les valeurs sont en **MAJUSCULES**, en anglais.
2. Une valeur d'enum est **identique** dans la base, le domaine, l'API, le frontend et les tests.
3. `rent_status` n'existe pas : les créances de loyer utilisent `receivable_status`.
4. `property_status` n'existe pas : l'archivage est porté par `archived_at` (DEC-020).
5. Aucun enum ne contient `ARCHIVED`.
6. `allocation_method` ne contient que `EQUAL` au MVP ; `CUSTOM` et `CONSUMPTION` seront ajoutés lorsque ces méthodes entreront dans le périmètre.

---

# 47. Contraintes d'intégrité

La base doit utiliser des contraintes lorsque cela garantit directement une règle structurelle.

Exemples :

```text
amount >= 0
deposit_amount >= 0
due_day between 1 and 31
```

Les règles métier plus complexes restent dans les services métier.

---

# 48. Foreign Keys

Toutes les relations importantes doivent avoir des clés étrangères.

Exemple :

```text
apartments.property_id
→ properties.id
```

Le comportement lors de la suppression doit être explicitement choisi.

Pour les données historiques critiques, éviter les cascades destructives.

---

# 49. Delete behavior

Les relations financières et historiques ne doivent pas utiliser naïvement :

```text
ON DELETE CASCADE
```

lorsque cela pourrait effacer des données historiques.

Préférer selon le cas :

```text
RESTRICT
SET NULL
ARCHIVE
```

La suppression doit être choisie relation par relation.

---

# 50. Archivage et suppression

> **DEC-020, décision appliquée.**

1. L'archivage est porté **exclusivement** par `archived_at timestamptz NULL`.
2. `deleted_at` est **banni** du modèle du MVP.
3. **Aucun enum de statut ne contient `ARCHIVED`.**
4. Les entités dont le seul état était actif/archivé n'ont **pas** de colonne `status` :
   - `organizations`
   - `properties`
5. Les entités dont le statut est orthogonal à l'archivage conservent les deux :
   - `apartments` : occupation DERIVEE du bail + `under_maintenance` + `archived_at`
   - `users` : `user_status` + `archived_at`
6. Aucun `DELETE` physique sur une entité métier dans le fonctionnement normal.

## Requête standard

Une entité archivable est considérée active lorsque :

```sql
archived_at IS NULL
```

Ce filtre doit être appliqué par défaut dans les listes, et explicitement levé lorsque l'utilisateur consulte l'historique.

## Vocabulaire

Chaque verbe a une signification distincte et ne doit jamais être utilisé comme synonyme d'un autre :

```text
Archive      rendre inactif en conservant l'historique
Deactivate   suspendre temporairement une capacité
Revoke       retirer explicitement un accès
Suspend      bloquer temporairement un accès
End          terminer une relation métier arrivée à son terme
Cancel       annuler une opération
Delete       suppression physique, exceptionnelle et encadrée
```

---

# 51. Index principaux

Des index doivent être prévus sur les colonnes utilisées régulièrement pour :

- filtrer ;
- rechercher ;
- joindre ;
- vérifier des permissions.

Exemples :

```text
properties.organization_id
apartments.property_id
leases.apartment_id
leases.tenant_user_id
leases.organization_id
rent_installments.lease_id
rent_installments.due_date
rent_installments.organization_id
charges.property_id
charge_allocations.charge_id
charge_allocations.apartment_id
charge_allocations.due_date
charge_allocations.organization_id
payments.tenant_user_id
payments.provider_transaction_id
payment_allocations.payment_id
payment_allocations.rent_installment_id
payment_allocations.charge_allocation_id
incidents.property_id
interventions.incident_id
expenses.property_id
notifications.user_id
activity_logs.organization_id
manager_property_access.property_id
```

Les deux types de créance doivent être indexés **symétriquement** : toute requête de solde ou de retard porte sur les deux (DEC-005).

---

# 52. Index composés

Des index composés seront nécessaires pour certains accès fréquents.

```text
apartments            (property_id, status)
leases                (apartment_id, status)
rent_installments     (lease_id, period_start)
rent_installments     (tenant_user_id, status)
rent_installments     (organization_id, due_date)
charge_allocations    (charge_id, apartment_id)
charge_allocations    (tenant_user_id, status)
charge_allocations    (organization_id, due_date)
payments              (tenant_user_id, status)
payment_allocations   (rent_installment_id)
payment_allocations   (charge_allocation_id)
charges               (property_id, period_start)
incidents             (property_id, status)
incidents             (apartment_id, status)
expenses              (property_id, expense_date)
notifications         (user_id, read_at)
manager_property_access (user_access_id, property_id)
```

## Index dédiés au calcul du montant dû

Le total dû d'un locataire agrège **deux tables**. Les deux doivent être indexées de manière symétrique :

```sql
CREATE INDEX ON rent_installments  (tenant_user_id, status)
  WHERE status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE');

CREATE INDEX ON charge_allocations (tenant_user_id, status)
  WHERE status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE');
```

Les index définitifs devront être validés à partir des requêtes réelles.

---

# 53. Unicité

Contraintes d'unicité du MVP :

```text
apartments            UNIQUE (property_id, number)
user_access           UNIQUE (user_id, organization_id, role)
manager_property_access  UNIQUE (user_access_id, property_id)
rent_installments     UNIQUE (lease_id, period_start)
charge_allocations    UNIQUE (charge_id, apartment_id)
payments              UNIQUE (provider, provider_transaction_id)
                      lorsque le fournisseur est renseigné
documents de liaison  UNIQUE (document_id, <entity>_id)
```

Les deux contraintes sur les créances garantissent l'idempotence : la génération mensuelle des loyers et la publication d'une charge peuvent être rejouées sans créer de doublon.

Les deux index uniques partiels de `payment_allocations` empêchent qu'un paiement soit alloué deux fois à la même créance.

---

# 54. Représentation des montants

> **DEC-014, décision appliquée.**

Tout montant monétaire est stocké comme un **entier signé** exprimé dans la **plus petite unité de la devise** (*minor unit*), accompagné d'un **code devise ISO 4217 explicite**.

```text
amount    bigint     NOT NULL
currency  char(3)    NOT NULL
```

Pour le **GNF**, l'exposant de sous-unité est **0** : la valeur stockée est le montant en francs guinéens.

```text
2 500 000 GNF  ->  amount = 2500000, currency = 'GNF'
```

## Règles

1. `bigint` obligatoire, jamais `numeric` ni `real` ni `double precision` pour un montant.
2. Aucun calcul financier en virgule flottante.
3. Aucune addition implicite entre devises différentes.
4. Toute colonne monétaire est accompagnée de sa colonne `currency`, ou hérite explicitement de celle de son entité parente.
5. Le formatage d'affichage relève exclusivement du frontend.

## Évolution multidevise

La table des exposants par devise est portée par le code applicatif, pas par la base, tant qu'une seule devise est utilisée.

Puisque chaque montant porte déjà sa devise, l'ajout d'une devise à décimales ne nécessitera aucune migration des colonnes existantes.

---

# 55. Dates de période

Pour les loyers mensuels, utiliser une représentation cohérente.

Une option est :

```text
period_start = 2026-09-01
```

plutôt qu'une chaîne libre :

```text
"Septembre 2026"
```

Le format affiché à l'utilisateur est une responsabilité du frontend.

---

# 56. Contrat et historique financier

Lorsqu'un loyer change, les échéances déjà créées doivent conserver leur montant applicable au moment de leur génération.

Ainsi :

```text
Contrat
2 500 000
↓
Septembre
2 500 000
↓
Contrat modifié
2 800 000
↓
Octobre
2 800 000
```

L'historique n'est pas recalculé rétroactivement.

---

# 57. Génération des échéances

Un job doit pouvoir être exécuté plusieurs fois sans créer de doublons.

La contrainte :

```text
UNIQUE (lease_id, period_start)
```

constitue une deuxième protection.

Le code doit utiliser un mécanisme de type :

```text
insert if not exists
```

ou :

```text
upsert
```

selon le cas.

---

# 58. Migration initiale

La migration initiale doit créer :

1. les extensions et **tous les enums** ;
2. organisations ;
3. utilisateurs ;
4. tables d'authentification Better Auth (`accounts`, `sessions`, `verifications`) ;
5. accès utilisateur ;
6. immeubles ;
7. périmètre d'accès des gestionnaires ;
8. appartements ;
9. profils locataires ;
10. contrats ;
11. créances de loyer ;
12. charges ;
13. créances de charge ;
14. paiements ;
15. allocations de paiement ;
16. quittances ;
17. prestataires ;
18. incidents ;
19. interventions ;
20. dépenses ;
21. documents ;
22. tables de liaison documentaire ;
23. invitations ;
24. notifications ;
25. préférences de notification ;
26. clés d'idempotence ;
27. journaux d'activité ;
28. journaux d'audit.

Cette liste suit exactement la séquence de la section 59. L'ordre des dépendances est contraignant.

**Note d'exécution** : la migration initiale n'est pas créée pendant la phase de consolidation documentaire. Elle constitue la première tâche du Lot 1.

---

# 59. Ordre logique des migrations

Séquence de référence :

```text id="r6gqmd"
enums
→ organizations
→ users
→ accounts / sessions / verifications   tables Better Auth (DEC-032)
→ user_access
→ properties
→ manager_property_access
→ apartments
→ invitations                invitation_properties avec elle (DEC-041)
→ leases
→ rent_installments          créance de loyer
→ charges
→ charge_allocations         créance de charge
→ payments
→ payment_allocations        double FK exclusive
→ receipts
→ providers
→ incidents
→ interventions
→ expenses
→ documents
→ document link tables       lease / charge / expense / incident / intervention
→ invitations
→ notifications
→ notification_preferences
→ idempotency_keys
→ activity_logs
→ audit_logs
```

Les **numéros définitifs** seront choisis pendant l'implémentation. L'**ordre des dépendances** est contraignant.

## Dépendances contraignantes

1. Tous les **enums** sont créés en premier, avant toute table qui les utilise.
2. `charge_allocations` doit exister **avant** `payment_allocations`, qui porte une clé étrangère vers elle.
3. `rent_installments` doit exister **avant** `payment_allocations`, pour la même raison.
4. `manager_property_access` doit exister **après** `properties` et `user_access`.
5. Les **tables de liaison documentaire** doivent exister après `documents` et après les entités qu'elles rattachent.
6. Les **tables d'authentification** (`accounts`, `sessions`, `verifications`) doivent exister après `users`, dont elles dépendent, et avant le lot Authentification.

## Point d'attention : receipts et documents

`receipts.document_id` référence `documents`, qui arrive plus tard dans la séquence.

Résolution retenue : `receipts.document_id` est **nullable**, et sa contrainte de clé étrangère est créée **dans la migration `documents`**.

Justification : une quittance existe dès la confirmation du paiement ; le fichier PDF est produit ensuite. La colonne reflète donc une réalité métier, pas seulement une contrainte d'ordonnancement.

Aucune autre table ne présente ce cas.

## Tables explicitement absentes du MVP

```text
roles                  le rôle est un enum sur user_access
permissions            DEC-025, catalogue défini en code
access_permissions     DEC-025, FUT-FEAT-017
occupancy_history      reconstruit depuis leases
```

---

# 60. Migration strategy

Chaque évolution de schéma doit être une migration versionnée.

Exemple :

```text
0001_initial_schema
0002_add_manager_scope
0003_add_payment_provider_reference
```

Une migration ne doit pas être modifiée après avoir été appliquée en production.

---

# 61. Migration non destructive

Lorsque cela est possible :

### Mauvais

Supprimer directement une colonne utilisée.

### Préférable

1. ajouter la nouvelle colonne ;
2. migrer les données ;
3. modifier le code ;
4. vérifier ;
5. supprimer l'ancienne colonne dans une migration ultérieure.

Cette approche réduit les risques pendant les déploiements.

---

# 62. Seed data

Le projet doit disposer d'un environnement de démonstration.

Le seed doit pouvoir créer :

```text
Organisation A
  1 propriétaire
  2 gestionnaires (périmètres différents)
  2 immeubles
  24 appartements
  plusieurs locataires
  contrats
  créances de loyer
  créances de charge
  paiements (complets, partiels, en retard)
  charges publiées
  incidents
  interventions
  dépenses

Organisation B
  1 propriétaire
  1 immeuble
  quelques appartements et locataires
```

**La seconde organisation est obligatoire** : sans elle, les tests d'isolation multi-tenant ne peuvent pas être écrits.

Le seed doit couvrir explicitement les cas financiers suivants, car ce sont ceux que les tests doivent vérifier :

```text
Créance de loyer seule, impayée
Créance de loyer + créance de charge sur le même locataire
Paiement partiel réparti sur les deux créances
Créance en retard (due_date dépassée)
Appartement vacant avec créance de charge sans locataire redevable
```

---

# 63. Données de seed réalistes

Les données de développement doivent ressembler aux usages réels.

Exemple :

```text
Résidence Camayenne
12 appartements

10 occupés
1 vacant
1 maintenance

Loyers :
27 500 000 GNF encaissés
2 500 000 GNF restant
```

Cela permettra à Claude Code et au designer de travailler avec des interfaces réalistes.

---

# 64. Seed et sécurité

Les comptes de démonstration ne doivent jamais partager de credentials de production.

Les mots de passe de seed doivent être générés pour l'environnement local uniquement.

---

# 65. Test database

Les tests doivent utiliser une base isolée.

Les migrations doivent pouvoir être appliquées automatiquement dans l'environnement de test.

---

# 66. Transactions

Toute opération modifiant plusieurs tables de manière atomique doit utiliser une transaction.

Exemples :

### Création d'un locataire

```text
profil
+
relation locative
+
contrat éventuel
+
journal
```

### Paiement confirmé

```text
payment
+
allocation
+
rent status
+
receipt
+
activity
```

---

# 67. Concurrence

Les opérations susceptibles d'être exécutées simultanément doivent être protégées contre les conflits.

Les solutions possibles comprennent :

- transactions ;
- contraintes uniques ;
- verrouillage ;
- contrôle optimiste.

Le choix dépend du cas.

---

# 68. Reporting

Les tableaux de bord ne doivent pas obligatoirement disposer de tables de reporting dès le MVP.

Commencer par des requêtes SQL et agrégations correctement indexées.

Introduire des vues matérialisées seulement si les performances l'exigent.

---

# 69. Auditabilité

Toutes les données financières majeures doivent pouvoir répondre à :

> Qui a créé cette donnée ?

> Quand ?

> Qu'est-ce qui a changé ?

> Quelle opération l'a provoqué ?

---

# 70. Rétention

Une politique de conservation des données devra être définie séparément.

Elle devra couvrir :

- utilisateurs ;
- paiements ;
- contrats ;
- documents ;
- journaux ;
- notifications.

La suppression définitive devra respecter les besoins légaux et opérationnels applicables.

---

# 71. Backup et restauration

PostgreSQL devra disposer de :

- backup automatique ;
- snapshots selon le fournisseur ;
- restauration testée.

La restauration ne doit pas être considérée comme fiable simplement parce que les backups existent.

Des tests de restauration devront être prévus.

---

# 72. Migration et Claude Code

Claude Code ne doit pas modifier directement la base de production.

Le workflow recommandé est :

```text
Modification du schéma
↓
Migration
↓
Test local
↓
Test CI
↓
Staging
↓
Validation
↓
Production
```

---

# 73. Règle de travail avec Drizzle

Les schémas Drizzle doivent être la représentation de référence côté code.

Les migrations doivent être générées et contrôlées à partir de ces schémas selon le workflow retenu.

Une migration appliquée ne doit pas être éditée arbitrairement après coup.

---

# 74. Critères de validation du schéma

Le schéma est considéré comme prêt lorsque :

1. toutes les entités du MVP sont représentées ;
2. toutes les relations principales sont explicites ;
3. les contraintes critiques existent ;
4. les index principaux sont définis ;
5. les opérations historiques ne sont pas destructives ;
6. les paiements sont idempotents ;
7. les échéances ne peuvent pas être dupliquées ;
8. les organisations sont isolées ;
9. les permissions peuvent être évaluées ;
10. les migrations peuvent être exécutées automatiquement ;
11. le seed permet de lancer un environnement réaliste ;
12. les tests peuvent travailler avec une base isolée.

---

# 75. Résumé du schéma

Le noyau du MVP peut être représenté ainsi :

```text id="6esj93"
ORGANIZATION
│
├── USERS
│   └── USER ACCESS  (rôle)
│         └── MANAGER PROPERTY ACCESS  (périmètre)
│
├── PROPERTIES
│   └── APARTMENTS
│       ├── LEASES
│       │   └── RENT INSTALLMENTS ....... créance de loyer
│       │
│       ├── CHARGES
│       │   └── CHARGE ALLOCATIONS ...... créance de charge
│       │
│       ├── INCIDENTS
│       │   └── INTERVENTIONS
│       │
│       └── EXPENSES
│
├── PAYMENTS
│   └── PAYMENT ALLOCATIONS
│         ├──> RENT INSTALLMENT      (exclusif)
│         └──> CHARGE ALLOCATION     (exclusif)
│
├── RECEIPTS ──> PAYMENT
│
├── DOCUMENTS
│   └── tables de liaison par entité
│
├── INVITATIONS
├── NOTIFICATIONS
├── ACTIVITY LOGS
└── AUDIT LOGS
```

Point central du modèle financier : **les paiements ne sont pas rattachés aux appartements par une hiérarchie**, mais aux **créances** par des allocations. C'est ce qui permet à un paiement unique de régler à la fois du loyer et des charges (DEC-005, DEC-022).

Cette structure constitue une base solide pour le développement du MVP.

Elle garde les responsabilités séparées, protège les historiques, permet une gestion multi-immeubles et donne à l'architecture suffisamment de marge pour évoluer sans introduire de complexité inutile.