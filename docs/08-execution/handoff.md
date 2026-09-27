# Development Readiness & Handoff Specification

## 1. Objet du document

Ce document constitue la dernière étape avant le démarrage effectif du développement.

Son objectif est de vérifier que le projet possède :

- un périmètre MVP clair ;
- une architecture définie ;
- des règles métier cohérentes ;
- un modèle de données exploitable ;
- des rôles et permissions définis ;
- une UX suffisamment spécifiée ;
- un backlog exécutable ;
- une stratégie de tests ;
- une stratégie de déploiement ;
- un environnement de développement prêt ;
- des règles de travail pour Claude Code.

Il répond à une seule question :

> **Le projet est-il suffisamment défini pour commencer à coder sans improviser les fondations ?**

---

# 2. Principe fondamental

La phase de conception est considérée comme terminée lorsque le projet dispose de suffisamment d'informations pour commencer l'implémentation du MVP sans avoir à redéfinir continuellement :

- le produit ;
- les rôles ;
- les données ;
- les règles ;
- l'architecture ;
- les parcours principaux.

Cela ne signifie pas que toutes les décisions futures sont déjà connues.

Cela signifie que les décisions nécessaires au MVP sont suffisamment stabilisées.

---

# 3. MVP

# MVP-HANDOFF-001 : Périmètre validé

Le Master Product Specification doit être considéré comme la référence du périmètre.

Le MVP doit être explicitement séparé en :

```text
MVP
Future
Architecture Constraints
Out of Scope
```

---

# 4. MVP-HANDOFF-002 : Parcours principaux validés

Les trois parcours principaux doivent être suffisamment définis.

## Owner

```text id="x7f9q4"
Create Account
↓
Organization
↓
Property
↓
Apartments
↓
Manager Invitation
```

## Manager

```text id="tyr6cx"
Accept Invitation
↓
Access Property
↓
Create Tenant
↓
Create Lease
↓
Manage Rent
↓
Record Payment
↓
Manage Charges
↓
Manage Maintenance
```

## Tenant

```text id="f9p8o8"
Accept Invitation
↓
Activate Account
↓
View Housing
↓
View Lease
↓
View Amount Due
↓
View Payment
↓
View Receipt
↓
View Charge
↓
Report Incident
```

---

# 5. MVP-HANDOFF-003 : Modèle de données validé

Les principales entités doivent être suffisamment définies :

```text id="95st7c"
Organization
User
Role
User Access
Manager Property Access
Property
Apartment
Tenant Profile
Lease
Rent Installment
Payment
Payment Allocation
Receipt
Charge
Charge Allocation
Incident
Intervention
Provider
Expense
Document
Invitation
Notification
Activity Log
Audit Log
```

Les relations critiques doivent être validées avant développement.

---

# 6. MVP-HANDOFF-004 : Règles métier validées

Avant d'implémenter le code, les règles suivantes doivent être considérées comme verrouillées pour le MVP :

- séparation User / Role ;
- séparation User / Tenant Profile ;
- isolation organisationnelle ;
- scope gestionnaire ;
- invitation obligatoire pour certains contextes ;
- historique préservé ;
- génération des échéances ;
- paiement partiel ;
- allocation ;
- idempotence ;
- répartition des charges ;
- cycle des incidents ;
- contrôle des dépenses ;
- révocation ;
- contrôle serveur des permissions.

---

# 7. MVP-HANDOFF-005 : Statuts validés

Les statuts doivent être centralisés et cohérents.

Exemples :

> Liste canonique complète : **Decision Register DEC-015 à DEC-021** et **Glossary §108**.

### Lease

```text id="z2m8s0"
DRAFT
ACTIVE
ENDED
CANCELLED
```

### Receivable, loyer ET charge (DEC-015)

```text id="m8p8oo"
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

« À venir » est un affichage dérivé, jamais un statut stocké.

### Payment (DEC-016)

```text id="7icq4g"
PENDING
CONFIRMED
FAILED
CANCELLED
```

`INITIATED` n'existe pas. `REFUNDED` est hors MVP.

### Incident (DEC-017)

```text id="oh5sql"
OPEN
ASSIGNED
IN_PROGRESS
ON_HOLD
RESOLVED
CLOSED
```

« À traiter » est un filtre, pas un statut.

### Intervention (DEC-018)

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

### Apartment (DEC-019)

```text
VACANT
OCCUPIED
MAINTENANCE
```

`AVAILABLE` n'est pas utilisé. `ARCHIVED` est porté par `archived_at`.

Les valeurs définitives doivent rester cohérentes entre :

```text
Database
Backend
API
Frontend
Tests
Documentation
```

---

# 8. MVP-HANDOFF-006 : Permissions validées

Les permissions doivent être identifiables sous la forme :

```text id="5kfrg2"
resource.action
```

Exemples :

```text
property.create
property.update
property.archive

tenant.create
tenant.invite
tenant.update

lease.create
lease.update

payment.create
payment.view

charge.create
charge.publish

incident.create
incident.update
```

La liste définitive est gouvernée par Roles & Permissions Matrix.

---

# 9. MVP-HANDOFF-007 : Architecture validée

Architecture de référence, DEC-006 :

```text id="j5sa9e"
Next.js (App Router)
React
TypeScript strict
Tailwind CSS
shadcn/ui
PostgreSQL
Drizzle ORM
Zod
React Hook Form
TanStack Query (lorsque nécessaire)
```

Style d'architecture :

```text id="9b1jcl"
Modular Monolith
Repository unique
```

Infrastructure, DEC-007 :

```text
Local                             PostgreSQL via Docker
Development / Staging / Production  Supabase PostgreSQL
Hébergement applicatif            Vercel
```

Note de version : Next.js 16 et React 19. Consulter `node_modules/next/dist/docs/` avant d'écrire du code.

---

# 10. MVP-HANDOFF-008 : Architecture applicative validée

Séparation :

```text id="88c5x5"
Presentation
↓
Application
↓
Domain
↓
Infrastructure
```

Le frontend ne doit pas devenir une couche de règles métier.

---

# 11. MVP-HANDOFF-009 : Mobile First validé

Toutes les interfaces du MVP doivent être :

> Responsive Mobile First.

Ordre de conception :

```text id="2v4ibp"
Smartphone
↓
Tablet
↓
Desktop
```

---

# 12. MVP-HANDOFF-010 : Design System

Avant de développer l'ensemble des écrans, les composants fondamentaux doivent exister ou être clairement spécifiés :

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
- Navigation ;
- Tabs ;
- Forms ;
- Loading ;
- Empty ;
- Error.

---

# 13. MVP-HANDOFF-011 : Direction visuelle

La direction visuelle doit être suffisamment définie pour éviter que chaque écran développe son propre style.

Les éléments définitifs à valider sont notamment :

- couleurs ;
- typographie ;
- radius ;
- elevation ;
- iconographie ;
- tokens.

Les valeurs peuvent encore évoluer pendant la phase de design, mais les composants doivent rester construits autour de tokens.

---

# 14. MVP-HANDOFF-012 : API

Les routes principales doivent suivre une convention cohérente.

Exemple :

```text id="gm1n1e"
/api/v1/properties
/api/v1/apartments
/api/v1/managers
/api/v1/tenants
/api/v1/leases
/api/v1/rents
/api/v1/payments
/api/v1/charges
/api/v1/incidents
/api/v1/interventions
/api/v1/expenses
```

---

# 15. MVP-HANDOFF-013 : API contract

Chaque route critique doit définir :

```text id="4al4i6"
Authentication
Authorization
Input
Validation
Business Rules
Response
Error
Audit
```

---

# 16. MVP-HANDOFF-014 : Database

Le schéma initial doit être transformé en migrations.

La base doit notamment garantir :

- contraintes ;
- relations ;
- indexes ;
- timestamps ;
- unicité ;
- intégrité référentielle ;
- historique.

---

# 17. MVP-HANDOFF-015 : Environnements

Préparer :

```text id="74sw91"
Local
Development
Staging
Production
```

Les secrets de production ne sont jamais utilisés dans les environnements de développement.

---

# 18. MVP-HANDOFF-016 : Variables d'environnement

Créer une configuration explicitement documentée.

Exemples :

Actives au MVP :

```text id="4ss0jr"
DATABASE_URL
APP_URL
INTERNAL_JOB_SECRET
BETTER_AUTH_SECRET      signature des sessions (DEC-032)
BETTER_AUTH_URL         URL canonique utilisée par Better Auth
```

Préparées mais inactives, activées avec leur intégration :

```text
STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_KEY / STORAGE_SECRET   DEC-033
PAYMENT_SECRET / PAYMENT_WEBHOOK_SECRET                            DEC-034
SMS_SECRET / WHATSAPP_SECRET / EMAIL_SECRET                        DEC-008
```

Absentes du MVP :

```text
SENTRY_DSN      monitoring reporté
POSTHOG_KEY     analytics reporté
```

Les valeurs réelles ne doivent jamais être présentes dans Git.

La configuration obligatoire est validée au démarrage : une variable requise manquante produit une erreur explicite.

---

# 19. MVP-HANDOFF-017 : CI

La CI doit exécuter au minimum :

```text id="at2i7k"
Install
↓
Lint
↓
Typecheck
↓
Tests
↓
Build
```

---

# 20. MVP-HANDOFF-018 : Tests de sécurité

Avant de commencer les fonctionnalités avancées, les fondations doivent déjà tester :

```text id="v6k8te"
Authentication
Organization Isolation
RBAC
Scope
IDOR
Server Validation
```

---

# 21. MVP-HANDOFF-019 : Test data

Le projet doit disposer d'un seed de développement.

Minimum :

```text id="18k3yj"
Organization A
Owner A
Manager A
Tenant A
Property A
Apartments A01-A03
Lease A
Rent
Payment
Charge
Incident
```

Prévoir également une seconde organisation pour les tests d'isolation.

---

# 22. MVP-HANDOFF-020 : Fixtures

Les tests doivent pouvoir créer rapidement :

- organisation ;
- owner ;
- manager ;
- tenant ;
- property ;
- apartment ;
- lease ;
- rent ;
- payment.

---

# 23. MVP-HANDOFF-021 : Observabilité

Avant staging :

- error tracking ;
- logs structurés ;
- monitoring ;
- jobs monitoring ;
- payment monitoring.

---

# 24. MVP-HANDOFF-022 : Backup

Configurer :

- backup PostgreSQL ;
- rétention ;
- restauration test.

---

# 25. MVP-HANDOFF-023 : External Providers

Les providers doivent être définis comme dépendances interchangeables :

```text id="l16c83"
Payment Provider
Email Provider
SMS Provider
WhatsApp Provider
Storage Provider
Analytics Provider
Monitoring Provider
```

L'authentification ne figure pas dans cette liste : Better Auth est une bibliothèque qui écrit dans notre PostgreSQL, non un service externe (DEC-032). Elle reste néanmoins encapsulée derrière le service interne d'authentification, selon la même exigence de remplaçabilité.

---

# 26. MVP-HANDOFF-024 : Provider adapters

Les SDK externes ne doivent pas être importés directement partout dans le code métier.

---

# 27. MVP-HANDOFF-025 : Payment readiness

Avant intégration réelle, vérifier :

- provider ;
- API ;
- sandbox ;
- webhook ;
- signature ;
- idempotence ;
- statut pending ;
- succès ;
- échec ;
- reconciliation.

---

# 28. MVP-HANDOFF-026 : Messaging readiness

Pour SMS, WhatsApp et email :

- provider ;
- template ;
- retry ;
- failure ;
- monitoring.

---

# 29. MVP-HANDOFF-027 : Storage readiness

Le stockage doit être :

- privé ;
- sécurisé ;
- compatible avec URLs temporaires ;
- séparé de l'application.

---

# 30. MVP-HANDOFF-028 : Analytics readiness

Les événements critiques doivent être documentés avant leur implémentation.

Exemples :

```text
property_created
tenant_invited
lease_created
payment_confirmed
incident_created
```

---

# 31. MVP-HANDOFF-029 : UAT readiness

Les scénarios UAT doivent être prêts avant la fin du développement.

Les profils :

- Owner ;
- Manager ;
- Tenant ;

doivent disposer de parcours de validation.

---

# 32. MVP-HANDOFF-030 : Documentation repository

Le repository doit contenir ou référencer :

```text id="j3g0m7"
Master Product Specification
Business Rules
Data Model
API
Security
UX
Testing
Deployment
Glossary
ADR
```

---

# 33. Definition of Ready pour une feature

Avant qu'une feature entre dans le sprint ou le lot de développement :

```text id="k5o54b"
[ ] MVP
[ ] Requirement
[ ] Business Rule
[ ] Data
[ ] API
[ ] Authorization
[ ] UI
[ ] Mobile
[ ] Tests
[ ] Acceptance Criteria
```

---

# 34. Definition of Done pour une feature

```text id="bhcn1d"
[ ] Implementation
[ ] Typecheck
[ ] Lint
[ ] Unit Test
[ ] Integration Test if needed
[ ] E2E if critical
[ ] Security
[ ] Mobile
[ ] Tablet
[ ] Desktop
[ ] Documentation
```

---

# 35. Premier lot à remettre à Claude Code

Le premier ticket ne doit pas être :

> Construis l'application.

Il doit être limité à la fondation.

---

# 36. MVP-HANDOFF-031 : Premier lot

Le premier lot comprend :

```text id="5q0qrx"
Repository
+
Next.js
+
TypeScript
+
Tailwind
+
shadcn/ui
+
Lint
+
Formatting
+
Testing
+
PostgreSQL
+
Drizzle
+
Environment
```

---

# 37. Premier objectif technique

À la fin du premier lot :

```text id="nfdl1h"
npm run dev
```

fonctionne.

```text id="4e3jvf"
npm run lint
```

fonctionne.

```text id="nq5b6h"
npm run typecheck
```

fonctionne.

```text id="j8zq0e"
npm run test
```

fonctionne.

```text id="rd9wlo"
npm run build
```

fonctionne.

---

# 38. Deuxième lot

Après fondation :

```text id="z7i4s7"
PostgreSQL
↓
Drizzle
↓
Migrations
↓
Seed
↓
Auth
```

---

# 39. Troisième lot

Puis :

```text id="67d4zn"
Organization
↓
RBAC
↓
Scope
↓
Permission Service
```

---

# 40. Quatrième lot

Puis :

```text id="d5cd8r"
Property
↓
Apartment
```

---

# 41. Cinquième lot

Puis :

```text id="2g3hsm"
Manager
↓
Invitation
↓
Tenant
```

---

# 42. Suite du développement

Ordre de référence :

```text id="4e6v3z"
Lease
↓
Rent
↓
Payment
↓
Receipt
↓
Charge
↓
Incident
↓
Intervention
↓
Expense
↓
Notification
↓
Dashboard
↓
Search
↓
Hardening
```

---

# 43. Règle de progression

Ne pas passer au lot suivant uniquement parce que le code compile.

Le lot doit être :

```text id="zn4fdx"
Implemented
+
Tested
+
Validated
```

---

# 44. Handoff Claude Code

Avant la première session de développement, Claude Code doit recevoir :

1. le Master Product Specification ;
2. le document de la tâche ;
3. les documents spécialisés concernés ;
4. les contraintes techniques ;
5. les critères d'acceptation.

---

# 45. Prompt de démarrage recommandé

```markdown id="i93m9d"
Tu vas développer le MVP d'un SaaS de gestion d'immeubles.

Avant toute modification :

1. Lis le Master Product Specification.
2. Lis les documents spécialisés concernés par la tâche.
3. Inspecte le repository existant.
4. Identifie les composants, services et modèles réutilisables.
5. Vérifie les règles métier.
6. Vérifie les permissions.
7. Vérifie le périmètre MVP.

Contraintes fondamentales :

- Responsive Mobile First.
- Backend source de vérité.
- RBAC + Scope.
- Isolation stricte des organisations.
- Pas de scope creep.
- Pas de secret dans le repository.
- Pas de nouvelle dépendance sans justification.
- Pas de nouvelle architecture sans décision documentée.
- Tests obligatoires pour les fonctionnalités critiques.

Avant de coder, résume :
- ce que tu vas modifier ;
- les fichiers concernés ;
- les dépendances ;
- les tests prévus.

Ensuite seulement, implémente.
```

---

# 46. Claude Code doit signaler

Claude Code doit interrompre le développement structurel et demander une décision documentée lorsqu'une tâche nécessite :

- changement majeur de database ;
- changement d'architecture ;
- nouveau provider critique ;
- nouveau rôle ;
- nouvelle relation métier fondamentale ;
- nouvelle règle financière ;
- contournement de sécurité.

---

# 47. Ce qui n'a plus besoin d'être décidé avant le premier commit

Les éléments suivants peuvent être raffinés pendant le développement sans bloquer la fondation :

- détails visuels ;
- microcopy ;
- animations ;
- certains espacements ;
- certaines variantes de composants ;
- certains filtres secondaires ;
- analytics secondaires.

Ils doivent toutefois rester compatibles avec le MVP.

---

# 48. Ce qui doit être décidé avant le développement des modules concernés

## Storage, DEC-033 OUVERTE

Le fournisseur de stockage objet.

**Bloque le lot Documents (Lot 16) et les photos d'incident.** Ne bloque pas les lots antérieurs si l'interface `StorageProvider` est définie dès le Lot 1.

## Paiement, DEC-034 OUVERTE

Le fournisseur de paiement.

**Bloque uniquement le paiement digital.** Le paiement manuel, les créances, les allocations, les quittances et les tableaux de bord ne sont pas bloqués.

## Messaging, DEC-008 TRANCHÉE

SMS, WhatsApp et email sont **reportés**. Au MVP :

- les invitations sont diffusées par lien de partage copié (DEC-026) ;
- les notifications sont in-app uniquement (DEC-027).

Aucune décision supplémentaire n'est requise.

## Branding, DEC-012 et DEC-031 VERROUILLÉES

La **direction visuelle** est validée : « Property Infrastructure », palette, typographie Manrope + Inter, icônes Lucide, touch target 44 px.

Le **nom du produit** est verrouillé : **SIMANDOU IMMO**, produit distinct de SIMANDOU SEJOUR.

Restent à produire, sans nouvelle décision : logo, monogramme, favicon. Ils ne bloquent pas l'implémentation.

---

# 49. Architecture Constraints

## ARCH-HANDOFF-001

La documentation reste la référence de conception, mais le code devient la source de vérité d'exécution.

---

## ARCH-HANDOFF-002

Les décisions importantes sont enregistrées dans les ADR.

---

## ARCH-HANDOFF-003

Les changements de périmètre passent par le backlog.

---

## ARCH-HANDOFF-004

Les règles critiques doivent être testées.

---

## ARCH-HANDOFF-005

Les modules doivent conserver leurs frontières même si l'application reste un monolithe.

---

# 50. Future Evolutions

Le produit pourra ultérieurement intégrer :

- applications natives ;
- multi-pays ;
- comptabilité ;
- copropriété ;
- IA ;
- analytics avancés ;
- API publique ;
- white label ;
- multi-provider.

Ces évolutions ne doivent pas retarder la construction du MVP.

---

# 51. Out of Scope

Il n'est pas nécessaire avant le premier développement de :

- produire des dizaines de documents supplémentaires ;
- définir toute la roadmap à cinq ans ;
- choisir tous les futurs fournisseurs ;
- spécifier chaque futur écran ;
- construire une architecture pour des volumes hypothétiques ;
- finaliser toutes les fonctionnalités hors MVP.

---

# 52. Final Readiness Checklist

## Produit

```text id="ts4exq"
[ ] Master Product Specification
[ ] MVP Scope
[ ] User Flows
[ ] Business Rules
[ ] Glossary
```

## UX

```text id="cs7f3m"
[ ] IA
[ ] UX
[ ] Screens
[ ] Components
[ ] Mobile First
[ ] Visual Direction
```

## Technique

```text id="5q7ic8"
[ ] Architecture
[ ] API
[ ] Database
[ ] Security
[ ] Integrations
[ ] Engineering Standards
```

## QA

```text id="p2si8k"
[ ] Testing Strategy
[ ] Traceability
[ ] UAT
[ ] Accessibility
[ ] Performance
```

## DevOps

```text id="y7y2d4"
[ ] Deployment
[ ] Monitoring
[ ] Backups
[ ] Disaster Recovery
[ ] Maintenance
```

---

# 53. Go / No-Go

Le projet peut passer au développement lorsque :

### GO

```text id="k6pgp3"
MVP scope stable
+
Core workflows defined
+
Data model ready
+
Security rules ready
+
Architecture ready
+
Development environment ready
+
Backlog ready
```

### NO-GO

Le développement doit être temporairement bloqué si l'un de ces éléments manque sur une fonction critique :

```text id="f8f4r1"
Business Rule
Data Model
Authorization
Security requirement
Acceptance Criteria
```

---

# 54. Principe final

La conception est suffisamment mature lorsque le développement peut commencer sans demander à chaque ticket :

> Que doit faire cette fonctionnalité ?

La question doit désormais devenir :

> Comment implémenter correctement ce qui a déjà été défini ?

Le principe directeur est :

> **À partir de ce point, nous ne devons plus concevoir le produit en improvisant dans le code. Nous devons construire progressivement le produit déjà spécifié, puis améliorer ce qui est réellement observé sur le terrain.**

---

# 55. Statut du projet documentaire

À ce stade :

| Document | Statut réel |
|---|---|
| Product & Technical Decision Register | Présent |
| Master Product Specification | Présent |
| MVP Scope & Feature Matrix | Présent |
| Product Vision | Présent |
| PRD | Présent |
| User Flows | Présent |
| Information Architecture | Présent |
| Roles & Permissions | Présent |
| Business Rules | Présent |
| Domain Glossary | Présent |
| Product UX Structure | Présent |
| **Screen Specification** | **ABSENT, lacune reconnue (DEC-030)** |
| Design System | Présent |
| Visual Identity | Présent |
| Component Specification | Présent |
| API & Backend | Présent |
| Database Schema | Présent, tient lieu de modèle de données |
| Architecture Governance | Présent, tient lieu de document d'architecture |
| Engineering Standards | Présent |
| Security | Présent |
| Privacy | Présent |
| Accessibility | Présent |
| Development Plan | Présent |
| Development Backlog | Présent |
| Testing Strategy | Présent |
| Traceability | Présent |
| UAT & Pilot | Présent |
| DevOps | Présent |
| Performance | Présent |
| Analytics & Monitoring | Présent |
| Disaster Recovery | Présent |
| Post-Launch Operations | Présent |
| Development Handoff | Présent |

> **Correction de consolidation**
>
> Les versions précédentes de ce tableau déclaraient terminés trois documents inexistants : *Data Model*, *Technical Architecture* et *Screen Specification*.
>
> Les deux premiers sont couverts par des documents existants (DEC-030).
>
> Le troisième est une **lacune réelle** : les écrans P0 ne sont pas spécifiés au niveau détail. À produire pendant le Milestone 2, écran par écran, avant les tickets UI correspondants.

Le socle documentaire est **suffisant pour commencer les Lots 0 à 2** (Initialisation, Base technique, Authentification), DEC-032 étant verrouillée sur Better Auth.

Seuls le lot Documents (DEC-033) et le paiement digital (DEC-034) restent en attente d'une décision.

La prochaine étape n'est plus un nouveau document de conception général.

C'est l'exécution :

```text id="4cl3j4"
Charte visuelle finale
↓
Setup du repository
↓
Premier commit
↓
Foundation
↓
Auth
↓
Organization
↓
Permissions
↓
Property
↓
Apartment
↓
Manager
↓
Tenant
↓
Lease
↓
Rent
↓
Payment
↓
...
```

Le prochain travail concret peut donc commencer directement par la **construction de la fondation technique du projet pour Claude Code**.