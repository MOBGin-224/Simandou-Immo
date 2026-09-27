# Requirements Traceability & Coverage Matrix

## 1. Objet du document

Ce document établit la traçabilité entre les différentes couches de spécification du produit.

Il permet de répondre à une question essentielle :

> **Pour chaque exigence importante du MVP, savons-nous où elle est définie, où elle est implémentée, comment elle est testée et comment elle est validée ?**

La traçabilité relie :

```text id="w6uy2v"
Business Requirement
↓
Product Requirement
↓
Business Rule
↓
Data Model
↓
API / Backend
↓
UI / UX
↓
Security
↓
Tests
↓
UAT
↓
Release
```

Ce document sert principalement à éviter :

- les exigences oubliées ;
- les fonctionnalités partiellement développées ;
- les règles métier présentes dans un seul document mais absentes du code ;
- les écrans sans backend ;
- les APIs sans tests ;
- les règles de sécurité sans tests ;
- les fonctionnalités MVP développées sans justification.

---

# 2. Principes fondamentaux

## TRACE-001 : Toute exigence critique doit être traçable

Une exigence P0 ou P1 doit pouvoir être reliée à :

- une règle ;
- une implémentation ;
- un test ;
- un critère d'acceptation.

---

## TRACE-002 : Une trace n'est pas une implémentation

Le fait qu'une exigence apparaisse dans un document ne signifie pas qu'elle est développée.

Les statuts doivent distinguer clairement :

```text id="t5p0dy"
Documented
Planned
In Development
Implemented
Tested
Validated
Released
```

---

## TRACE-003 : La source de vérité doit être identifiable

Chaque exigence doit avoir un document principal de référence.

Exemple :

```text id="d7qltu"
Permission
→ Roles & Permissions Matrix

Payment allocation
→ Business Rules

Mobile behavior
→ UX Specification
```

---

## TRACE-004 : Une exigence ne doit pas être dupliquée inutilement

Un même besoin ne doit pas avoir plusieurs définitions contradictoires dans plusieurs documents.

---

# 3. Classification

## MVP

Exigence obligatoire.

Format :

```text
MVP-TRACE-XXX
```

## Future

Besoin futur.

Format :

```text
FUT-TRACE-XXX
```

## Architecture Constraint

Contrainte à anticiper.

Format :

```text
ARCH-TRACE-XXX
```

## Out of Scope

Exclu.

Format :

```text
OUT-TRACE-XXX
```

---

# 4. Statuts de couverture

Chaque exigence peut avoir les statuts suivants :

| Statut | Signification |
|---|---|
| DOCUMENTED | Exigence documentée |
| PLANNED | Tâche prévue |
| IN_PROGRESS | Développement en cours |
| IMPLEMENTED | Code implémenté |
| TESTED | Tests validés |
| UAT_VALIDATED | Validé par utilisateurs |
| RELEASED | Présent en production |
| BLOCKED | Bloqué par une dépendance |
| DEFERRED | Reporté |
| REJECTED | Refusé |

---

# 5. Périmètre fonctionnel principal

Le MVP est organisé autour de ces domaines :

```text id="p1q7di"
Auth
Organization
Properties
Apartments
Managers
Tenants
Leases
Rents
Payments
Receipts
Charges
Incidents
Interventions
Expenses
Notifications
Documents
Dashboards
Search
Activity
Audit
```

---

# 6. Traceability : Authentification

## MVP-TRACE-001

### Requirement

Le propriétaire peut créer et activer son compte.

### Sources

```text id="f4esqk"
PRD
User Flows
Security Specification
```

### Data

```text id="4fl45v"
users
```

### Backend

```text id="7ix2bi"
Authentication Service
Session Service
```

### UI

```text id="k9q4b6"
Sign Up
Activation
Login
```

### Security

- secure session ;
- password security ;
- rate limiting ;
- account recovery.

### Tests

- unit ;
- integration ;
- E2E ;
- security.

### UAT

Le propriétaire crée son compte sans assistance excessive.

---

# 7. Traceability : Organisation

## MVP-TRACE-002

### Requirement

Un utilisateur propriétaire dispose d'un contexte organisationnel isolé.

### Data

```text id="qd8cne"
organizations
```

### Backend

```text id="vjlqj7"
Organization Context
```

### Security

Isolation multi-tenant.

### Tests

```text id="rjnc3h"
Organization A
≠
Organization B
```

---

# 8. Traceability : Propriétaire

## MVP-TRACE-003

### Requirement

Le propriétaire possède l'autorité principale sur son patrimoine.

### Sources

- Roles & Permissions Matrix ;
- Security Specification.

### Backend

RBAC + Scope.

### Tests

- owner permission ;
- unauthorized access ;
- scope validation.

---

# 9. Traceability : Gestionnaire

## MVP-TRACE-004

### Requirement

Le propriétaire peut inviter un gestionnaire et lui attribuer un périmètre.

### Data

```text id="vlbhic"
users
user_access
manager_property_access
invitations
```

### API

```text id="m9ay3m"
Manager Invitation
Manager Access
Manager Scope
```

### UI

- Manager List ;
- Invite Manager ;
- Manager Detail ;
- Permission / Scope.

### Tests

- invitation ;
- activation ;
- scope ;
- revoke.

### UAT

Le gestionnaire active son compte et accède uniquement au périmètre prévu.

---

# 10. Traceability : Révocation

## MVP-TRACE-005

### Requirement

Le propriétaire peut révoquer un gestionnaire.

### Business Rule

La révocation :

- bloque les nouvelles actions ;
- préserve l'historique.

### Backend

Access Revocation Service.

### Security

Session/access revalidation.

### Tests

```text id="pw4jhr"
Revoked Manager
→ New Action
→ DENY
```

---

# 11. Traceability : Immeuble

## MVP-TRACE-006

### Requirement

Créer, consulter, modifier et archiver un immeuble.

### Data

```text id="5p3p7u"
properties
```

### API

```text
GET
POST
PATCH
ARCHIVE
```

### UI

- Property List ;
- Property Create ;
- Property Detail.

### Tests

- CRUD ;
- authorization ;
- isolation ;
- archive.

### UAT

Le propriétaire crée un immeuble sans assistance importante.

---

# 12. Traceability : Appartement

## MVP-TRACE-007

### Requirement

Gérer les appartements d'un immeuble.

### Data

```text id="epx40g"
apartments
```

### UI

- Apartment List ;
- Apartment Detail ;
- Apartment Create.

### Tests

- relation property ;
- permission ;
- status ;
- history.

---

# 13. Traceability : Locataire

## MVP-TRACE-008

### Requirement

Créer et inviter un locataire.

### Data

```text id="wsv9u9"
tenant_profiles
invitations
users
```

### Backend

Tenant Service.

### UI

- Tenant List ;
- Tenant Detail ;
- Invite Tenant.

### Security

Tenant isolation.

### Tests

- invitation ;
- activation ;
- access isolation.

---

# 14. Traceability : Relation User / Tenant

## MVP-TRACE-009

### Requirement

Un utilisateur et une relation locative ne doivent pas être confondus.

### Architecture

```text id="18f4jt"
User
≠
Tenant Profile
≠
Lease
```

### Tests

- changement de logement ;
- fin de contrat ;
- historique.

---

# 15. Traceability : Contrat

## MVP-TRACE-010

### Requirement

Créer et gérer un contrat locatif.

### Data

```text id="c9m7ph"
leases
```

### Business Rules

- dates ;
- statut ;
- conflit ;
- historique.

### UI

Lease Create / Detail / History.

### Tests

- active ;
- end ;
- conflict ;
- history.

### UAT

Le gestionnaire crée un contrat avec les informations attendues.

---

# 16. Traceability : Loyer

## MVP-TRACE-011

### Requirement

Générer les échéances de loyer.

### Data

```text id="ss9hu9"
rent_installments
```

### Business Rules

- période ;
- montant ;
- statut ;
- solde.

### Backend

Rent Generation Service.

### Tests

- génération ;
- duplicate prevention ;
- overdue ;
- partial payment.

---

# 17. Traceability : Paiement manuel

## MVP-TRACE-012

### Requirement

Enregistrer un paiement manuel.

### Data

```text id="m3gkqk"
payments
payment_allocations
```

### API

Payment Create.

### Security

Manager scope.

### Tests

- amount ;
- allocation ;
- permission ;
- audit.

### UAT

Le gestionnaire enregistre un paiement réel sans ambiguïté.

---

# 18. Traceability : Paiement digital

## MVP-TRACE-013

### Requirement

Intégrer un fournisseur de paiement externe.

### Architecture

```text id="bjgk2j"
Payment Domain
↓
Payment Service
↓
Payment Provider Adapter
```

### Security

- webhook signature ;
- idempotence ;
- provider reference.

### Tests

- payment creation ;
- pending ;
- success ;
- failure ;
- duplicate webhook.

### UAT

Le parcours réel ou sandbox fonctionne sans fausse confirmation.

---

# 19. Traceability : Allocation paiement

## MVP-TRACE-014

### Requirement

Associer un paiement à **une ou plusieurs créances**, de types différents (DEC-022).

### Business Rules

```text id="j2yawn"
Payment
↓
Allocations (loyer et/ou charge)
↓
Outstanding Balance par créance
↓
Total Outstanding du locataire
```

BR-038, BR-039, BR-041, BR-097.

### Tests

- allocation complète ;
- allocation partielle ;
- **allocation multi-créances loyer + charge** ;
- ordre d'allocation automatique déterministe ;
- **paiement supérieur au total dû refusé** avec `AMOUNT_EXCEEDS_OUTSTANDING` ;
- concurrence sur la même créance ;
- solde jamais négatif.

---

# 20. Traceability : Quittance

## MVP-TRACE-015

### Requirement

Générer une quittance à partir d'un paiement valide.

### Data

```text id="z3pys9"
receipts
```

### Security

Tenant access.

### Tests

- correct amount ;
- correct tenant ;
- correct period ;
- secure document.

---

# 21. Traceability : Charges

## MVP-TRACE-016

### Requirement

Créer et répartir une charge.

**La publication crée une créance payable par appartement** (DEC-005).

### Data

```text id="gsq1jn"
charges
charge_allocations       créance payable
payment_allocations      double FK exclusive
```

### Business Rule

BR-052, BR-055, BR-056, BR-086.

Répartition uniforme contrôlée, arrondi déterministe, publication atomique.

### Tests

```text id="6ux3po"
Sum allocations
=
Charge total
```

plus :

```text
Créance de charge payable par allocation
Paiement unique couvrant loyer + charge
Appartement vacant : créance sans locataire redevable
Republication refusée
```

### UAT

Le gestionnaire comprend le résultat avant publication.

Le locataire comprend sa part et son reste à payer.

---

# 22. Traceability : Incident

## MVP-TRACE-017

### Requirement

Le locataire peut déclarer un incident avec photo.

### Data

```text id="3vq6cw"
incidents
documents
```

### UI

Incident Create.

### Security

Document private access.

### Tests

- creation ;
- photo ;
- permissions ;
- status.

---

# 23. Traceability : Intervention

## MVP-TRACE-018

### Requirement

Le gestionnaire peut suivre l'intervention.

### States

Intervention, DEC-018 :

```text id="g3u9y5"
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

Incident, DEC-017, cycle **distinct** :

```text
OPEN
ASSIGNED
IN_PROGRESS
ON_HOLD
RESOLVED
CLOSED
```

### Tests

- validité des transitions sur chaque cycle séparément ;
- transition interdite rejetée avec `INVALID_STATE` ;
- la clôture d'une intervention ne clôture pas l'incident.

---

# 24. Traceability : Dépense

## MVP-TRACE-019

### Requirement

Enregistrer une dépense et son justificatif.

### Data

```text id="6zh91u"
expenses
documents
```

### Security

Scope based access.

### Tests

- amount ;
- association ;
- file ;
- authorization.

---

# 25. Traceability : Notifications

## MVP-TRACE-020

### Requirement

Notifier les utilisateurs lors d'événements importants.

### Sources

- Notification Specification ;
- External Integration Specification.

### Channels

- in-app ;
- SMS ;
- WhatsApp ;
- email selon disponibilité.

### Tests

- recipient ;
- content ;
- duplicate prevention ;
- failure handling.

---

# 26. Traceability : Rappels

## MVP-TRACE-021

### Requirement

Notifier les échéances et retards.

### Backend

Job / Scheduler.

### Tests

- timing ;
- retry ;
- idempotence ;
- no duplicate.

---

# 27. Traceability : Documents

## MVP-TRACE-022

### Requirement

Stocker et consulter des documents privés.

### Architecture

```text id="zpfkwv"
Storage Adapter
↓
Private Object Storage
↓
Signed Access
```

### Tests

- upload ;
- validation ;
- unauthorized access ;
- expiration.

---

# 28. Traceability : Dashboard propriétaire

## MVP-TRACE-023

### Requirement

Le propriétaire comprend rapidement l'état de son patrimoine.

### Data

Aggregations métier.

### UI

Owner Dashboard.

### Tests

- correct counters ;
- permission ;
- performance.

### UAT

Le propriétaire peut répondre rapidement à des questions fondamentales sur son patrimoine.

---

# 29. Traceability : Dashboard gestionnaire

## MVP-TRACE-024

### Requirement

Le gestionnaire voit uniquement les données opérationnelles de son périmètre.

### Security

Scope.

### Tests

- multi-property ;
- out-of-scope denial.

---

# 30. Traceability : Dashboard locataire

## MVP-TRACE-025

### Requirement

Le locataire voit :

- logement ;
- montant dû ;
- paiements ;
- charges ;
- incidents.

### Tests

- own data only ;
- payment state ;
- charge state.

---

# 31. Traceability : Recherche

## MVP-TRACE-026

### Requirement

Rechercher uniquement parmi les ressources accessibles.

### Security

Permission-first filtering.

### Tests

```text id="uwjeps"
Unauthorized data
→
Never returned
```

---

# 32. Traceability : Activity Log

## MVP-TRACE-027

### Requirement

Présenter les activités pertinentes.

### Data

```text id="zrq47m"
activity_logs
```

### Tests

- actor ;
- action ;
- timestamp ;
- resource.

---

# 33. Traceability : Audit Log

## MVP-TRACE-028

### Requirement

Tracer les opérations sensibles.

### Data

```text id="1h13yv"
audit_logs
```

### Tests

- payment correction ;
- permission change ;
- revocation ;
- contract modification.

---

# 34. Traceability : Multi-tenant isolation

## MVP-TRACE-029

### Requirement

Aucune organisation ne peut accéder aux données d'une autre.

### Coverage

```text id="lbzx2b"
API
Database Queries
Search
Documents
Exports
Notifications
Analytics
```

### Tests

Cette exigence est P0.

---

# 35. Traceability : Mobile First

## MVP-TRACE-030

### Requirement

Toutes les interfaces du MVP sont Responsive Mobile First.

### Coverage

Chaque écran critique doit posséder :

```text id="hqryqp"
Smartphone behavior
Tablet adaptation
Desktop adaptation
```

### Tests

- real smartphone ;
- browser mobile ;
- tablet ;
- desktop.

---

# 36. Traceability : Accessibilité

## MVP-TRACE-031

### Requirement

Les interfaces critiques doivent respecter les règles définies dans le Design System.

### Tests

- keyboard ;
- focus ;
- labels ;
- error messages ;
- touch usability.

---

# 37. Traceability : Validation serveur

## MVP-TRACE-032

### Requirement

Toutes les données externes sont validées côté serveur.

### Coverage

```text id="g1efmx"
Forms
API
Webhooks
Jobs
Uploads
```

### Tests

- invalid input ;
- boundary values ;
- malformed payload.

---

# 38. Traceability : Idempotence

## MVP-TRACE-033

### Requirement

Les opérations sensibles doivent résister aux répétitions.

### Coverage

- payment ;
- webhook ;
- reminder ;
- notification ;
- rent generation ;
- job execution.

### Tests

Exécuter deux fois la même opération et vérifier le résultat métier.

---

# 39. Traceability : Audit financier

## MVP-TRACE-034

### Requirement

Les corrections financières importantes sont traçables.

### Coverage

- payment ;
- allocation ;
- receipt ;
- charge ;
- expense.

### Tests

- actor ;
- timestamp ;
- action ;
- before/after selon le besoin.

---

# 40. Traceability : Backup

## MVP-TRACE-035

### Requirement

Les données critiques sont sauvegardées.

### Coverage

```text id="v9dr6c"
Database
```

### Tests

- backup ;
- restore.

---

# 41. Traceability : Monitoring

## MVP-TRACE-036

### Requirement

Le système permet de détecter les erreurs critiques.

### Coverage

- application ;
- database ;
- jobs ;
- payment ;
- notification ;
- storage.

### Tests

Déclencher des erreurs contrôlées et vérifier les alertes attendues.

---

# 42. Traceability : External Providers

## MVP-TRACE-037

### Requirement

Les fournisseurs externes sont isolés derrière des adapters.

### Coverage

```text id="bqur8x"
Payment
Messaging
Email
Storage
Auth
Analytics
```

### Tests

- adapter contract ;
- provider error mapping ;
- timeout ;
- retry.

---

# 43. Requirements Coverage Matrix

| Requirement | Data | Backend | API | UI | Security | Tests | UAT |
|---|---|---|---|---|---|---|---|
| Auth | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Organization | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Properties | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Apartments | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Managers | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Tenants | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Leases | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Rents | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Payments | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Receipts | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Charges | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Incidents | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Interventions | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Expenses | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Documents | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Dashboards | Indirect | Yes | Yes | Yes | Yes | Yes | Yes |
| Search | Indirect | Yes | Yes | Yes | Yes | Yes | Yes |
| Activity | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Audit | Yes | Yes | Yes | Limited | Yes | Yes | Indirect |

---

# 44. MVP Traceability Matrix globale

| ID | Domaine | Priorité | Source principale | Test requis | UAT requis |
|---|---|---:|---|---|---|
| MVP-TRACE-001 | Auth | P0 | Security / PRD | Oui | Oui |
| MVP-TRACE-002 | Organization | P0 | Data / RBAC | Oui | Oui |
| MVP-TRACE-003 | Owner | P0 | Permissions | Oui | Oui |
| MVP-TRACE-004 | Manager | P0 | User Flows | Oui | Oui |
| MVP-TRACE-005 | Revocation | P0 | Security | Oui | Oui |
| MVP-TRACE-006 | Property | P0 | PRD | Oui | Oui |
| MVP-TRACE-007 | Apartment | P0 | PRD / Data | Oui | Oui |
| MVP-TRACE-008 | Tenant | P0 | PRD | Oui | Oui |
| MVP-TRACE-009 | User/Tenant | P0 | Data | Oui | Oui |
| MVP-TRACE-010 | Lease | P0 | Business Rules | Oui | Oui |
| MVP-TRACE-011 | Rent | P0 | Business Rules | Oui | Oui |
| MVP-TRACE-012 | Manual Payment | P0 | Business Rules | Oui | Oui |
| MVP-TRACE-013 | Digital Payment | P0 | API / Security | Oui | Oui |
| MVP-TRACE-014 | Allocation | P0 | Business Rules | Oui | Oui |
| MVP-TRACE-015 | Receipt | P1 | PRD | Oui | Oui |
| MVP-TRACE-016 | Charges | P1 | Business Rules | Oui | Oui |
| MVP-TRACE-017 | Incident | P1 | User Flows | Oui | Oui |
| MVP-TRACE-018 | Intervention | P1 | Business Rules | Oui | Oui |
| MVP-TRACE-019 | Expense | P1 | PRD | Oui | Oui |
| MVP-TRACE-020 | Notification | P1 | Notifications | Oui | Oui |
| MVP-TRACE-021 | Reminder | P1 | Business Rules | Oui | Oui |
| MVP-TRACE-022 | Documents | P1 | Security | Oui | Oui |
| MVP-TRACE-023 | Owner Dashboard | P1 | UX | Oui | Oui |
| MVP-TRACE-024 | Manager Dashboard | P1 | UX | Oui | Oui |
| MVP-TRACE-025 | Tenant Dashboard | P1 | UX | Oui | Oui |
| MVP-TRACE-026 | Search | P2 | IA / UX | Oui | Oui |
| MVP-TRACE-027 | Activity | P2 | Security | Oui | Indirect |
| MVP-TRACE-028 | Audit | P0 | Security | Oui | Indirect |
| MVP-TRACE-029 | Isolation | P0 | Security | Oui | Oui |
| MVP-TRACE-030 | Mobile First | P0 | UX | Oui | Oui |
| MVP-TRACE-031 | Accessibility | P1 | UI | Oui | Oui |
| MVP-TRACE-032 | Server Validation | P0 | Security | Oui | Indirect |
| MVP-TRACE-033 | Idempotence | P0 | Business Rules | Oui | Indirect |
| MVP-TRACE-034 | Financial Audit | P0 | Security | Oui | Indirect |
| MVP-TRACE-035 | Backup | P0 | DevOps | Oui | Indirect |
| MVP-TRACE-036 | Monitoring | P1 | DevOps | Oui | Indirect |
| MVP-TRACE-037 | Provider Adapters | P1 | Architecture | Oui | Indirect |
| MVP-TRACE-038 | Créance de charge payable | P0 | DEC-005 / Business Rules | Oui | Oui |
| MVP-TRACE-039 | Total dû multi-créances | P0 | DEC-005 / UX | Oui | Oui |
| MVP-TRACE-040 | Refus du paiement excédentaire | P0 | DEC-023 / Business Rules | Oui | Oui |
| MVP-TRACE-041 | Modèle de permissions rôle + scope | P0 | DEC-025 / Security | Oui | Oui |
| MVP-TRACE-042 | Invitation par lien de partage | P1 | DEC-026 / User Flows | Oui | Oui |
| MVP-TRACE-043 | Notifications in-app uniquement | P1 | DEC-027 | Oui | Oui |

---

# 45. Coverage Rules

Une exigence P0 ne peut pas être considérée comme prête pour production si elle n'a pas au minimum :

```text id="j7ny4x"
Documentation
+
Implementation
+
Automated Test
+
Security Validation
+
Acceptance Criteria
```

Pour les parcours utilisateurs P0 :

```text id="7x9c4y"
Documentation
+
Implementation
+
Automated Test
+
Security Validation
+
UAT
```

---

# 46. Requirements without Tests

Une exigence sans test doit être considérée comme :

```text id="bq7f0m"
INCOMPLETE
```

sauf justification explicite.

---

# 47. Tests without Requirements

Un test important qui ne correspond à aucune exigence identifiée doit être examiné.

Il peut indiquer :

- une exigence manquante ;
- une règle implicite ;
- un test inutile ;
- une fonctionnalité non documentée.

---

# 48. Code without Requirement

Une fonctionnalité importante présente dans le code mais absente du périmètre doit être classée :

```text id="b8qkpa"
MVP
FUTURE
ARCHITECTURE
OUT
```

Elle ne doit pas rester un comportement non documenté.

---

# 49. API Coverage

Pour chaque route critique, vérifier :

```text id="5x2s2x"
Requirement
↓
Route
↓
Authorization
↓
Validation
↓
Business Rule
↓
Test
```

---

# 50. Database Coverage

Pour chaque table métier importante :

```text id="lsj9n5"
Requirement
↓
Entity
↓
Relations
↓
Constraints
↓
Indexes
↓
Migration
↓
Tests
```

---

# 51. UI Coverage

Pour chaque écran critique :

```text id="qum1c6"
Requirement
↓
Screen
↓
Components
↓
States
↓
Responsive
↓
Accessibility
↓
E2E / UAT
```

---

# 52. Security Coverage

Pour chaque opération protégée :

```text id="qv5n4j"
Authentication
↓
Organization
↓
Role
↓
Scope
↓
Permission
↓
Resource
↓
Action
↓
Test
```

---

# 53. Payment Coverage

Chaque opération de paiement critique doit être couverte par :

```text id="oxm7kh"
Business Rule
+
Database
+
API
+
Provider
+
Webhook
+
Idempotency
+
Audit
+
Tests
+
Monitoring
```

---

# 54. Document Coverage

Chaque document privé doit être couvert par :

```text id="qg4qg5"
Upload
+
Storage
+
Authorization
+
Signed Access
+
Expiration
+
Audit when needed
+
Test
```

---

# 55. Notification Coverage

Chaque notification critique doit être reliée à :

```text id="t6wse1"
Business Event
↓
Notification Rule
↓
Notification Record
↓
Provider
↓
Delivery
↓
Retry
↓
Monitoring
```

---

# 56. Future Evolutions

Les futures fonctionnalités doivent disposer de leur propre traçabilité lorsqu'elles entrent effectivement dans le backlog.

Exemples :

```text id="2r7srx"
Native Mobile
Advanced Accounting
Copropriété
Multi-country
AI
Advanced Analytics
```

Elles ne doivent pas être considérées comme "partiellement développées" simplement parce que l'architecture actuelle permet leur ajout futur.

---

# 57. Architecture Constraints

Les contraintes suivantes doivent également être traçables :

## ARCH-TRACE-001

Payment provider abstraction.

## ARCH-TRACE-002

Notification provider abstraction.

## ARCH-TRACE-003

Storage abstraction.

## ARCH-TRACE-004

User / Role / Relationship separation.

## ARCH-TRACE-005

Historical data preservation.

## ARCH-TRACE-006

Mobile First responsive architecture.

## ARCH-TRACE-007

Modular monolith boundaries.

---

# 58. Out of Scope

Les éléments hors périmètre ne doivent pas être suivis comme des tâches de développement actives.

Exemples :

```text id="d1h1yo"
OUT-TRACE-001
Microservices MVP

OUT-TRACE-002
Native Apps MVP

OUT-TRACE-003
Full Accounting MVP

OUT-TRACE-004
Full Copropriété MVP
```

Ils doivent simplement rester documentés comme exclus.

---

# 59. Release Traceability

Avant une release, le responsable du développement doit pouvoir déterminer :

```text id="wl23y2"
Quelles exigences sont incluses ?
Quelles sont implémentées ?
Quels tests passent ?
Quels risques existent ?
Quelles exigences sont encore différées ?
```

---

# 60. Release Coverage Report

Une release peut produire un résumé :

```text id="8v0wzq"
MVP Requirements:
42

Implemented:
42

Tested:
42

UAT Validated:
38

Deferred:
X

Blocked:
Y
```

Les chiffres réels seront générés à partir du backlog réel.

---

# 61. Change Impact Analysis

Lorsqu'une exigence change, rechercher systématiquement :

```text id="p0h8q1"
Requirement
↓
Business Rule
↓
Data
↓
API
↓
UI
↓
Security
↓
Tests
↓
UAT
↓
Documentation
```

Cela évite qu'une petite modification métier laisse des incohérences dans d'autres couches.

---

# 62. Exemple de changement

Supposons :

> Le propriétaire peut modifier le loyer d'un contrat actif.

Avant implémentation, vérifier :

```text id="0xj9br"
Business Rules
↓
Lease
↓
Rent Installments
↓
Payment Balance
↓
Audit
↓
Dashboard
↓
Notifications
↓
Tests
```

Une modification de loyer peut donc avoir des conséquences plus importantes qu'une simple modification de formulaire.

---

# 63. Change Request Classification

Toute nouvelle demande peut être classée :

```text id="3j2rki"
BUG
CHANGE
NEW MVP
FUTURE
ARCHITECTURE
OUT
```

---

# 64. Definition of Done Traceability

Une exigence est considérée comme complètement couverte lorsque :

```text id="mpb4os"
[ ] Documentée
[ ] Classifiée
[ ] Implémentée
[ ] Testée
[ ] Sécurisée
[ ] Validée si nécessaire
[ ] Documentée dans la release
```

---

# 65. Traceability Audit

Avant le lancement du MVP, effectuer une vérification globale :

```text id="73i3sa"
Requirements
↓
Backlog
↓
Code
↓
Tests
↓
UAT
↓
Release
```

Toute rupture de chaîne doit être examinée.

---

# 66. Checklist de clôture MVP

```text id="x80m0k"
## Product
[ ] Tous les parcours P0 couverts

## Backend
[ ] Tous les services critiques couverts

## API
[ ] Toutes les routes critiques couvertes

## Database
[ ] Tous les modèles critiques couverts

## Security
[ ] Isolation testée
[ ] Permissions testées
[ ] IDOR testé
[ ] Audit testé

## Frontend
[ ] Tous les écrans P0 couverts
[ ] Mobile First validé
[ ] États UI couverts

## QA
[ ] Unit
[ ] Integration
[ ] E2E
[ ] Security
[ ] Regression

## UAT
[ ] Owner
[ ] Manager
[ ] Tenant

## DevOps
[ ] Monitoring
[ ] Backup
[ ] Restore
[ ] Deployment
```

---

# 67. Principe final

La traçabilité n'a pas pour objectif de créer de la bureaucratie.

Elle sert à éviter un problème beaucoup plus coûteux :

> croire qu'une fonctionnalité est terminée parce que le code existe, alors qu'une règle métier, une permission, un test ou un parcours utilisateur manque encore.

La chaîne de référence est :

```text id="k1a4y5"
Requirement
↓
Design
↓
Implementation
↓
Security
↓
Test
↓
UAT
↓
Release
```

Le principe directeur est :

> **Aucune exigence importante du MVP ne doit disparaître entre le document, le code et le produit réel.**