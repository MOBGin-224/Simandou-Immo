# Domain Glossary & Naming Specification

## 1. Objet du document

Ce document définit le vocabulaire officiel du produit.

Son objectif est d'éviter qu'un même concept soit nommé différemment selon :

- la documentation ;
- l'interface ;
- la base de données ;
- l'API ;
- le code TypeScript ;
- les tests ;
- les événements analytics ;
- les messages utilisateur ;
- les échanges avec Claude Code.

Le vocabulaire constitue une partie importante de l'architecture.

Un mauvais vocabulaire peut produire :

```text
Même concept
↓
3 noms différents
↓
3 modèles différents
↓
Confusion métier
↓
Erreurs de code
```

Le principe est donc :

> **Un concept métier important doit avoir un nom officiel et stable.**

---

# 2. Principes fondamentaux

## GLOSS-001 : Un concept, un terme officiel

Lorsqu'un objet métier possède un nom officiel, celui-ci doit être utilisé dans les documents et le code.

---

## GLOSS-002 : Le métier prime sur la traduction littérale

Le nom retenu doit refléter le fonctionnement réel du produit.

Une traduction mot à mot ne doit pas être privilégiée si elle crée une ambiguïté.

---

## GLOSS-003 : Distinguer le langage utilisateur et le langage technique

Le terme visible dans l'interface peut être plus simple que le nom technique interne.

Exemple :

```text
Interface :
Paiement

Code :
Payment

Base :
payments
```

---

## GLOSS-004 : Les termes financiers doivent être particulièrement stricts

Il faut distinguer :

```text
Montant dû
Montant payé
Reste à payer
Paiement
Échéance
Charge
Quittance
```

Ces concepts ne doivent pas être mélangés.

---

# 3. MVP

# 3.1 Product

## Terme officiel

**Product**

### Français utilisateur

**Plateforme**

ou :

**Application**

selon le contexte.

### Définition

Le SaaS complet de gestion d'immeubles.

### Code recommandé

```text
product
```

---

# 4. Organisation

## Terme officiel

**Organisation**

### Définition

L'entité propriétaire du contexte de données dans lequel sont gérés les immeubles, utilisateurs et opérations.

Elle constitue la première frontière de séparation des données.

### Code

```text
organization
organizations
```

### Ne pas utiliser

```text
company
enterprise
workspace
account
```

comme synonymes dans le modèle principal, sauf nécessité spécifique.

---

# 5. User

## Terme officiel

**User**

### Français

**Utilisateur**

### Définition

Identité authentifiée dans le système.

Un User peut avoir une ou plusieurs relations métier selon l'architecture retenue.

### Code

```text
user
users
```

---

# 6. Role

## Terme officiel

**Role**

### Valeurs MVP

```text
OWNER
MANAGER
TENANT
```

### Français

- OWNER = Propriétaire
- MANAGER = Gestionnaire
- TENANT = Locataire

---

# 7. Owner

## Terme officiel

**Owner**

### Français UI

**Propriétaire**

### Définition

Utilisateur disposant de l'autorité principale sur une organisation et son patrimoine.

### Code

```text
owner
```

### Important

Owner est un rôle.

Ce n'est pas nécessairement une identité différente de User.

```text
User ≠ Role
```

---

# 8. Manager

## Terme officiel

**Manager**

### Français UI

**Gestionnaire**

### Définition

Utilisateur disposant d'un accès opérationnel délégué à un ou plusieurs immeubles.

### Code

```text
manager
managers
```

### Important

Un Manager est un rôle ou une relation d'accès, pas une nouvelle catégorie d'utilisateur indépendante.

---

# 9. Tenant

## Terme officiel

**Tenant**

### Français UI

**Locataire**

### Définition

Personne occupant un logement dans le cadre d'une relation locative.

### Code

```text
tenant
tenants
```

---

# 10. Tenant Profile

## Terme officiel

**Tenant Profile**

### Français

**Profil locataire**

### Définition

Objet métier contenant les informations spécifiques à la relation de locataire.

Il ne doit pas être confondu avec le User.

```text
User
≠
Tenant Profile
```

---

# 11. Property

## Terme officiel

**Property**

### Français UI

**Immeuble**

### Définition

Un ensemble immobilier géré comme une unité opérationnelle dans la plateforme.

Exemple :

```text
Résidence Camayenne
```

### Code

```text
property
properties
```

### Ne pas utiliser

Éviter d'utiliser `building` comme terme principal si le modèle officiel est `property`.

---

# 12. Building

## Statut

Terme secondaire uniquement si nécessaire.

### Pourquoi

"Building" est compréhensible techniquement mais peut être trop restrictif si le produit évolue vers différents types de patrimoine.

Le modèle métier principal reste :

```text
Property
```

---

# 13. Apartment

## Terme officiel

**Apartment**

### Français UI

**Appartement**

### Définition

Un logement individuel appartenant à un Property.

### Code

```text
apartment
apartments
```

---

# 14. Housing Unit

## Statut

Terme conceptuel futur.

Le produit peut éventuellement évoluer vers d'autres types de logements.

Pour le MVP :

```text
Apartment
```

reste le terme officiel.

---

# 15. Lease

## Terme officiel

**Lease**

### Français UI

**Contrat de location**

ou :

**Contrat**

lorsque le contexte est évident.

### Définition

Relation locative entre un Tenant et un Apartment pendant une période déterminée avec des conditions définies.

### Code

```text
lease
leases
```

---

# 16. Lease Term

## Terme officiel

**Lease Term**

### Français

**Période du contrat**

### Définition

Période comprise entre la date de début et la date de fin du contrat.

---

# 17. Rent

## Terme officiel

**Rent**

### Français

**Loyer**

### Définition

Montant prévu au titre de la location.

Attention :

```text
Rent
≠
Rent Installment
≠
Payment
```

---

# 17-bis. Receivable

## Terme officiel

**Receivable**

### Français UI

**Créance**

### Définition

Somme due par un locataire, portant son propre montant, son propre solde et son propre statut.

Le MVP comporte **deux types de créance** (DEC-005) :

```text
Rent Installment    créance de loyer
Charge Allocation   créance de charge
```

Les deux partagent le même enum de statut `receivable_status` et le même mécanisme d'allocation.

### Important

`Receivable` est un **concept de domaine**, pas une table.

Il n'existe pas de table `receivables` : les deux types restent des tables distinctes, reliées aux paiements par `payment_allocations`.

Dans l'API, le champ `kind` prend les valeurs `RENT` ou `CHARGE`.

---

# 18. Rent Installment

## Terme officiel

**Rent Installment**

### Français UI

**Échéance de loyer**

### Définition

Créance correspondant à un montant de loyer dû pour une période donnée.

### Code

```text
rent_installment
rent_installments
```

---

# 19. Due Amount

## Terme officiel

**Due Amount**

### Français

**Montant dû**

### Définition

Montant actuellement exigible selon une ou plusieurs créances.

---

# 20. Paid Amount

## Terme officiel

**Paid Amount**

### Français

**Montant payé**

### Définition

Somme des paiements effectivement affectés à une créance.

---

# 21. Outstanding Balance

## Terme officiel

**Outstanding Balance**

### Français UI

**Reste à payer**

### Définition

Montant restant d'**une créance** après allocation des paiements.

```text
Outstanding Balance
=
Due Amount
-
Allocated Payments
```

Ne peut jamais être négatif.

---

# 21-bis. Total Outstanding

## Terme officiel

**Total Outstanding**

### Français UI

**Total dû**

### Définition

Somme des soldes de **toutes les créances ouvertes** d'un locataire, loyers et charges confondus.

```text
Total Outstanding
=
somme des Outstanding Balance
des créances UNPAID, PARTIALLY_PAID, OVERDUE
```

C'est le montant global présenté au locataire.

Il est toujours calculé côté serveur, jamais recomposé par le frontend.

### Ne pas confondre

```text
Outstanding Balance   solde d'UNE créance
Total Outstanding     total dû par un locataire
```

---

# 22. Payment

## Terme officiel

**Payment**

### Français UI

**Paiement**

### Définition

Enregistrement métier représentant une somme reçue ou en cours de traitement selon son statut.

### Code

```text
payment
payments
```

### Important

Un Payment n'est pas nécessairement confirmé au moment de sa création.

---

# 23. Payment Transaction

## Terme officiel

**Payment Transaction**

### Français

**Transaction de paiement**

### Définition

Opération externe chez un fournisseur de paiement.

```text
Payment
≠
Provider Transaction
```

---

# 24. Payment Method

## Terme officiel

**Payment Method**

### Français

**Mode de paiement**

Exemples :

```text
Cash
Mobile Money
Card
```

Les valeurs réelles dépendent des moyens retenus.

---

# 25. Payment Status

## Terme officiel

**Payment Status**

### Valeurs canoniques du MVP — DEC-016

```text
PENDING
CONFIRMED
FAILED
CANCELLED
```

`INITIATED` **n'existe pas** : un paiement créé et non confirmé est `PENDING`.

`REFUNDED` est **hors MVP** (`FUT-FEAT-021`). Une correction utilise `CANCELLED` avec trace d'audit.

### Payment Method

```text
CASH
BANK_TRANSFER
MOBILE_MONEY
OTHER
```

---

# 26. Payment Allocation

## Terme officiel

**Payment Allocation**

### Français

**Affectation du paiement**

### Définition

Relation entre un paiement et une créance qu'il couvre totalement ou partiellement.

### Code

```text
payment_allocation
payment_allocations
```

---

# 27. Receipt

## Terme officiel

**Receipt**

### Français UI

**Quittance**

### Définition

Document ou enregistrement attestant d'un paiement conforme aux règles métier.

### Code

```text
receipt
receipts
```

---

# 28. Charge

## Terme officiel

**Charge**

### Français UI

**Charge**

### Définition

Dépense ou montant commun qui doit être réparti entre plusieurs logements selon une règle définie.

Exemple :

```text
Facture d'eau
```

---

# 29. Charge Allocation

## Terme officiel

**Charge Allocation**

### Français UI

**Part de charge**

### Définition

Part d'une charge totale affectée à un logement, **constituant une créance payable** distincte du loyer (DEC-005).

Elle porte son propre montant dû, son montant payé, son solde, sa date d'échéance et son statut.

### Code

```text
charge_allocation
charge_allocations
```

### Ne pas confondre

```text
Charge Allocation    créance de charge due par un logement
Payment Allocation   affectation d'un paiement à une créance
```

Ces deux termes se ressemblent mais désignent des objets sans rapport.

---

# 30. Incident

## Terme officiel

**Incident**

### Français UI

**Incident**

### Définition

Problème signalé nécessitant une observation, une action ou une intervention.

### Code

```text
incident
incidents
```

---

# 31. Intervention

## Terme officiel

**Intervention**

### Français UI

**Intervention**

### Définition

Action opérationnelle réalisée pour traiter un incident.

### Code

```text
intervention
interventions
```

---

# 32. Provider

## Terme officiel

**Provider**

### Français

**Prestataire** ou **Fournisseur**

selon le contexte.

### Définition

Entité externe ou personne fournissant un service ou intervenant dans une opération.

Attention :

```text
Provider métier
≠
External Service Provider
```

---

# 33. Service Provider

## Terme officiel

**Service Provider**

### Français

**Prestataire**

### Définition

Entreprise ou personne intervenant pour réaliser une prestation :

- plomberie ;
- électricité ;
- nettoyage ;
- maintenance.

---

# 34. External Provider

## Terme officiel

**External Provider**

### Français technique

**Fournisseur externe**

### Définition

Service externe intégré techniquement à l'application.

Exemples :

- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage.

---

# 35. Expense

## Terme officiel

**Expense**

### Français UI

**Dépense**

### Définition

Enregistrement d'un coût supporté par un immeuble ou une opération.

### Code

```text
expense
expenses
```

---

# 36. Document

## Terme officiel

**Document**

### Français

**Document**

### Définition

Fichier ou objet documentaire associé à une ressource métier.

Exemples :

- contrat ;
- justificatif ;
- photo ;
- reçu.

---

# 37. Invitation

## Terme officiel

**Invitation**

### Français

**Invitation**

### Définition

Autorisation temporaire permettant à un destinataire d'activer un accès à un contexte défini.

### Code

```text
invitation
invitations
```

---

# 38. Invitation Token

## Terme officiel

**Invitation Token**

### Français technique

**Jeton d'invitation**

### Définition

Valeur secrète temporaire permettant l'acceptation d'une invitation.

---

# 39. Notification

## Terme officiel

**Notification**

### Français

**Notification**

### Définition

Message généré par le produit à destination d'un utilisateur ou d'un canal externe.

---

# 40. Notification Channel

## Terme officiel

**Notification Channel**

### Valeurs possibles

```text
IN_APP
SMS
WHATSAPP
EMAIL
```

Les canaux futurs peuvent être ajoutés sans modifier le concept de Notification.

---

# 41. Reminder

## Terme officiel

**Reminder**

### Français

**Rappel**

### Définition

Notification déclenchée selon une règle temporelle ou métier.

---

# 42. Dashboard

## Terme officiel

**Dashboard**

### Français UI

**Tableau de bord**

### Définition

Vue synthétique présentant les indicateurs et actions les plus importantes pour un rôle.

---

# 43. Activity Log

## Terme officiel

**Activity Log**

### Français UI

**Activité**

### Définition

Historique lisible des activités importantes du produit.

---

# 44. Audit Log

## Terme officiel

**Audit Log**

### Français technique

**Journal d'audit**

### Définition

Historique des actions sensibles destiné à la sécurité, au contrôle et à la traçabilité.

---

# 45. Resource

## Terme officiel

**Resource**

### Français technique

**Ressource**

### Définition

Objet auquel une autorisation peut s'appliquer.

Exemples :

```text
Property
Apartment
Lease
Payment
Charge
Incident
Document
```

---

# 46. Scope

## Terme officiel

**Scope**

### Français technique

**Périmètre**

### Définition

Ensemble des ressources auxquelles un utilisateur peut accéder.

Exemple :

```text
Manager
Scope:
Property A
Property B
```

---

# 47. Permission

## Terme officiel

**Permission**

### Français

**Permission**

### Définition

Autorisation d'effectuer une action sur une ressource.

Exemple :

```text
payment.create
```

---

# 48. Role vs Permission vs Scope

Ces concepts doivent toujours rester distincts.

```text
Role
=
Qui es-tu ?

Permission
=
Que peux-tu faire ?

Scope
=
Sur quoi peux-tu le faire ?
```

Exemple :

```text
Manager
+
payment.create
+
Property A
```

---

# 49. Archive

## Terme officiel

**Archive**

### Français

**Archiver**

### Définition

Rendre une ressource inactive sans supprimer son historique.

---

# 50. Deactivate

## Terme officiel

**Deactivate**

### Français

**Désactiver**

À utiliser lorsqu'une entité reste présente mais ne doit plus être active.

---

# 51. Revoke

## Terme officiel

**Revoke**

### Français

**Révoquer**

### Définition

Retirer explicitement une autorisation ou un accès.

Exemple :

```text
Manager Access
→ REVOKED
```

---

# 52. Suspend

## Terme officiel

**Suspend**

### Français

**Suspendre**

### Définition

Bloquer temporairement une capacité ou un accès sans nécessairement mettre fin à la relation.

---

# 53. End

## Terme officiel

**End**

### Français

**Terminer**

À utiliser principalement pour une relation métier ayant une fin naturelle :

```text
Lease Ended
```

---

# 54. Delete

## Terme officiel

**Delete**

### Français

**Supprimer**

### Règle

Le terme `delete` ne doit pas être utilisé comme synonyme de :

- archive ;
- revoke ;
- deactivate ;
- end.

Chaque action possède une signification métier propre.

---

# 55. Status

## Terme officiel

**Status**

### Français

**Statut**

### Définition

État courant d'une ressource.

---

# 56. State Transition

## Terme officiel

**State Transition**

### Français

**Transition d'état**

### Incident — DEC-017

```text
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

avec `ON_HOLD` intercalable.

### Intervention — DEC-018

```text
PLANNED → IN_PROGRESS → COMPLETED
```

ou `CANCELLED`.

Ces deux cycles sont **distincts** et ne doivent jamais être confondus.

Une transition doit respecter les Business Rules. Une transition non autorisée retourne `INVALID_STATE`.

---

# 57. Confirmed

## Terme officiel

**Confirmed**

### Français

**Confirmé**

### Usage

Doit être réservé à une opération dont la confirmation a réellement été établie.

Important pour les paiements.

---

# 58. Pending

## Terme officiel

**Pending**

### Français

**En attente**

### Définition

Une opération existe mais son résultat final n'est pas encore déterminé.

---

# 59. Failed

## Terme officiel

**Failed**

### Français

**Échoué**

### Définition

L'opération n'a pas abouti selon la règle applicable.

---

# 60. Cancelled

## Terme officiel

**Cancelled**

### Français

**Annulé**

### Définition

Une opération existante a été explicitement annulée selon les règles métier.

---

# 61. Overdue

## Terme officiel

**Overdue**

### Français

**En retard**

### Définition

Une échéance est arrivée à son terme sans avoir été entièrement réglée selon la règle applicable.

---

# 62. Paid

## Terme officiel

**Paid**

### Français

**Payé**

### Définition

La créance concernée est entièrement couverte selon les règles métier.

---

# 63. Partially Paid

## Terme officiel

**Partially Paid**

### Français

**Partiellement payé**

### Définition

Une partie de la créance a été couverte mais un solde subsiste.

---

# 64. Unpaid

## Terme officiel

**Unpaid**

### Français

**Impayé**

### Définition

Aucun paiement valide n'a été affecté à la créance.

---

# 65. Due Date

## Terme officiel

**Due Date**

### Français

**Date d'échéance**

### Définition

Date à laquelle un montant devient dû selon les règles du contrat.

---

# 66. Period

## Terme officiel

**Period**

### Français

**Période**

### Définition

Intervalle temporel associé à une opération métier.

Exemples :

- période de loyer ;
- période de charge ;
- période contractuelle.

---

# 67. Provider Reference

## Terme officiel

**Provider Reference**

### Français

**Référence fournisseur**

### Définition

Identifiant fourni par un service externe.

Important :

```text
Provider Reference
≠
Internal ID
```

---

# 68. Internal ID

## Terme officiel

**ID**

### Définition

Identifiant interne stable d'une ressource.

Le code et l'API doivent utiliser les identifiants internes selon les conventions établies.

---

# 69. UUID

## Statut

Type technique recommandé pour les identifiants principaux lorsque retenu par le Data Model.

Il ne doit pas devenir un terme métier visible pour l'utilisateur.

---

# 70. Mobile First

## Terme officiel

**Responsive Mobile First**

### Définition

L'interface est conçue d'abord pour smartphone puis adaptée à tablette et desktop.

---

# 71. PWA

## Terme officiel

**Progressive Web App**

### Français utilisateur

L'application web installable peut simplement être appelée :

**Application**

lorsque le contexte ne nécessite pas le terme technique.

---

# 72. API

## Terme officiel

**API**

### Définition

Interface programmée permettant à des clients ou services d'interagir avec le backend.

---

# 73. Server Action

## Terme technique

**Server Action**

À utiliser uniquement lorsque ce mécanisme Next.js est effectivement employé.

Ne pas utiliser `Server Action` comme terme générique pour toute logique backend.

---

# 74. Route Handler

## Terme technique

**Route Handler**

Décrit une route backend Next.js lorsqu'elle utilise ce mécanisme.

---

# 75. Service

## Terme technique

**Service**

### Définition

Composant logiciel responsable d'une capacité ou d'un cas d'utilisation cohérent.

Éviter d'utiliser `Service` comme nom générique pour n'importe quel fichier.

---

# 76. Adapter

## Terme technique

**Adapter**

### Définition

Couche permettant de traduire une interface interne vers un service externe.

Exemple :

```text
PaymentProviderAdapter
```

---

# 77. Provider

## Règle importante

Le mot `Provider` doit être utilisé dans un contexte suffisamment clair.

```text
Payment Provider
Storage Provider
Email Provider
```

Éviter de nommer un objet générique simplement `Provider` lorsqu'un domaine précis existe.

---

# 78. Repository

## Terme technique

**Repository**

### Définition

Abstraction de lecture ou d'écriture de données lorsqu'une telle abstraction est réellement utilisée.

Ce terme ne doit pas être utilisé systématiquement pour tout service backend.

---

# 79. Domain

## Terme technique

**Domain**

### Définition

Ensemble des règles et concepts métier d'un domaine fonctionnel.

---

# 80. Business Rule

## Terme officiel

**Business Rule**

### Français

**Règle métier**

### Définition

Règle déterminant ce que le système doit ou ne doit pas permettre.

---

# 81. Acceptance Criteria

## Terme officiel

**Acceptance Criteria**

### Français

**Critères d'acceptation**

### Définition

Conditions permettant de déterminer si une fonctionnalité répond à son exigence.

---

# 82. Definition of Done

## Terme officiel

**Definition of Done**

### Français

**Définition de terminé**

### Définition

Ensemble de conditions techniques et fonctionnelles qu'une tâche doit respecter avant d'être considérée comme terminée.

---

# 83. Incident vs Bug

Ces concepts doivent rester distincts.

## Incident

Événement affectant le service en exploitation.

## Bug

Comportement incorrect du logiciel.

Un bug peut provoquer un incident, mais tous les bugs ne provoquent pas nécessairement un incident.

---

# 84. Feature vs Requirement

## Feature

Capacité utilisateur du produit.

## Requirement

Exigence que le système doit satisfaire.

---

# 85. Feature vs Improvement

## Feature

Nouvelle capacité.

## Improvement

Amélioration d'une capacité existante.

---

# 86. MVP vs Future

## MVP

Nécessaire au lancement.

## Future

Non nécessaire au lancement.

Une fonctionnalité future peut être importante sans être MVP.

---

# 87. Archive vs Delete

```text
Archive
=
Conserver mais rendre inactif

Delete
=
Supprimer
```

Ne jamais employer ces termes comme synonymes.

---

# 88. Revoke vs Suspend

```text
Revoke
=
Retrait explicite d'une autorisation

Suspend
=
Blocage temporaire
```

---

# 89. User vs Tenant

```text
User
=
Identité authentifiée

Tenant
=
Relation métier locative
```

---

# 90. Property vs Apartment

```text
Property
=
Immeuble / unité de patrimoine

Apartment
=
Logement individuel
```

---

# 91. Lease vs Rent

```text
Lease
=
Contrat / relation locative

Rent
=
Loyer

Rent Installment
=
Échéance de loyer
```

---

# 92. Rent vs Payment

```text
Rent
=
Somme due

Payment
=
Somme payée / opération de paiement
```

---

# 93. Payment vs Receipt

```text
Payment
=
Opération financière

Receipt
=
Quittance / preuve documentaire
```

---

# 94. Charge vs Expense

Ces deux notions doivent absolument rester distinctes.

## Charge

Montant affecté à plusieurs logements ou occupants selon une règle de répartition.

## Expense

Dépense supportée par l'immeuble ou une opération.

Une Charge peut avoir une Expense source, mais les deux objets ne sont pas nécessairement identiques.

---

# 95. Incident vs Intervention

```text
Incident
=
Problème signalé

Intervention
=
Action menée pour traiter le problème
```

---

# 96. Activity Log vs Audit Log

```text
Activity Log
=
Compréhension de l'activité

Audit Log
=
Traçabilité de sécurité et contrôle
```

---

# 97. Notification vs Reminder

```text
Notification
=
Message généré par le produit

Reminder
=
Notification déclenchée par une règle de rappel
```

---

# 98. Internal ID vs Provider Reference

```text
Internal ID
=
Identifiant du produit

Provider Reference
=
Identifiant d'un système externe
```

---

# 99. Glossaire UI recommandé

Les termes suivants sont recommandés pour l'interface française.

| Concept technique | Terme UI |
|---|---|
| Receivable | Créance |
| Charge Allocation | Part de charge |
| Organization | Organisation |
| Owner | Propriétaire |
| Manager | Gestionnaire |
| Tenant | Locataire |
| Property | Immeuble |
| Apartment | Appartement |
| Lease | Contrat |
| Rent | Loyer |
| Rent Installment | Échéance |
| Due Amount | Montant dû |
| Outstanding Balance | Reste à payer |
| Payment | Paiement |
| Payment Method | Mode de paiement |
| Receipt | Quittance |
| Charge | Charge |
| Incident | Incident |
| Intervention | Intervention |
| Expense | Dépense |
| Document | Document |
| Notification | Notification |
| Reminder | Rappel |
| Dashboard | Tableau de bord |
| Activity | Activité |
| Audit | Journal d'audit |
| Archive | Archiver |
| Revoke | Révoquer |
| Suspend | Suspendre |
| End | Terminer |
| Pending | En attente |
| Confirmed | Confirmé |
| Failed | Échoué |
| Cancelled | Annulé |
| Paid | Payé |
| Partially Paid | Partiellement payé |
| Overdue | En retard |

---

# 100. Convention code

## MVP-GLOSS-001

Les noms techniques doivent utiliser l'anglais pour les modèles et concepts principaux.

Exemple :

```ts
Property
Apartment
Tenant
Lease
RentInstallment
Payment
Receipt
Charge
Incident
Intervention
Expense
Notification
```

---

# 101. Convention database

Utiliser le `snake_case`.

Exemple :

```text
properties
apartments
tenant_profiles
rent_installments
payment_allocations
charge_allocations
activity_logs
audit_logs
```

---

# 102. Convention TypeScript

Utiliser `PascalCase` pour les types et classes.

Exemple :

```ts
Property
TenantProfile
RentInstallment
PaymentAllocation
```

---

# 103. Convention variables

Utiliser `camelCase`.

Exemple :

```ts
propertyId
tenantId
leaseId
paymentAmount
outstandingBalance
```

---

# 104. Convention fonctions

Utiliser des verbes explicites.

Exemples :

```ts
createProperty()
inviteTenant()
calculateOutstandingBalance()
confirmPayment()
allocatePayment()
archiveProperty()
revokeManagerAccess()
```

---

# 105. Convention événements analytics

Utiliser :

```text
object_action
```

Exemples :

```text
property_created
tenant_invited
lease_created
payment_confirmed
incident_created
```

---

# 106. Convention permissions

Utiliser :

```text
resource.action
```

Exemples :

```text
property.create
property.update
tenant.invite
payment.create
payment.confirm
charge.publish
incident.update
```

---

# 107. Convention API

Utiliser des ressources au pluriel.

Exemples :

```text
/api/v1/properties
/api/v1/apartments
/api/v1/tenants
/api/v1/leases
/api/v1/payments
```

---

# 108. Convention statuts

Utiliser des valeurs stables en **MAJUSCULES**, en anglais, identiques entre base, domaine, API, frontend et tests.

## Liste canonique du MVP — DEC-021

```text
user_status           PENDING_ACTIVATION | ACTIVE | SUSPENDED
user_access_status    ACTIVE | SUSPENDED | REVOKED
role                  OWNER | MANAGER | TENANT
apartment_status      VACANT | OCCUPIED | MAINTENANCE
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

## Valeurs explicitement interdites

```text
AVAILABLE     utiliser VACANT
INITIATED     utiliser PENDING
ARCHIVED      l'archivage est porté par archived_at
rent_status   utiliser receivable_status
```

## États dérivés, jamais stockés

```text
« À venir »    status = UNPAID ET due_date > aujourd'hui
« À traiter »  filtre sur incident_status IN (OPEN, ASSIGNED)
« Lu »         porté par notifications.read_at
```

---

# 109. Terminologie interdite ou à éviter

Éviter d'utiliser arbitrairement :

```text
Customer
Client
Occupant
User
Account
Resident
Member
```

pour désigner un locataire.

Le terme officiel est :

```text
Tenant
```

selon le contexte.

---

# 110. "Client"

Le terme **Client** doit être évité comme terme métier principal.

Il peut être ambigu entre :

- locataire ;
- propriétaire ;
- organisation ;
- utilisateur.

Utiliser le rôle ou l'objet réel.

---

# 111. "Account"

Le terme **Account** peut être utilisé lorsqu'on parle spécifiquement de :

- compte d'authentification ;
- paramètres de compte.

Il ne doit pas remplacer `User` ou `Organization`.

---

# 112. "Building"

Le terme **Building** peut apparaître dans la documentation descriptive, mais le modèle de données principal reste :

```text
Property
```

---

# 113. "Room"

Ne pas utiliser `Room` pour désigner un appartement.

```text
Apartment
```

reste le terme officiel.

---

# 114. "Unit"

`Unit` peut être utilisé dans une architecture future plus générique, mais il ne doit pas remplacer `Apartment` dans le MVP sans décision explicite.

---

# 115. "Invoice"

Le terme `Invoice` ne doit pas être utilisé pour une quittance.

```text
Receipt
=
Quittance
```

Une facture éventuelle serait un concept différent.

---

# 116. "Bill"

`Bill` doit être évité comme terme générique lorsque le contexte permet de distinguer :

- Rent ;
- Charge ;
- Expense ;
- Payment.

---

# 117. "Debt"

Le terme `Debt` ne doit pas être utilisé automatiquement pour toutes les sommes dues.

Dans le MVP, préférer :

```text
Due Amount
Outstanding Balance
Overdue Rent
```

selon le contexte.

---

# 118. "Collection"

Le terme `Collection` peut être utilisé dans un futur contexte de recouvrement, mais ne doit pas être utilisé comme synonyme générique de paiement.

---

# 119. "Transaction"

Le terme `Transaction` doit être contextualisé :

```text
Payment Transaction
```

lorsqu'il désigne une opération auprès d'un fournisseur externe.

---

# 120. Glossaire comme contrat

Le vocabulaire défini ici doit être traité comme un contrat transversal.

Toute nouvelle fonctionnalité doit vérifier :

```text id="oh1hqu"
Concept existant ?
↓
Terme officiel ?
↓
Réutiliser le terme
```

---

# 121. Future Evolutions

Les futurs domaines pourront introduire de nouveaux termes lorsque de nouvelles capacités apparaîtront.

Exemples :

- copropriétaire ;
- syndic ;
- tantième ;
- budget ;
- fournisseur avancé ;
- maintenance planifiée ;
- contrat fournisseur ;
- portefeuille ;
- fiscalité.

Chaque nouveau concept important devra être ajouté au glossaire avant de devenir une partie centrale du codebase.

---

# 122. Architecture Constraints Related to Future Evolutions

## ARCH-GLOSS-001

Le modèle de domaine doit conserver des noms suffisamment précis pour permettre une extension future.

---

## ARCH-GLOSS-002

Les concepts génériques ne doivent pas remplacer trop tôt les concepts métier concrets.

Exemple :

```text
Apartment
```

est préférable à un modèle ultra-générique `Unit` tant que le produit cible principalement les appartements.

---

## ARCH-GLOSS-003

La couche UI peut utiliser un vocabulaire plus simple sans changer le nom technique du domaine.

---

## ARCH-GLOSS-004

Les noms techniques ne doivent pas changer simplement pour suivre une préférence stylistique locale.

Un changement de nom majeur doit être traité comme un refactor et évalué pour son impact.

---

# 123. Out of Scope

## OUT-GLOSS-001

Créer un vocabulaire générique couvrant toutes les possibilités du futur produit.

---

## OUT-GLOSS-002

Introduire des abstractions génériques uniquement pour éviter d'utiliser un terme métier clair.

---

## OUT-GLOSS-003

Changer les noms métier existants sans nécessité fonctionnelle ou architecturale.

---

## OUT-GLOSS-004

Utiliser plusieurs synonymes pour le même objet dans les différentes couches.

---

# 124. Definition of Done du glossaire

Une nouvelle fonctionnalité est correctement intégrée au langage du produit lorsque :

```text
[ ] Concept identifié
[ ] Terme officiel défini
[ ] Terme UI défini
[ ] Nom code défini
[ ] Nom database défini
[ ] API cohérente
[ ] Analytics cohérent
[ ] Tests cohérents
[ ] Documentation cohérente
```

---

# 125. Checklist Claude Code

Avant de créer un nouveau modèle, service ou composant :

```text
[ ] Le concept existe-t-il déjà ?
[ ] Quel est son terme officiel ?
[ ] Quel est son nom TypeScript ?
[ ] Quel est son nom database ?
[ ] Quel est son nom API ?
[ ] Quel est son terme UI ?
[ ] Est-ce réellement un nouveau concept ?
```

---

# 126. Règle finale

Le vocabulaire du produit doit être stable, simple et précis.

Une équipe qui utilise :

```text
Tenant
Property
Apartment
Lease
Rent
Payment
Charge
Incident
Intervention
Expense
```

de manière cohérente réduit fortement les ambiguïtés dans :

- le produit ;
- le design ;
- le code ;
- la base ;
- l'API ;
- les tests ;
- les échanges avec Claude Code.

Le principe directeur est :

> **Nommer correctement les concepts avant de les coder, puis utiliser ces noms de manière cohérente partout.**