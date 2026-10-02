# API & Backend Specification

## 1. Objet du document

Ce document définit les interfaces backend du SaaS de gestion d'immeubles.

Il précise :

- les opérations disponibles ;
- les routes API ;
- les méthodes HTTP ;
- les données entrantes ;
- les validations ;
- les permissions ;
- les réponses ;
- les erreurs ;
- les transitions d'état ;
- les webhooks ;
- les règles d'idempotence ;
- les exigences de sécurité.

Ce document constitue un contrat fonctionnel entre le frontend, le backend et les services externes.

Il doit permettre à Claude Code d'implémenter les fonctionnalités sans avoir à déduire les règles métier à partir des interfaces.

---

# 2. Principes API

## API-001 : Toutes les mutations sont autorisées côté serveur

Le frontend ne décide jamais seul qu'une opération est autorisée.

Chaque mutation doit effectuer :

```text
Authentification
↓
Organisation
↓
Rôle
↓
Périmètre
↓
Permission
↓
Validation
↓
Règle métier
↓
Persistence
```

---

## API-002 : Les réponses doivent être prévisibles

Les routes similaires doivent utiliser une structure de réponse cohérente.

---

## API-003 : Les erreurs doivent être structurées

Une erreur doit permettre au frontend de comprendre :

- ce qui a échoué ;
- pourquoi ;
- comment éventuellement récupérer.

---

## API-004 : Les opérations financières doivent être idempotentes

Une même opération reçue deux fois ne doit pas produire deux effets.

---

## API-005 : Les données sensibles restent côté serveur

Les secrets, clés privées, tokens fournisseurs et décisions d'autorisation ne doivent jamais être confiés au frontend.

---

# 3. Architecture API

Le MVP peut utiliser plusieurs mécanismes selon le contexte :

### Server Actions

Pour les mutations internes au produit lorsqu'elles simplifient l'implémentation.

### Route Handlers / API

Pour :

- webhooks ;
- intégrations externes ;
- opérations nécessitant une API explicite ;
- appels futurs d'autres clients.

### Services internes

La logique métier doit être centralisée dans des services applicatifs et domaine.

---

# 4. Structure des routes

Préfixe conceptuel :

```text
/api/v1/
```

Exemples :

```text
/api/v1/properties
/api/v1/apartments
/api/v1/tenants
/api/v1/leases
/api/v1/rents
/api/v1/payments
/api/v1/charges
/api/v1/incidents
/api/v1/interventions
/api/v1/expenses
/api/v1/notifications
```

La convention exacte pourra être ajustée à l'architecture Next.js retenue.

---

# 5. Format de réponse standard

Les réponses réussies doivent suivre une structure cohérente.

Exemple :

```json
{
  "data": {
    "id": "..."
  },
  "meta": {}
}
```

Une collection :

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

---

# 6. Format d'erreur standard

Structure conceptuelle :

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données fournies sont invalides.",
    "details": {}
  }
}
```

Le frontend doit pouvoir traiter le `code` de manière déterministe.

---

# 7. Codes d'erreur principaux

Le système peut utiliser notamment :

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INVALID_STATE
DUPLICATE_OPERATION
AMOUNT_EXCEEDS_OUTSTANDING
PAYMENT_FAILED
PAYMENT_PENDING
EXTERNAL_SERVICE_ERROR
RATE_LIMITED
INTERNAL_ERROR
```

`AMOUNT_EXCEEDS_OUTSTANDING` est retourné lorsqu'un paiement dépasse le total dû restant du locataire (DEC-023).

`INVALID_STATE` est retourné lors d'une transition de statut non autorisée (DEC-017, DEC-018).

---

# 8. Authentification

Les endpoints protégés nécessitent une session valide.

Une requête authentifiée doit permettre au backend d'identifier :

- utilisateur ;
- organisation ;
- rôles ;
- permissions ;
- périmètre.

---

# 9. Route : profil courant

```text
GET /api/v1/me
```

## Objectif

Récupérer le contexte utilisateur.

## Réponse conceptuelle

```json
{
  "data": {
    "user": {},
    "roles": [],
    "organizations": [],
    "permissions": []
  }
}
```

---

# 10. Route : organisations

## Créer

```text
POST /api/v1/organizations
```

### Permission

Propriétaire ou rôle autorisé.

### Input

```json
{
  "name": "Patrimoine Mamadou"
}
```

### Output

Organisation créée.

---

## Lire

```text
GET /api/v1/organizations/:id
```

Accès réservé aux utilisateurs autorisés.

---

# 11. Route : immeubles

## Créer

```text
POST /api/v1/properties
```

### Input minimal

```json
{
  "name": "Résidence Camayenne",
  "address": "Camayenne",
  "city": "Conakry"
}
```

### Validation

- nom requis ;
- organisation accessible ;
- adresse valide selon les règles définies.

---

## Lister

```text
GET /api/v1/properties
```

Le résultat dépend du périmètre de l'utilisateur.

Un gestionnaire ne reçoit que les immeubles auxquels il a accès.

---

## Consulter

```text
GET /api/v1/properties/:id
```

---

## Modifier

```text
PATCH /api/v1/properties/:id
```

---

## Archiver

```text
POST /api/v1/properties/:id/archive
```

Une suppression physique n'est pas utilisée comme opération courante.

---

# 12. Route : appartements

## Créer

```text
POST /api/v1/properties/:propertyId/apartments
```

### Input

```json
{
  "number": "A04",
  "floor": 2,
  "type": "F3"
}
```

---

## Création groupée

```text
POST /api/v1/properties/:propertyId/apartments/bulk
```

Exemple :

```json
{
  "apartments": [
    {"number": "A01"},
    {"number": "A02"},
    {"number": "A03"},
    {"number": "A04"}
  ]
}
```

Cette fonction est importante pour l'onboarding d'un immeuble.

---

## Lister

```text
GET /api/v1/properties/:propertyId/apartments
```

Paramètres possibles :

```text
status
search
page
pageSize
```

---

## Consulter

```text
GET /api/v1/apartments/:id
```

---

## Modifier

```text
PATCH /api/v1/apartments/:id
```

---

# 13. Route : gestionnaires

## Inviter

```text
POST /api/v1/manager-invitations
```

### Input

```json
{
  "name": "Mamadou Diallo",
  "phone": "+224...",
  "email": "optional@example.com",
  "propertyIds": ["property_1", "property_2"]
}
```

> **DEC-025** : le champ `permissions[]` est **retiré du MVP**.
>
> Les droits d'un gestionnaire résultent de son rôle `MANAGER` et de son périmètre `propertyIds`.
>
> La délégation fine est classée `FUT-FEAT-017`.

Règles de validation (DEC-041, DEC-042) :

- `propertyIds` : **au moins un** immeuble, tous de l'organisation de l'appelant, aucun archivé. Un immeuble inexistant et un immeuble d'une autre organisation reçoivent le même refus.
- `phone` : format international, par exemple `+224620000000`. Les espaces, points et tirets sont retirés avant contrôle.
- Un numéro déjà connu **ne crée pas de second compte** (BR-009).
- Refus `409` si la personne est déjà propriétaire ou gestionnaire actif ou suspendu de l'organisation, ou si une invitation encore valable existe déjà pour elle.
- Un gestionnaire **révoqué** peut être réinvité (DEC-043).

### Sortie

L'invitation créée, accompagnée du **lien de partage** que l'inviteur devra copier et transmettre lui-même (DEC-026).

```json
{
  "data": {
    "invitation": { "id": "…", "status": "PENDING", "expiresAt": "…" },
    "link": "https://…/invitation/<jeton>"
  }
}
```

**Le lien n'est renvoyé qu'une seule fois.** Le jeton n'est stocké que haché : il ne peut pas être réaffiché, et un lien perdu se renvoie.

Aucun envoi automatique par SMS, WhatsApp ou email n'a lieu au MVP.

Durée de validité : 7 jours par défaut, réglable par `INVITATION_TTL_DAYS` (DEC-045).

---

## Renvoyer

```text
POST /api/v1/manager-invitations/:id/resend
```

Régénère le jeton dans la **même invitation** : l'ancien lien devient invalide aussitôt, et la durée de validité repart de zéro. Même sortie que l'invitation, avec le nouveau lien.

Refusé (`409`) si l'invitation est déjà acceptée ou révoquée. Une invitation expirée se renvoie.

---

## Révoquer une invitation

```text
POST /api/v1/manager-invitations/:id/revoke
```

Annule une invitation qui n'a pas été acceptée. Le lien devient inutilisable. Refusé (`409`) si l'invitation est déjà acceptée ou déjà révoquée.

---

## Lister

```text
GET /api/v1/managers
```

Réunit les gestionnaires et les invitations en attente. Chaque élément porte un type :

```text
kind    ACCESS        un gestionnaire (identifiant : user_access.id)
        INVITATION    une invitation en attente ou expirée (identifiant : invitation.id)
status  ACTIVE, SUSPENDED, REVOKED, INVITED, INVITATION_EXPIRED
```

Les invitations acceptées ne s'y répètent pas : leur gestionnaire les remplace. Les invitations révoquées n'y figurent pas.

---

## Consulter

```text
GET /api/v1/managers/:id
```

`:id` est un `user_access.id`. Un identifiant inconnu et un identifiant d'une autre organisation reçoivent la même réponse, `404`.

---

## Suspendre, réactiver (DEC-044)

```text
POST /api/v1/managers/:id/suspend
POST /api/v1/managers/:id/reactivate
```

Permission `manager.update`. Suspendre bloque l'accès aussitôt en **conservant le périmètre** : réactiver restitue exactement l'accès. Seul un accès `SUSPENDED` se réactive, et un accès `REVOKED` ne se réactive jamais (réinvitation, DEC-043).

---

## Révoquer un accès

```text
POST /api/v1/managers/:id/revoke
```

Effet :

- accès bloqué **immédiatement** : le contexte d'accès est relu en base à chaque requête ;
- périmètre révoqué avec lui ;
- historique conservé : les actions passées restent attribuées à la personne ;
- ses sessions ne sont supprimées que si elle n'a plus aucun accès actif ailleurs.

Possible depuis `ACTIVE` et `SUSPENDED`.

---

## Modifier le périmètre

```text
PATCH /api/v1/managers/:id/access
```

```json
{ "propertyIds": ["property_1", "property_2"] }
```

Ne modifie **que la liste des immeubles** : les permissions découlent du rôle (DEC-025). La liste fournie remplace la précédente : les immeubles retirés sont révoqués, les nouveaux attribués. Au moins un immeuble (DEC-042). Permission `manager.update`.

Le backend doit vérifier que l'appelant possède lui-même les droits nécessaires.

---

# 14. Route : activation d'une invitation

## Consulter l'invitation

```text
GET /api/v1/invitations/:token
```

Route publique, utilisée par la page d'activation. Renvoie ce que le parcours 5 affiche : l'organisation, le nom de l'inviteur, les immeubles concernés, le rôle, et si l'invité doit définir un mot de passe ou se connecter.

**Toute invitation inutilisable reçoit la même réponse `404`** : inconnue, expirée, révoquée, déjà acceptée (ADR-008).

## Accepter

```text
POST /api/v1/invitations/:token/accept
```

```json
{ "password": "…" }
```

- Invité **sans compte actif** : le mot de passe est obligatoire (10 caractères au minimum). Le compte est activé et une session est ouverte.
- Invité **avec un compte déjà actif** : aucun mot de passe n'est lu ni modifié. L'appelant doit être connecté avec ce compte, sinon `401`. **Un lien d'invitation ne change jamais le mot de passe d'un compte actif.**

La page d'activation envoie un formulaire HTML : la route répond alors par une redirection, cookies de session compris. Un appel JSON reçoit l'enveloppe habituelle.

### Processus

1. Vérifier le token.
2. Vérifier l'expiration.
3. Vérifier le statut.
4. Vérifier le contexte.
5. Créer ou activer le compte.
6. Attribuer le rôle.
7. Attribuer le périmètre.
8. Invalider l'invitation.

**Ces étapes forment une seule transaction** (DEC-041). Le lien est d'abord réclamé par une mise à jour conditionnelle (invitation ouverte ET non expirée) : si deux acceptations arrivent ensemble, une seule réussit, et l'autre ne laisse aucun mot de passe.

**Un gestionnaire réinvité réutilise sa ligne d'accès** (DEC-043). Seul le périmètre de la nouvelle invitation est attribué : un immeuble absent de la liste reste révoqué. Un immeuble archivé entre-temps n'est pas attribué, et si plus aucun immeuble n'est attribuable l'invitation est refusée.

---

# 15. Routes : locataires

## Créer

```text
POST /api/v1/tenants
```

### Input

```json
{
  "name": "Mamadou Diallo",
  "phone": "+224...",
  "apartmentId": "apt_123",
  "moveInDate": "2026-09-01"
}
```

Le backend doit vérifier que le gestionnaire peut gérer l'appartement.

---

## Lister

```text
GET /api/v1/tenants
```

Paramètres :

```text
propertyId
apartmentId
status
search
page
pageSize
```

---

## Consulter

```text
GET /api/v1/tenants/:id
```

---

## Modifier

```text
PATCH /api/v1/tenants/:id
```

Les champs modifiables dépendent du rôle.

---

# 16. Route : invitation locataire

```text
POST /api/v1/tenant-invitations
```

### Input

```json
{
  "tenantId": "tenant_123",
  "channel": "whatsapp"
}
```

Le backend génère une invitation liée au contexte locatif.

---

## Renvoyer

```text
POST /api/v1/tenant-invitations/:id/resend
```

---

## Révoquer

```text
POST /api/v1/tenant-invitations/:id/revoke
```

---

# 17. Routes : contrats

## Créer

```text
POST /api/v1/leases
```

### Input

```json
{
  "apartmentId": "apt_123",
  "tenantId": "tenant_123",
  "startDate": "2026-09-01",
  "rentAmount": 2500000,
  "currency": "GNF",
  "dueDay": 5,
  "depositAmount": 5000000
}
```

---

## Consulter

```text
GET /api/v1/leases/:id
```

---

## Modifier

```text
PATCH /api/v1/leases/:id
```

Les modifications importantes doivent demander une date d'effet.

---

## Clôturer

```text
POST /api/v1/leases/:id/terminate
```

### Input

```json
{
  "terminationDate": "2026-09-30",
  "reason": "move_out"
}
```

Le backend doit empêcher la génération de nouvelles échéances après la date de fin.

---

# 18. Routes : créances

Le MVP comporte **deux types de créance** (DEC-005). Chacune a ses routes, et une route d'agrégation fournit le montant total dû.

## Lister les créances de loyer

```text
GET /api/v1/rents
```

Filtres :

```text
propertyId
apartmentId
tenantId
period
status
```

## Lister les créances de charge

```text
GET /api/v1/charge-allocations
```

Filtres :

```text
propertyId
apartmentId
tenantId
chargeId
period
status
```

## Montant total dû d'un locataire

```text
GET /api/v1/tenants/:id/outstanding
```

Pour le locataire connecté :

```text
GET /api/v1/me/outstanding
```

### Réponse

```json
{
  "data": {
    "currency": "GNF",
    "totalOutstanding": 2800000,
    "receivables": [
      {
        "kind": "RENT",
        "id": "rent_123",
        "label": "Loyer septembre 2026",
        "periodStart": "2026-09-01",
        "dueDate": "2026-09-05",
        "amountDue": 2500000,
        "amountPaid": 0,
        "balance": 2500000,
        "status": "UNPAID"
      },
      {
        "kind": "CHARGE",
        "id": "challoc_456",
        "label": "Eau septembre 2026",
        "periodStart": "2026-09-01",
        "dueDate": "2026-09-10",
        "amountDue": 300000,
        "amountPaid": 0,
        "balance": 300000,
        "status": "UNPAID"
      }
    ]
  }
}
```

`totalOutstanding` est calculé **côté serveur** à partir des soldes. Le frontend ne le recompose jamais.

Le champ `kind` prend les valeurs `RENT` ou `CHARGE` et identifie le type de créance dans les payloads d'allocation.

---

## Consulter

```text
GET /api/v1/rents/:id
```

---

## Génération manuelle

Une route administrative peut exister :

```text
POST /api/v1/rents/generate
```

Elle doit être idempotente.

Si l'échéance existe déjà, elle ne doit pas être recréée.

---

# 19. Génération automatique des échéances

La génération principale doit être déclenchée par un job.

```text
POST /internal/jobs/generate-rents
```

Cette route ne doit pas être publique.

Le job :

1. recherche les contrats actifs ;
2. détermine les échéances attendues ;
3. vérifie si elles existent ;
4. crée les absentes ;
5. journalise le résultat.

---

# 20. Routes : paiements

## Créer un paiement manuel

```text
POST /api/v1/payments/manual
```

### Input

```json
{
  "tenantId": "tenant_123",
  "amount": 1500000,
  "currency": "GNF",
  "method": "CASH",
  "paidAt": "2026-09-05",
  "reference": "REC-001",
  "allocations": [
    { "kind": "RENT",   "id": "rent_123",     "amount": 1500000 }
  ]
}
```

### Allocations

Le champ `allocations` est **optionnel**.

- **Absent** : le serveur alloue automatiquement selon l'ordre déterministe de DEC-022 (échéance croissante, loyer avant charge, création croissante).
- **Présent** : le serveur valide chaque allocation et rejette l'opération si un invariant est violé.

Exemple d'allocation explicite sur deux créances :

```json
"allocations": [
  { "kind": "RENT",   "id": "rent_123",   "amount": 1200000 },
  { "kind": "CHARGE", "id": "challoc_456", "amount": 300000 }
]
```

### Validations

```text
somme(allocations) = amount
amount <= total dû restant du locataire   sinon AMOUNT_EXCEEDS_OUTSTANDING
chaque allocation.amount <= solde de la créance visée
chaque créance appartient au locataire et au périmètre de l'appelant
currency identique pour le paiement et toutes les créances visées
```

### Effet

Un paiement manuel est créé directement en statut `CONFIRMED` : c'est le gestionnaire qui atteste de la réception.

### Permissions

`payment.create`, Gestionnaire sur son périmètre, ou Propriétaire.

---

# 21. Créer un paiement numérique

```text
POST /api/v1/payments
```

> **DEC-034 OUVERTE** : aucun fournisseur n'est sélectionné.
>
> Cette route et l'interface `PaymentProvider` sont spécifiées, mais le paiement digital n'est pas opérationnel au MVP.
>
> Aucun nom de fournisseur ne doit être codé en dur.

### Input

```json
{
  "tenantId": "tenant_123",
  "amount": 2800000,
  "currency": "GNF",
  "allocations": [
    { "kind": "RENT",   "id": "rent_123",    "amount": 2500000 },
    { "kind": "CHARGE", "id": "challoc_456", "amount": 300000 }
  ]
}
```

Le montant est **calculé et plafonné par le serveur** au total dû restant. Un montant supérieur est rejeté avec `AMOUNT_EXCEEDS_OUTSTANDING`.

Le backend crée d'abord une transaction en statut :

```text
PENDING
```

`INITIATED` n'existe pas (DEC-016).

Les allocations sont **calculées et réservées à la création**, mais ne deviennent effectives sur les soldes qu'à la confirmation.

---

# 22. Consulter un paiement

```text
GET /api/v1/payments/:id
```

La réponse indique :

- montant ;
- statut ;
- référence ;
- période ;
- locataire ;
- appartement ;
- moyen ;
- dates.

---

# 23. Webhook paiement

```text
POST /api/v1/webhooks/payments/:provider
```

Le endpoint doit :

1. vérifier l'authenticité ;
2. vérifier l'identifiant externe ;
3. contrôler l'idempotence ;
4. retrouver le paiement ;
5. mettre à jour le statut ;
6. appliquer les règles métier ;
7. déclencher les événements nécessaires.

---

# 24. Idempotence des paiements

Chaque transaction externe doit posséder une clé d'idempotence ou référence fournisseur.

Exemple :

```text
providerTransactionId
```

Un même identifiant ne doit jamais produire deux paiements métier confirmés.

---

# 25. Confirmation du paiement

Lorsqu'un paiement devient `CONFIRMED`, dans **une seule transaction** :

```text
BEGIN

1. Passer le paiement à CONFIRMED, renseigner confirmed_at
2. Créer ou activer les payment_allocations
3. Pour CHAQUE créance touchée, loyer ou charge :
     amount_paid = somme des allocations confirmées
     balance     = amount_due - amount_paid
     status      = recalculé selon BR-037
4. Générer la quittance, avec ventilation par composante
5. Créer les notifications
6. Créer l'événement d'activité et l'entrée d'audit

COMMIT
```

Une confirmation peut donc mettre à jour **plusieurs créances de types différents**.

La confirmation ne provient jamais du frontend (DEC-009) : uniquement d'un webhook authentifié, d'une vérification serveur du statut, ou de l'enregistrement manuel par un utilisateur autorisé.

---

# 26. Routes : quittances

## Consulter

```text
GET /api/v1/receipts/:id
```

---

## Générer / régénérer

Une opération interne peut être utilisée lorsque nécessaire :

```text
POST /internal/receipts/:paymentId/generate
```

La génération doit être idempotente.

---

# 27. Routes : charges

## Créer

```text
POST /api/v1/charges
```

### Input

```json
{
  "propertyId": "property_1",
  "type": "WATER",
  "periodStart": "2026-09-01",
  "dueDate": "2026-09-10",
  "totalAmount": 3600000,
  "currency": "GNF",
  "allocationMethod": "EQUAL",
  "supplierName": "SEG"
}
```

La charge est créée en statut `DRAFT`. Elle ne crée aucune créance et n'est visible d'aucun locataire tant qu'elle n'est pas publiée.

`allocationMethod` n'accepte que `EQUAL` au MVP (DEC-029).

---

# 28. Prévisualiser une répartition

```text
POST /api/v1/charges/:id/preview
```

Cette opération ne publie rien.

Elle retourne :

- appartements concernés ;
- montant individuel ;
- total ;
- éventuel écart d'arrondi.

---

# 29. Publier une charge

```text
POST /api/v1/charges/:id/publish
```

> **DEC-005** : la publication **crée des créances payables**, une par appartement concerné.

Avant publication, le backend doit vérifier :

- la charge est en statut `DRAFT` ;
- l'appelant a accès au périmètre de l'immeuble ;
- la répartition est complète ;
- `somme des parts = totalAmount` ;
- la période et la date d'échéance sont valides.

## Effet, en une transaction

```text
BEGIN

1. Calculer les parts selon allocationMethod
2. Vérifier l'invariant de somme
3. Créer une charge_allocation par appartement :
     status      = UNPAID
     amount_due  = part calculée
     amount_paid = 0
     balance     = amount_due
     due_date    = due_date de la charge
     lease_id / tenant_user_id  = bail actif à cette date, ou NULL
4. Passer la charge en PUBLISHED, renseigner published_at
5. Notifier les locataires concernés
6. Journaliser activité et audit

COMMIT
```

## Republication

Une charge déjà `PUBLISHED` ne peut pas être republiée.

Une seconde tentative retourne `CONFLICT`, y compris en cas de double-clic ou de requête concurrente.

## Annulation

```text
POST /api/v1/charges/:id/cancel
```

Passe la charge en `CANCELLED` et ses créances en `CANCELLED`, sans supprimer ni les créances, ni les allocations de paiement déjà réalisées.

---

# 30. Lister les charges

```text
GET /api/v1/charges
```

Filtres :

```text
propertyId
period
type
status
```

---

# 31. Part de charge locataire

Le locataire ne demande jamais la totalité de la charge.

Le backend filtre automatiquement ses propres créances de charge.

```text
GET /api/v1/me/charges
```

### Réponse

Le locataire reçoit ses **créances de charge**, avec leur solde et leur statut :

```json
{
  "data": [
    {
      "id": "challoc_456",
      "type": "WATER",
      "periodStart": "2026-09-01",
      "dueDate": "2026-09-10",
      "amountDue": 300000,
      "amountPaid": 0,
      "balance": 300000,
      "currency": "GNF",
      "status": "UNPAID",
      "explanation": {
        "method": "EQUAL",
        "totalAmount": 3600000,
        "unitCount": 12
      }
    }
  ]
}
```

Le champ `explanation` permet au locataire de comprendre comment sa part a été calculée, conformément à l'exigence de transparence.

Il ne doit **jamais** contenir les montants dus par les autres logements.

---

# 32. Routes : incidents

## Créer

```text
POST /api/v1/incidents
```

### Locataire

Le backend détermine automatiquement :

- tenant ;
- apartment ;
- property.

Le client ne doit pas pouvoir fournir un appartement arbitraire en contournant son contexte.

---

## Gestionnaire

Le gestionnaire peut créer un incident avec un appartement explicitement sélectionné dans son périmètre.

---

# 33. Consulter un incident

```text
GET /api/v1/incidents/:id
```

Les permissions sont contrôlées selon :

- propriétaire ;
- gestionnaire ;
- locataire concerné.

---

# 34. Modifier un incident

```text
PATCH /api/v1/incidents/:id
```

Les champs modifiables dépendent du statut et du rôle.

---

# 35. Changer le statut d'un incident

```text
POST /api/v1/incidents/:id/status
```

### Input

```json
{
  "status": "IN_PROGRESS"
}
```

Valeurs autorisées, DEC-017 :

```text
OPEN | ASSIGNED | IN_PROGRESS | ON_HOLD | RESOLVED | CLOSED
```

Le backend vérifie que la transition demandée figure dans la table des transitions autorisées.

Une transition non autorisée retourne `INVALID_STATE`.

Le statut d'une **intervention** suit un enum distinct (DEC-018) et sa propre route :

```text
POST /api/v1/interventions/:id/status
PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
```

---

# 36. Créer une intervention

```text
POST /api/v1/incidents/:incidentId/interventions
```

### Input

```json
{
  "providerName": "Mohamed Plomberie",
  "scheduledDate": "2026-09-09",
  "estimatedCost": 500000
}
```

---

# 37. Terminer une intervention

```text
POST /api/v1/interventions/:id/complete
```

### Input

```json
{
  "actualCost": 450000,
  "notes": "Fuite réparée"
}
```

Le système peut proposer ou générer la dépense correspondante selon les règles.

---

# 38. Routes : dépenses

## Créer

```text
POST /api/v1/expenses
```

### Input

```json
{
  "propertyId": "property_1",
  "category": "plumbing",
  "amount": 450000,
  "date": "2026-09-09",
  "interventionId": "intervention_1"
}
```

---

## Lister

```text
GET /api/v1/expenses
```

Filtres :

```text
propertyId
category
period
provider
```

---

# 39. Routes : notifications

## Lister

```text
GET /api/v1/notifications
```

---

## Marquer comme lue

```text
POST /api/v1/notifications/:id/read
```

---

## Préférences

```text
GET /api/v1/notification-preferences
PATCH /api/v1/notification-preferences
```

---

# 40. Envoi de notification

Les notifications doivent passer par un service métier.

Exemple :

```text
NotificationService.send({
  event: "payment.confirmed",
  recipient: tenant,
  channels: ["in_app", "whatsapp"]
})
```

Le service choisit les canaux appropriés selon les règles.

---

# 41. Routes : activité

```text
GET /api/v1/activity
```

Filtres :

```text
propertyId
userId
type
from
to
```

Les utilisateurs ne voient que les activités autorisées.

---

# 42. Routes : rapports

## Rapport de gestion

```text
GET /api/v1/reports/property/:id
```

Paramètres :

```text
period
```

### Réponse

```json
{
  "data": {
    "currency": "GNF",
    "rentExpected": 30000000,
    "rentCollected": 27500000,
    "rentOutstanding": 2500000,
    "chargesBilled": 3600000,
    "chargesCollected": 3000000,
    "chargesOutstanding": 600000,
    "totalOutstanding": 3100000,
    "expenses": 2450000,
    "openIncidents": 2
  }
}
```

> **DEC-005** : les indicateurs distinguent explicitement **loyers** et **charges**.
>
> `totalOutstanding` agrège les deux types de créance. Il ne doit jamais être confondu avec `rentOutstanding`.
>
> `chargesBilled` correspond aux créances de charge publiées, pas au montant des factures fournisseurs, qui relève des dépenses.

Les définitions exactes des indicateurs proviennent des Business Rules.

---

# 43. Agrégations

Les indicateurs doivent être calculés côté backend ou dans une couche dédiée.

Le frontend ne doit pas reconstruire des indicateurs financiers complexes à partir de listes partielles.

---

# 44. Pagination

Les collections doivent utiliser un mécanisme de pagination.

Exemple :

```text
GET /api/v1/payments?page=1&pageSize=20
```

Le serveur doit imposer une limite maximale.

Le client ne doit pas pouvoir demander arbitrairement un volume énorme.

---

# 45. Recherche

Exemple :

```text
GET /api/v1/search?q=mamadou
```

Le backend applique les filtres de permissions avant de retourner les résultats.

---

# 46. API de sélection

Pour les champs de type :

- immeuble ;
- appartement ;
- locataire ;

les endpoints peuvent fournir des résultats légers.

Exemple :

```text
GET /api/v1/tenants?search=diallo&limit=10
```

Le frontend mobile n'a pas besoin de récupérer toutes les données du locataire.

---

# 47. Validation Zod

Chaque entrée doit avoir un schéma de validation.

Exemple conceptuel :

```ts
const createExpenseSchema = z.object({
  propertyId: z.string(),
  category: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  interventionId: z.string().optional(),
});
```

Le schéma est appliqué avant la logique métier.

---

# 48. Autorisation

Chaque mutation doit déclarer ou vérifier sa permission.

Exemple :

```text
payment.create
charge.publish
tenant.create
incident.update
manager.revoke
```

Les noms définitifs seront centralisés dans le système d'autorisation.

---

# 49. Règle d'accès au périmètre

Avant toute opération sur un immeuble :

```text
canAccessProperty(user, propertyId)
```

doit être vérifié.

Même logique pour :

- appartement ;
- locataire ;
- contrat ;
- incident ;
- dépense.

L'autorisation doit suivre les relations de la donnée.

---

# 50. Transactions métier

Exemple :

### Confirmation d'un paiement

```text
BEGIN

Update payment
Update rent allocation
Update rent status
Create receipt
Create activity
Create notification event

COMMIT
```

Si une opération critique échoue au milieu, l'ensemble doit être annulé lorsque cela est nécessaire pour préserver la cohérence.

---

# 51. Domain Events

Le système peut utiliser des événements internes pour découpler certaines actions.

Exemple :

```text
payment.confirmed
```

peut déclencher :

- mise à jour du loyer ;
- génération quittance ;
- notification ;
- activité.

Le traitement doit rester observable et idempotent.

---

# 52. Jobs internes

Exemples :

```text
generateMonthlyRents
sendRentReminders
expireInvitations
retryNotifications
generateReports
cleanupTemporaryFiles
```

Chaque job doit avoir :

- identifiant ;
- statut ;
- date ;
- résultat ;
- erreurs éventuelles.

---

# 53. Retry

Les opérations externes peuvent échouer temporairement.

Le système doit pouvoir retenter :

- SMS ;
- WhatsApp ;
- email ;
- stockage ;
- certains appels fournisseurs.

Les paiements ne doivent pas être relancés aveuglément.

---

# 54. Webhooks

Les webhooks entrants doivent :

1. être authentifiés ;
2. être parsés ;
3. être validés ;
4. être idempotents ;
5. produire un événement ;
6. être journalisés.

---

# 55. Endpoint interne versus public

Les routes `/internal/*` ne doivent pas être accessibles publiquement.

Elles doivent utiliser une authentification technique ou un mécanisme sécurisé équivalent.

---

# 56. Rate Limiting

Le rate limiting doit être appliqué notamment sur :

- login ;
- reset password ;
- invitations ;
- OTP si utilisé ;
- paiements ;
- recherche publique éventuelle ;
- webhooks lorsque nécessaire.

---

# 57. Concurrency Control

Les opérations sensibles doivent vérifier la version ou l'état de l'objet avant modification.

Exemple :

Deux gestionnaires ouvrent la même charge.

Le premier la publie.

Le second tente également de la publier.

Le backend doit refuser la seconde opération avec :

```text
CONFLICT
```

plutôt que publier deux fois.

---

# 58. Optimistic UI

Le frontend peut utiliser l'optimistic UI uniquement lorsqu'une erreur peut être facilement corrigée.

Pour les opérations financières, la confirmation serveur doit rester la source de vérité.

Exemple :

Après paiement :

> Vérification du paiement...

avant :

> Paiement confirmé.

---

# 59. Cache

Les réponses qui peuvent être mises en cache doivent avoir une stratégie explicite.

Les données très sensibles ou variables rapidement doivent rester fraîches.

---

# 60. Mobile API considerations

Le backend doit être pensé pour les connexions mobiles.

Éviter les réponses surdimensionnées.

Utiliser :

- pagination ;
- champs ciblés si nécessaire ;
- compression ;
- images optimisées ;
- lazy loading.

---

# 61. API versioning

Les endpoints externes pourront être versionnés :

```text
/api/v1/
```

Cela permettra de faire évoluer le contrat API sans casser immédiatement les clients existants.

---

# 62. Sécurité des données

Les réponses API doivent respecter le principe de moindre privilège.

Exemple :

Le locataire ne doit jamais recevoir dans la réponse API :

- autres locataires ;
- revenus de l'immeuble ;
- dépenses du propriétaire ;
- données privées des gestionnaires.

Même si le frontend ne les affiche pas.

---

# 63. API et documents

Lorsqu'un document est demandé :

1. vérifier les permissions ;
2. générer un accès temporaire ;
3. retourner l'URL ou le mécanisme sécurisé ;
4. journaliser l'accès si nécessaire.

---

# 64. API et historique

Les modifications sensibles doivent créer un journal.

Exemple :

```text
PATCH /leases/123
```

peut produire :

```text
lease.updated
```

avec les changements importants.

---

# 65. API et suppressions

Les endpoints DELETE doivent être évités pour les données métier critiques.

Préférer :

```text
POST /resource/:id/archive
POST /resource/:id/revoke
POST /resource/:id/cancel
POST /resource/:id/terminate
```

Le verbe choisi doit refléter l'action métier.

---

# 66. Idempotency-Key

Pour les opérations sensibles, le client peut fournir :

```text
Idempotency-Key
```

Exemple :

Paiement :

```text
Idempotency-Key: 8d94...
```

Le serveur conserve le résultat associé.

Une répétition avec la même clé retourne le même résultat.

---

# 67. Permissions et réponse API

Une route de liste ne doit pas simplement filtrer le frontend.

Exemple :

```text
GET /payments
```

Le backend filtre directement :

```text
organization
+
scope
+
permissions
```

Les objets non autorisés ne doivent jamais être retournés.

---

# 68. Logs d'erreur

Chaque erreur interne significative doit être corrélable avec une référence technique.

Exemple :

```text
errorId: ERR-2026-000482
```

Le frontend peut afficher :

> Une erreur est survenue.

et fournir la référence au support sans exposer les détails techniques.

---

# 69. Contrats entre frontend et backend

Les types partagés doivent être dérivés autant que possible des schémas.

L'objectif est de réduire :

> frontend pense `amount`

alors que :

> backend attend `totalAmount`.

Les noms doivent être standardisés.

---

# 70. Convention de nommage

Le backend doit utiliser une convention stable.

Exemple :

```text
propertyId
apartmentId
tenantId
leaseId
paymentId
chargeId
incidentId
expenseId
```

Les noms ne doivent pas varier arbitrairement.

---

# 71. Dates API

Les dates doivent utiliser un format standardisé.

Les dates et heures nécessitant un fuseau doivent être transmises dans un format explicite.

Le frontend se charge de l'affichage local.

---

# 72. Montants API

> **Convention unique : DEC-014.**

Tout montant est transmis comme un **entier** exprimé dans la plus petite unité de la devise, accompagné du code ISO 4217.

```json
{
  "amount": 2500000,
  "currency": "GNF"
}
```

Pour le GNF, l'exposant de sous-unité est 0 : la valeur transmise est le montant en francs guinéens.

Règles :

- jamais de nombre décimal ni de chaîne formatée dans un champ montant ;
- jamais de montant sans devise associée, explicitement ou par héritage du parent ;
- le formatage d'affichage relève exclusivement du frontend.

---

# 73. Critères d'acceptation backend

Le backend est considéré comme suffisamment prêt lorsque :

1. toutes les actions du MVP possèdent un cas d'usage backend ;
2. les permissions sont vérifiées côté serveur ;
3. les données sont isolées par organisation ;
4. les paiements sont idempotents ;
5. les échéances sont générées sans doublon ;
6. les charges sont calculées correctement ;
7. les historiques sont préservés ;
8. les fichiers privés sont protégés ;
9. les webhooks sont sécurisés ;
10. les erreurs sont structurées ;
11. les tests critiques existent ;
12. le frontend peut consommer les mêmes contrats de façon prévisible.

---

# 74. Exemple complet : ajouter un locataire

```text
POST /api/v1/tenants
```

### Étape 1

Authentifier l'utilisateur.

### Étape 2

Vérifier son rôle.

### Étape 3

Vérifier l'accès à l'immeuble.

### Étape 4

Vérifier l'accès à l'appartement.

### Étape 5

Valider les données avec Zod.

### Étape 6

Vérifier qu'un contrat incompatible n'existe pas.

### Étape 7

Créer le profil / relation locative.

### Étape 8

Créer le contrat si fourni.

### Étape 9

Créer l'événement d'activité.

### Étape 10

Retourner le locataire créé.

---

# 75. Exemple complet : paiement

```text
POST /api/v1/payments
```

### Étape 1

Authentifier.

### Étape 2

Vérifier que le locataire peut payer la dette concernée.

### Étape 3

Valider le montant.

### Étape 4

Créer la transaction.

### Étape 5

Envoyer au fournisseur.

### Étape 6

Passer en attente.

### Étape 7

Recevoir le webhook.

### Étape 8

Vérifier le webhook.

### Étape 9

Confirmer la transaction.

### Étape 10

Recalculer le solde.

### Étape 11

Mettre à jour le statut du loyer.

### Étape 12

Générer la quittance.

### Étape 13

Déclencher la notification.

### Étape 14

Créer le journal d'activité.

---

# 76. Exemple complet : publication d'une charge

```text
POST /api/v1/charges/:id/publish
```

### Étape 1

Vérifier le gestionnaire.

### Étape 2

Vérifier l'accès à l'immeuble.

### Étape 3

Vérifier que la charge est complète.

### Étape 4

Calculer les parts.

### Étape 5

Vérifier la somme.

### Étape 6

Créer les allocations.

### Étape 7

Publier.

### Étape 8

Créer les obligations correspondantes.

### Étape 9

Notifier les locataires.

### Étape 10

Journaliser.

---

# 77. Exemple complet : révocation d'un gestionnaire

```text
POST /api/v1/managers/:id/revoke
```

### Vérifier

- propriétaire autorisé ;
- gestionnaire appartenant à l'organisation ;
- état actuel.

### Effectuer

- changer le statut ;
- invalider les sessions ou accès concernés ;
- conserver l'historique ;
- journaliser ;
- notifier éventuellement.

---

# 78. Documentation générée

Le projet pourra générer automatiquement une documentation API à partir des schémas lorsque cela est pertinent.

OpenAPI peut être introduit si une API externe plus importante devient nécessaire.

Pour le MVP, il faut éviter d'ajouter une couche documentaire complexe qui n'apporte pas encore de valeur.

---

# 79. Règle de développement avec Claude Code

Une instruction de développement doit pouvoir être formulée ainsi :

```text
Implement:

POST /api/v1/payments/manual

Role:
Owner, Manager

Permission:
payment.create

Validation:
createManualPaymentSchema

Business rules:
BR-038
BR-039
BR-040
BR-045

Success:
201

Output:
Payment + updated rent + receipt reference

Errors:
VALIDATION_ERROR
FORBIDDEN
NOT_FOUND
CONFLICT

Tests:
unit + integration
```

Cette structure permet de connecter directement :

**PRD → Business Rules → API → Code → Tests**

---

# 80. Résumé

L'API doit rester :

- prévisible ;
- sécurisée ;
- idempotente ;
- mobile-friendly ;
- orientée domaine ;
- indépendante des fournisseurs externes ;
- fortement contrôlée par les permissions.

Le backend constitue la source de vérité pour les règles métier et les droits.

Le frontend présente et orchestre l'expérience.

Les services externes exécutent certaines opérations spécialisées.

Cette séparation permet au produit d'être développé rapidement avec Claude Code tout en conservant une architecture suffisamment solide pour évoluer.