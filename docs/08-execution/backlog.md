# MVP Development Backlog & Claude Code Execution Specification

## 1. Objet du document

Ce document transforme les spécifications précédentes en backlog d'exécution concret pour le développement du produit avec Claude Code.

Il sert à :

- découper le MVP en lots de développement ;
- ordonner les tâches ;
- identifier les dépendances ;
- éviter les développements prématurés ;
- définir ce que Claude Code doit construire ;
- définir les critères d'acceptation ;
- fournir un cadre de validation entre chaque étape ;
- préparer une progression contrôlée vers la production.

Ce document ne remplace pas les spécifications fonctionnelles, techniques ou de sécurité.

Il les transforme en plan d'exécution.

---

# 2. Périmètre de référence

Les documents de référence sont :

```text
0.  Product & Technical Decision Register      <- autorité sur les décisions
1.  Master Product Specification               <- autorité sur le périmètre
2.  MVP Scope & Feature Matrix
3.  Product Vision / Concept Note
4.  Product Requirements Document
5.  User Flows
6.  Information Architecture
7.  Roles & Permissions Matrix
8.  Business Rules
9.  Domain Glossary & Naming Specification
10. Product UX Specification
11. Design System / UI Specification
12. Component Specification
13. API & Backend Specification
14. Database Schema & Migration Specification   <- tient lieu de modèle de données
15. Security & Access Control Specification
16. Technical Decision Records & Architecture Governance
17. Engineering Standards & Codebase Guidelines
18. External Integrations & Third-Party Services
19. Development Specification & Implementation Plan
20. Testing Strategy & QA Specification
21. Deployment & DevOps Specification
```

> **Documents inexistants, DEC-030**
>
> | Référence ancienne | Résolution |
> |---|---|
> | *Data Model* | Remplacé par **Database Schema & Migration Specification** |
> | *Technical Architecture* | Couvert par Master §22 + Architecture Governance + Development Spec §3 |
> | *Screen & UX Specification* | **Lacune reconnue.** À produire au Milestone 2, écran par écran, avant les tickets UI correspondants. |

Le présent document constitue le plan d'exécution qui s'appuie sur ces références.

---

# 3. Règle absolue du backlog

Une tâche peut être développée uniquement lorsque :

```text
Objectif connu
+
Scope connu
+
Dépendances disponibles
+
Règles métier connues
+
Permission connue
+
Critères d'acceptation connus
```

Si une information importante manque, Claude Code doit identifier le manque avant de produire une implémentation qui pourrait créer une dette structurelle.

---

# 4. Classification

Chaque élément du backlog est classé :

### MVP

Obligatoire avant lancement.

Format :

```text
MVP-BACKLOG-XXX
```

### Future Evolution

À ne pas développer pendant le MVP.

Format :

```text
FUT-BACKLOG-XXX
```

### Architecture Constraint

À anticiper sans nécessairement implémenter.

Format :

```text
ARCH-BACKLOG-XXX
```

### Out of Scope

Explicitement exclu.

Format :

```text
OUT-BACKLOG-XXX
```

---

# 5. Méthode de développement

Le produit doit être développé par **vertical slices**.

Une tranche fonctionnelle suit :

```text
Database
↓
Domain Logic
↓
Backend
↓
Authorization
↓
Frontend
↓
Tests
↓
Validation
```

Il ne faut pas construire tout le frontend avant le backend ou l'inverse.

---

# 6. Lot 0 : Initialisation du projet

## MVP-BACKLOG-001 : Repository

### Objectif

Créer le repository principal du produit.

### Tâches

- initialiser Git ;
- initialiser Next.js ;
- activer TypeScript strict ;
- configurer lint ;
- configurer formatage ;
- configurer scripts ;
- créer README technique initial.

### Dépendances

Aucune.

### Validation

```text
npm run dev
npm run lint
npm run typecheck
npm run build
```

fonctionnent.

---

## MVP-BACKLOG-002 : Structure projet

Créer la structure logique :

```text
app/
components/
modules/
lib/
db/
tests/
```

Créer uniquement les dossiers nécessaires.

Ne pas générer artificiellement tous les modules avant leur utilisation.

---

## MVP-BACKLOG-003 : CI initiale

Mettre en place :

- installation ;
- lint ;
- typecheck ;
- tests ;
- build.

### Critère

Une Pull Request invalide doit être bloquée par la CI.

---

# 7. Lot 1 : Base technique

## MVP-BACKLOG-004 : PostgreSQL

Configurer :

- connexion ;
- Drizzle ;
- migration ;
- environnement local ;
- environnement test.

---

## MVP-BACKLOG-005 : Schéma initial

Implémenter les premières entités :

```text
organizations
users
user_access
properties
manager_property_access
apartments
```

Aucune table `roles` : le rôle est un enum sur `user_access` (DEC-021, Database Schema §8).

Aucune table `permissions` ni `access_permissions` (DEC-025).

Tous les enums du MVP sont créés dans la migration 001.

---

## MVP-BACKLOG-006 : Seed

Créer :

```text
Organization A
Owner A
Property A
Apartment A01
Apartment A02
Apartment A03

Organization B          <- obligatoire
Owner B
Property B
```

La **seconde organisation est obligatoire dès ce lot** : sans elle, les tests d'isolation multi-tenant du Lot 3 ne peuvent pas être écrits.

---

## MVP-BACKLOG-007 : Test database

Créer les premiers tests de :

- connexion ;
- migration ;
- création ;
- lecture ;
- relation.

---

# 8. Lot 2 : Authentification

## MVP-BACKLOG-008 : Authentification

Intégrer **Better Auth** avec son adaptateur Drizzle (DEC-032).

### Exigences

- tables `accounts`, `sessions`, `verifications` dans notre PostgreSQL, créées par nos migrations ;
- `users` sert de modèle utilisateur, avec ses champs métier en champs additionnels ;
- identification par **téléphone et mot de passe** ;
- connexion, déconnexion, session, expiration de session ;
- changement de mot de passe ;
- révocation individuelle de session ;
- service interne `getCurrentUser`, `getSession`, `requireAuthenticatedUser`, `signOut` ;
- aucun appel direct à Better Auth depuis un module métier.

### Hors périmètre de ce ticket

- OTP SMS ou WhatsApp, reporté avec DEC-008 ;
- récupération autonome par le locataire : au MVP, un utilisateur autorisé régénère un lien d'activation (DEC-026).

### Vérification préalable

Confirmer la compatibilité de la version installée avec Next.js 16 et React 19. Une incompatibilité bloquante doit être portée au registre de décisions, jamais contournée silencieusement.

---

## MVP-BACKLOG-009 : User Profile

Créer la gestion de :

- nom ;
- téléphone ;
- email ;
- statut ;
- timestamps.

---

## MVP-BACKLOG-010 : Auth Tests

Tester :

- login correct ;
- login incorrect ;
- logout ;
- session expirée ;
- accès sans session.

---

# 9. Lot 3 : Organisation et permissions

## MVP-BACKLOG-011 : Organization Context

Chaque requête métier doit être capable de déterminer :

```text
User
↓
Organization
```

---

## MVP-BACKLOG-012 : RBAC

Implémenter :

```text
OWNER
MANAGER
TENANT
```

---

## MVP-BACKLOG-013 : Permission Service

Créer un service central :

```text
can(user, permission, resource)
```

---

## MVP-BACKLOG-014 : Scope Manager

Permettre d'associer un gestionnaire à un ou plusieurs immeubles.

---

## MVP-BACKLOG-015 : Security Tests

Tester :

```text
Organization A → Organization B = DENY
Manager → Property hors scope = DENY
Tenant → Property = DENY
```

---

# 10. Lot 4 : Immeubles

## MVP-BACKLOG-016 : Property Domain

Créer le modèle métier d'un immeuble.

---

## MVP-BACKLOG-017 : Property API

Implémenter :

```text
GET
POST
PATCH
ARCHIVE
```

selon les conventions de l'API.

---

## MVP-BACKLOG-018 : Property UI

Créer :

- liste ;
- création ;
- détail ;
- modification ;
- archivage.

### Responsive

Smartphone d'abord.

---

## MVP-BACKLOG-019 : Property Tests

Tester :

- création ;
- modification ;
- archivage ;
- permissions ;
- isolation.

---

# 11. Lot 5 : Appartements

## MVP-BACKLOG-020 : Apartment Domain

Créer :

- appartement ;
- référence ;
- immeuble ;
- statut ;
- paramètres nécessaires.

---

## MVP-BACKLOG-021 : Apartment API

Créer les opérations nécessaires.

---

## MVP-BACKLOG-022 : Apartment UI

Créer :

- liste ;
- création ;
- détail ;
- modification.

---

## MVP-BACKLOG-023 : Apartment Context

La fiche appartement doit devenir le contexte permettant d'accéder à :

```text
Tenant
Lease
Rent
Payment
Charge
Incident
History
```

---

# 12. Lot 6 : Gestionnaires

## MVP-BACKLOG-024 : Manager Model

Créer la relation :

```text
User
+
Role
+
Property Scope
+
Permissions
```

---

## MVP-BACKLOG-025 : Invitation Manager

Implémenter :

- génération ;
- expiration ;
- révocation ;
- acceptation ;
- activation.

---

## MVP-BACKLOG-026 : Manager UI

Créer :

- liste ;
- détail ;
- invitation ;
- modification du périmètre ;
- révocation.

---

## MVP-BACKLOG-027 : Manager Tests

Tester :

- invitation ;
- activation ;
- expiration ;
- révocation ;
- scope.

---

# 13. Lot 7 : Locataires

## MVP-BACKLOG-028 : Tenant Profile

Créer le profil locataire séparément du User.

Principe :

```text
User
≠
Tenant Relationship
```

---

## MVP-BACKLOG-029 : Tenant API

Permettre :

- création ;
- modification ;
- consultation ;
- invitation.

---

## MVP-BACKLOG-030 : Tenant UI

Créer :

- liste ;
- détail ;
- invitation ;
- activation.

---

## MVP-BACKLOG-031 : Tenant Isolation

Tester qu'un locataire :

- ne voit que son contexte ;
- ne peut pas accéder aux données d'un autre locataire.

---

# 14. Lot 8 : Contrats

## MVP-BACKLOG-032 : Lease Model

Créer :

- tenant ;
- apartment ;
- dates ;
- montant ;
- statut.

---

## MVP-BACKLOG-033 : Lease Rules

Implémenter :

- contrat actif ;
- fin de contrat ;
- historique ;
- impossibilité des conflits interdits.

---

## MVP-BACKLOG-034 : Lease API

CRUD selon permissions.

---

## MVP-BACKLOG-035 : Lease UI

Créer :

- création ;
- détail ;
- historique ;
- changement de statut.

---

# 15. Lot 9 : Loyers

## MVP-BACKLOG-036 : Rent Installment Model

Créer l'échéance de loyer.

---

## MVP-BACKLOG-037 : Rent Generation

Générer les échéances selon les contrats actifs.

---

## MVP-BACKLOG-038 : Rent Status Engine

Implémenter :

```text
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

---

## MVP-BACKLOG-039 : Rent UI

Créer :

- liste ;
- détail ;
- statut ;
- solde ;
- historique.

---

# 16. Lot 10 : Charges communes

## MVP-BACKLOG-051 : Charge Model

Créer :

- charge ;
- période ;
- montant ;
- immeuble ;
- statut.

---

## MVP-BACKLOG-052 : Charge Allocation

> **DEC-005, décision verrouillée.**

La publication d'une charge crée une **créance payable** par appartement.

Implémenter :

- répartition uniforme (`EQUAL` uniquement, DEC-029) ;
- arrondi déterministe, une unité par logement dans l'ordre de référence ;
- contrôle de l'invariant `somme des parts = total` ;
- création des créances avec montant dû, solde, date d'échéance et statut ;
- gestion de l'appartement vacant (créance sans locataire redevable) ;
- publication atomique et non rejouable.

---

## MVP-BACKLOG-053 : Charge Preview

Avant publication :

```text
Total
+
Nombre de logements
+
Part de chaque logement
```

---

## MVP-BACKLOG-054 : Charge UI

Créer :

- liste ;
- création ;
- preview ;
- publication ;
- détail.

---

# 17. Lot 11 : Paiements

## MVP-BACKLOG-040 : Payment Model

Créer :

- paiement ;
- méthode ;
- référence ;
- montant ;
- période ;
- utilisateur ;
- statut.

---

## MVP-BACKLOG-041 : Manual Payment

Permettre l'enregistrement manuel.

---

## MVP-BACKLOG-042 : Payment Allocation

> **DEC-022, conséquence de DEC-005.**

Implémenter l'allocation entre un paiement et **une ou plusieurs créances**, de types différents.

```text
payment_allocations
  rent_installment_id   OU  charge_allocation_id   (exclusif)
```

Inclut :

- l'ordre d'allocation automatique déterministe ;
- la vérification des invariants de solde ;
- le refus du paiement supérieur au total dû (`AMOUNT_EXCEEDS_OUTSTANDING`).

**Dépendance** : ce ticket nécessite que `charge_allocations` existe déjà. Le Lot 12 (Charges) doit donc précéder l'allocation complète, ou le ticket doit être découpé.

---

## MVP-BACKLOG-043 : Idempotency

Implémenter la protection contre les doublons.

---

## MVP-BACKLOG-044 : Payment Provider Adapter

Créer l'abstraction :

```text
PaymentProvider
```

et son premier adaptateur réel lors de l'intégration du fournisseur choisi.

---

## MVP-BACKLOG-045 : Payment Webhook

Créer :

- endpoint ;
- authentification ;
- validation ;
- idempotence ;
- mise à jour du paiement.

---

## MVP-BACKLOG-046 : Payment UI

Créer :

- paiement ;
- confirmation ;
- statut ;
- historique ;
- détail.

---

## MVP-BACKLOG-047 : Payment Tests

Tester obligatoirement :

- paiement complet ;
- partiel ;
- doublon ;
- webhook répété ;
- transaction en attente ;
- accès non autorisé.

---

# 18. Lot 12 : Quittances

## MVP-BACKLOG-048 : Receipt Model

Créer la relation :

```text
Payment
↓
Receipt
```

---

## MVP-BACKLOG-049 : Receipt Generation

Générer la quittance selon les règles métier.

---

## MVP-BACKLOG-050 : Receipt UI

Le locataire doit pouvoir consulter ses quittances.

---

# 19. Lot 13 : Incidents

## MVP-BACKLOG-055 : Incident Model

Créer :

- titre ;
- description ;
- priorité ;
- statut ;
- logement ;
- créateur ;
- photos.

---

## MVP-BACKLOG-056 : Incident API

Créer les opérations nécessaires.

---

## MVP-BACKLOG-057 : Incident UI

Créer :

- déclaration ;
- liste ;
- détail ;
- photos ;
- statut.

---

# 20. Lot 14 : Interventions

## MVP-BACKLOG-058 : Intervention Model

Créer :

- intervenant ;
- incident ;
- estimation ;
- coût ;
- statut ;
- dates.

---

## MVP-BACKLOG-059 : Intervention Workflow

> **DEC-018** : l'intervention a un cycle **distinct** de l'incident.

```text
PLANNED
→ IN_PROGRESS
→ COMPLETED
```

ou `CANCELLED`.

Le cycle de l'**incident** (`OPEN → ASSIGNED → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED`) appartient au ticket MVP-BACKLOG-056.

La clôture d'une intervention ne clôture pas automatiquement l'incident.

---

## MVP-BACKLOG-060 : Intervention UI

Créer le suivi opérationnel.

---

# 21. Lot 15 : Dépenses

## MVP-BACKLOG-061 : Expense Model

Créer :

- montant ;
- catégorie ;
- fournisseur ;
- immeuble ;
- intervention ;
- justificatif.

---

## MVP-BACKLOG-062 : Expense API

Créer les opérations nécessaires.

---

## MVP-BACKLOG-063 : Expense UI

Créer :

- liste ;
- création ;
- détail ;
- historique.

---

# 22. Lot 16 : Documents

## MVP-BACKLOG-064 : Storage Provider

Créer l'adaptateur de stockage.

---

## MVP-BACKLOG-065 : Secure Upload

Implémenter :

- validation ;
- taille ;
- type ;
- stockage privé.

---

## MVP-BACKLOG-066 : Secure Download

Utiliser un accès temporaire lorsque nécessaire.

---

# 23. Lot 17 : Notifications

## MVP-BACKLOG-067 : Notification Model

Créer :

- destinataire ;
- type ;
- statut ;
- contenu ;
- ressource liée.

---

## MVP-BACKLOG-068 : In-App Notifications

Créer le centre de notifications.

---

## MVP-BACKLOG-069 : Notification Jobs

Mettre en place les jobs pour :

- invitations ;
- rappels ;
- paiements ;
- incidents ;
- charges.

---

## MVP-BACKLOG-070 : Provider Adapters

> **DEC-008, DEC-027** : au MVP, ces adapters sont **inertes**.

Encapsuler derrière `NotificationProvider` :

```text
Email       adapter inerte journalisé
SMS         adapter inerte journalisé
WhatsApp    adapter inerte journalisé
```

Un adapter inerte respecte l'interface, journalise l'appel, et retourne un échec explicite.

Il ne doit **jamais** simuler un succès.

Le seul canal actif au MVP est `IN_APP`.

---

# 24. Lot 18 : Rappels

## MVP-BACKLOG-071 : Rent Reminder Engine

Créer les règles :

```text
Avant échéance
Échéance
Après échéance
```

---

## MVP-BACKLOG-072 : Reminder Idempotence

Éviter les répétitions inutiles.

---

# 25. Lot 19 : Dashboards

## MVP-BACKLOG-073 : Owner Dashboard

Afficher les indicateurs essentiels du patrimoine.

---

## MVP-BACKLOG-074 : Manager Dashboard

Afficher les éléments opérationnels du périmètre.

---

## MVP-BACKLOG-075 : Tenant Dashboard

Afficher :

- logement ;
- montant à payer ;
- statut ;
- paiements ;
- charges ;
- incidents.

---

# 26. Lot 20 : Activity & Audit

## MVP-BACKLOG-076 : Activity Log

Créer l'activité visible dans le produit.

---

## MVP-BACKLOG-077 : Audit Log

Enregistrer les opérations sensibles.

---

## MVP-BACKLOG-078 : Audit Security Tests

Tester qu'un utilisateur non autorisé ne peut pas :

- supprimer ;
- modifier ;
- contourner ;

les données d'audit selon les règles définies.

---

# 27. Lot 21 : Recherche

## MVP-BACKLOG-079 : Search Service

Créer la recherche contextualisée.

---

## MVP-BACKLOG-080 : Search UI

Recherche mobile first.

---

## MVP-BACKLOG-081 : Search Security

Les résultats doivent être filtrés selon les droits avant retour.

---

# 28. Lot 22 : États UX

Chaque écran critique doit implémenter :

```text
Loading
Empty
Success
Error
Unauthorized
Not Found
```

## MVP-BACKLOG-082 : UI State System

Créer les composants réutilisables.

---

# 29. Lot 23 : Design System Implementation

## MVP-BACKLOG-083 : Tokens

Implémenter les tokens définis dans le Design System final.

Les valeurs visuelles définitives seront établies avec la charte graphique.

---

## MVP-BACKLOG-084 : Core Components

Implémenter au minimum les composants nécessaires :

- Button ;
- Input ;
- Select ;
- Search ;
- Card ;
- Badge ;
- Modal ;
- Bottom Sheet ;
- Alert ;
- Toast ;
- Tabs ;
- Navigation ;
- Form components.

---

## MVP-BACKLOG-085 : Domain Components

Implémenter progressivement :

- PropertyCard ;
- ApartmentCard ;
- TenantCard ;
- PaymentCard ;
- RentSummary ;
- ChargeCard ;
- IncidentCard ;
- InterventionCard.

---

# 30. Lot 24 : Responsive Mobile First

## MVP-BACKLOG-086 : Mobile Foundation

Définir :

- breakpoints ;
- navigation ;
- spacing ;
- layout ;
- interactions tactiles.

---

## MVP-BACKLOG-087 : Smartphone Validation

Tous les parcours P0 doivent fonctionner sur smartphone.

---

## MVP-BACKLOG-088 : Tablet Adaptation

Adapter :

- listes ;
- grilles ;
- navigation ;
- formulaires.

---

## MVP-BACKLOG-089 : Desktop Adaptation

Adapter :

- tableaux ;
- densité ;
- navigation ;
- espaces.

---

# 31. Lot 25 : Tests de sécurité

## MVP-BACKLOG-090 : Isolation Tests

Tester l'isolation organisationnelle.

---

## MVP-BACKLOG-091 : RBAC Tests

Tester les permissions par rôle.

---

## MVP-BACKLOG-092 : Scope Tests

Tester les restrictions de périmètre.

---

## MVP-BACKLOG-093 : IDOR Tests

Tester les identifiants manipulés.

---

## MVP-BACKLOG-094 : Privilege Escalation Tests

Tester :

```text
TENANT → MANAGER
MANAGER → OWNER
```

---

# 32. Lot 26 : Tests End-to-End

Automatiser les parcours :

## MVP-BACKLOG-095

Owner onboarding.

## MVP-BACKLOG-096

Manager invitation.

## MVP-BACKLOG-097

Tenant invitation.

## MVP-BACKLOG-098

Lease creation.

## MVP-BACKLOG-099

Rent cycle.

## MVP-BACKLOG-100

Payment.

## MVP-BACKLOG-101

Charge.

## MVP-BACKLOG-102

Incident.

## MVP-BACKLOG-103

Intervention.

## MVP-BACKLOG-104

Revocation.

---

# 33. Lot 27 : Performance

## MVP-BACKLOG-105 : Performance Baseline

Mesurer :

- chargement initial ;
- dashboard ;
- listes ;
- détail ;
- API principales.

---

## MVP-BACKLOG-106 : Optimization

Corriger les principaux problèmes détectés :

- images ;
- requêtes ;
- bundle ;
- cache ;
- rendu inutile.

---

# 34. Lot 28 : Production Readiness

## MVP-BACKLOG-107 : Monitoring

Configurer :

- error tracking ;
- logs ;
- métriques essentielles.

---

## MVP-BACKLOG-108 : Backups

Configurer les sauvegardes.

---

## MVP-BACKLOG-109 : Restore Test

Réaliser un test réel de restauration en environnement contrôlé.

---

## MVP-BACKLOG-110 : Runbook

Documenter :

- déploiement ;
- rollback ;
- migration ;
- restauration ;
- incident.

---

# 35. Lot 29 : Staging

## MVP-BACKLOG-111 : Staging Environment

Déployer :

- application ;
- database ;
- storage ;
- jobs ;
- providers de test.

---

## MVP-BACKLOG-112 : Staging E2E

Exécuter les parcours critiques dans staging.

---

## MVP-BACKLOG-113 : Security Gate

Vérifier :

- auth ;
- permissions ;
- isolation ;
- paiements ;
- fichiers ;
- webhooks.

---

# 36. Lot 30 : Production

## MVP-BACKLOG-114 : Production Configuration

Vérifier :

- domaine ;
- HTTPS ;
- variables ;
- secrets ;
- database ;
- storage ;
- monitoring.

---

## MVP-BACKLOG-115 : Production Migration

Exécuter les migrations validées.

---

## MVP-BACKLOG-116 : Production Deployment

Déployer le MVP.

---

## MVP-BACKLOG-117 : Smoke Tests

Vérifier immédiatement :

- connexion ;
- dashboard ;
- immeuble ;
- locataire ;
- paiement ;
- incident.

---

# 37. Ordre strict recommandé

Le développement suit la numérotation des lots définie aux sections 6 à 36.

Il n'existe **qu'une seule numérotation** dans ce document.

```text
Lot 0    Initialisation du projet
Lot 1    Base technique
Lot 2    Authentification
Lot 3    Organisation et permissions
Lot 4    Immeubles
Lot 5    Appartements
Lot 6    Gestionnaires
Lot 7    Locataires
Lot 8    Contrats
Lot 9    Loyers                    créances de loyer
Lot 10   Charges communes          créances de charge
Lot 11   Paiements                 allocation multi-créances
Lot 12   Quittances
Lot 13   Incidents
Lot 14   Interventions
Lot 15   Dépenses
Lot 16   Documents
Lot 17   Notifications
Lot 18   Rappels
Lot 19   Dashboards
Lot 20   Activity & Audit
Lot 21   Recherche
Lot 22   États UX
Lot 23   Design System Implementation
Lot 24   Responsive Mobile First
Lot 25   Tests de sécurité
Lot 26   Tests End-to-End
Lot 27   Performance
Lot 28   Production Readiness
Lot 29   Staging
Lot 30   Production
```

> **Réordonnancement appliqué, DEC-005 / DEC-022**
>
> Les **Charges** passent avant les **Paiements**.
>
> Une allocation de paiement référence soit une créance de loyer, soit une créance de charge. Traiter les paiements en premier obligerait à écrire le moteur d'allocation deux fois.
>
> Les sections 16, 17 et 18 de ce document sont renumérotées en conséquence : Loyers (Lot 9), Charges (Lot 10), Paiements (Lot 11), Quittances (Lot 12).

---

# 38. Dépendances principales

```text
Auth
  ↓
Organization
  ↓
Authorization
  ↓
Property
  ↓
Apartment
  ↓
Tenant / Manager
  ↓
Lease
  ↓
Rent            créance de loyer
  ↓
Charge          créance de charge
  ↓
Payment         allocation multi-créances
  ↓
Receipt
```

> **Pourquoi Charges avant Payments, DEC-005 / DEC-022**
>
> Une allocation de paiement référence soit une créance de loyer, soit une créance de charge.
>
> Implémenter les paiements avant les charges obligerait à écrire le moteur d'allocation deux fois : une première version ne gérant que le loyer, puis une reprise complète.
>
> En plaçant les charges avant les paiements, le moteur d'allocation est écrit **une seule fois**, dans sa forme définitive.
>
> Cet ordre diffère de celui des versions précédentes du document. Il en est la correction.

Branche maintenance :

```text
Property / Apartment
        ↓
     Incident
        ↓
   Intervention
        ↓
      Expense
```

Branche charges :

```text
Property
  ↓
Charge
  ↓
Allocation
  ↓
Tenant View
```

---

# 39. Tâches pouvant être développées en parallèle

Après les fondations et permissions, certaines tâches peuvent progresser parallèlement.

### Flux A

```text
Properties
→ Apartments
```

### Flux B

```text
Managers
→ Invitations
```

### Flux C

```text
Tenant
→ Invitation
```

### Flux D

```text
Incident
→ Intervention
→ Expense
```

Les développements parallèles doivent utiliser des contrats techniques clairement définis afin d'éviter les conflits.

---

# 40. Definition of Ready

Une tâche est prête à être donnée à Claude Code lorsque :

```text
[ ] Objectif défini
[ ] Scope défini
[ ] Non-scope défini
[ ] Dépendances disponibles
[ ] Tables connues
[ ] API connue
[ ] Permissions connues
[ ] UI connue
[ ] Mobile comportement défini
[ ] Tests attendus définis
[ ] Acceptance criteria définis
```

---

# 41. Definition of Done

Une tâche est terminée lorsque :

```text
[ ] Code implémenté
[ ] Typecheck OK
[ ] Lint OK
[ ] Tests OK
[ ] Database OK
[ ] Authorization OK
[ ] Mobile OK
[ ] Error states OK
[ ] Documentation mise à jour
[ ] Aucun comportement hors scope ajouté
```

Pour une fonctionnalité critique :

```text
[ ] E2E OK
[ ] Security tests OK
```

---

# 42. Format standard d'un ticket Claude Code

Chaque ticket transmis à Claude Code doit suivre cette structure :

```markdown
# Task ID

MVP-BACKLOG-XXX

## Context

Contexte de la tâche.

## Objective

Résultat attendu.

## Scope

Fonctionnalités à développer.

## Non-Scope

Fonctionnalités explicitement exclues.

## References

Documents à consulter.

## Dependencies

Tâches préalables.

## Data

Tables et relations concernées.

## Business Rules

Règles à respecter.

## Authorization

Rôles et permissions.

## API

Routes, actions ou services.

## UI

Écrans et composants.

## Responsive

Smartphone:
- comportement

Tablet:
- adaptation

Desktop:
- adaptation

## Tests

Tests attendus.

## Acceptance Criteria

Critères précis de validation.

## Definition of Done

Conditions finales.
```

---

# 43. Prompt de travail recommandé pour Claude Code

Avant une tâche, Claude Code doit recevoir un contexte suffisamment précis.

Structure recommandée :

```text
Tu travailles sur le SaaS de gestion d'immeubles.

Lis d'abord les documents de référence suivants :
[documents concernés]

Tâche :
[objectif]

Scope :
[scope]

Non-scope :
[non-scope]

Contraintes :
[contraintes]

Ne modifie pas les fonctionnalités hors scope.

Avant de coder :
1. inspecte le code existant ;
2. identifie les composants réutilisables ;
3. vérifie les modèles ;
4. vérifie les permissions ;
5. vérifie les tests existants.

Ensuite :
1. implémente ;
2. écris les tests ;
3. exécute lint ;
4. exécute typecheck ;
5. exécute les tests ;
6. corrige les problèmes ;
7. résume précisément les fichiers modifiés.
```

---

# 44. Règle Claude Code : ne pas avancer automatiquement

Claude Code ne doit pas considérer qu'un ticket terminé autorise automatiquement le développement du ticket suivant.

Le workflow doit rester :

```text
Task
↓
Implementation
↓
Tests
↓
Review
↓
Validation
↓
Next Task
```

Cela limite les dérives architecturales et fonctionnelles.

---

# 45. Règle Claude Code : pas de scope creep

Lorsque Claude Code identifie une amélioration non demandée :

```text
Ne pas l'implémenter
↓
La documenter comme proposition
↓
La classer :
FUT / ARCH / OUT
```

---

# 46. Règle Claude Code : ne pas contourner la sécurité

Il est interdit de simplifier le développement en :

- supprimant une vérification de permission ;
- faisant confiance au frontend ;
- exposant une ressource publiquement ;
- désactivant une validation ;
- contournant l'isolation organisationnelle.

Même temporairement.

---

# 47. Règle Claude Code : données financières

Toute modification concernant :

- loyers ;
- paiements ;
- charges ;
- allocations ;
- quittances ;
- dépenses ;

doit être accompagnée de tests supplémentaires.

---

# 48. Règle Claude Code : modifications de schéma

Une modification de base de données doit toujours préciser :

```text
Pourquoi ?
Quel modèle ?
Quelle migration ?
Quel impact sur les données existantes ?
Quel rollback ou stratégie de compatibilité ?
Quels tests ?
```

---

# 49. Règle Claude Code : composants UI

Avant de créer un nouveau composant :

```text
Chercher composant existant
↓
Réutiliser si possible
↓
Étendre si nécessaire
↓
Créer seulement si nécessaire
```

Cela évite une bibliothèque de composants incohérente.

---

# 50. Règle Claude Code : mobile first

Toute tâche frontend doit répondre explicitement à :

```text
Comment cela fonctionne sur smartphone ?
```

avant :

```text
Comment cela s'adapte sur desktop ?
```

---

# 51. Future Evolutions

Les éléments suivants pourront être ajoutés après stabilisation du MVP :

## FUT-BACKLOG-001

Application native iOS.

## FUT-BACKLOG-002

Application native Android.

## FUT-BACKLOG-003

Comptabilité avancée.

## FUT-BACKLOG-004

Gestion de copropriété.

## FUT-BACKLOG-005

Analytics avancés.

## FUT-BACKLOG-006

Multi-pays.

## FUT-BACKLOG-007

Automatisations avancées.

## FUT-BACKLOG-008

Gestion fournisseurs avancée.

## FUT-BACKLOG-009

Infrastructure haute disponibilité avancée.

---

# 52. Architecture Constraints Related to Future Evolutions

## ARCH-BACKLOG-001

Ne pas enfermer la logique métier dans les composants React.

## ARCH-BACKLOG-002

Ne pas coupler les paiements à un fournisseur spécifique.

## ARCH-BACKLOG-003

Ne pas coupler les notifications à WhatsApp ou SMS.

## ARCH-BACKLOG-004

Conserver une API suffisamment propre pour accueillir plus tard des clients mobiles natifs.

## ARCH-BACKLOG-005

Conserver des identifiants stables et des relations historiques.

## ARCH-BACKLOG-006

Conserver une couche de jobs indépendante du frontend.

## ARCH-BACKLOG-007

Conserver une couche d'abstraction pour le stockage objet.

---

# 53. Out of Scope

## OUT-BACKLOG-001

Développer toutes les fonctionnalités futures avant la validation du MVP.

## OUT-BACKLOG-002

Construire une application iOS et Android native avant validation du produit web/PWA.

## OUT-BACKLOG-003

Construire une architecture microservices avant qu'un besoin réel apparaisse.

## OUT-BACKLOG-004

Construire un système comptable complet.

## OUT-BACKLOG-005

Construire une plateforme ERP immobilière complète.

## OUT-BACKLOG-006

Développer des fonctionnalités IA sans problème produit concret à résoudre.

---

# 54. MVP Release Checklist

Avant de considérer le MVP comme terminé :

```text
## Produit
[ ] Owner flow OK
[ ] Manager flow OK
[ ] Tenant flow OK

## Immobilier
[ ] Properties
[ ] Apartments
[ ] Leases

## Finance
[ ] Rents
[ ] Payments
[ ] Receipts
[ ] Charges
[ ] Expenses

## Maintenance
[ ] Incidents
[ ] Interventions

## Communication
[ ] Invitations
[ ] Notifications
[ ] Reminders

## Sécurité
[ ] Auth
[ ] RBAC
[ ] Scope
[ ] Isolation
[ ] IDOR tests
[ ] Audit

## UX
[ ] Mobile first
[ ] Tablet
[ ] Desktop
[ ] Loading
[ ] Empty
[ ] Error
[ ] Success

## QA
[ ] Unit
[ ] Integration
[ ] E2E
[ ] Security
[ ] Regression

## DevOps
[ ] Staging
[ ] Production
[ ] Backup
[ ] Restore
[ ] Monitoring
[ ] Rollback
```

---

# 55. Ordre de livraison recommandé

Le produit doit être livré progressivement selon les jalons suivants.

## Milestone 1 : Foundation

```text
Repository
Database
CI
Auth
Organization
RBAC
```

---

## Milestone 2 : Core Property Management

```text
Properties
Apartments
Managers
Invitations
Tenants
```

---

## Milestone 3 : Rental Management

```text
Lot 8    Contrats
Lot 9    Loyers            créance de loyer
Lot 10   Charges           créance de charge
Lot 11   Paiements         allocation multi-créances
Lot 12   Quittances
```

Les charges entrent dans ce milestone car elles font partie du **modèle financier** (DEC-005), et non des opérations.

---

## Milestone 4 : Operations

```text
Lot 13   Incidents
Lot 14   Interventions
Lot 15   Dépenses
```

---

## Milestone 5 : Product Experience

```text
Notifications
Reminders
Dashboards
Activity
Search
Documents
```

---

## Milestone 6 : Hardening

```text
Security
Performance
Regression
Responsive
E2E
Monitoring
Backups
```

---

## Milestone 7 : Launch

```text
Staging
Production
Smoke Tests
Monitoring
Validation
```

---

# 56. Principe final d'exécution

Le développement du produit doit rester linéaire dans ses fondations et contrôlé dans son expansion.

La logique est :

```text
Fondation
↓
Cœur métier
↓
Finance
↓
Opérations
↓
Expérience utilisateur
↓
Sécurité
↓
Qualité
↓
Production
```

Et non :

```text
Fonctionnalité
+
Fonctionnalité
+
Fonctionnalité
sans validation
```

Le principe directeur pour Claude Code est :

> **Une tâche, un objectif, un scope, des tests, une validation, puis la suivante.**

Le MVP doit être construit comme un produit réel dès le premier commit : mobile first, sécurisé, testé, traçable et suffisamment structuré pour évoluer sans être reconstruit.