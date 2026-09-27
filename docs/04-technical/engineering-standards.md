# Engineering Standards & Codebase Guidelines

## 1. Objet du document

Ce document définit les standards techniques à respecter dans l'ensemble du codebase du SaaS de gestion d'immeubles.

Il sert de référence pour :

- Claude Code ;
- les développeurs humains ;
- les Pull Requests ;
- les revues de code ;
- les nouvelles fonctionnalités ;
- les corrections de bugs ;
- les migrations ;
- les tests ;
- la maintenance à long terme.

L'objectif est de conserver un codebase :

- cohérent ;
- lisible ;
- prévisible ;
- sécurisé ;
- testable ;
- maintenable ;
- évolutif.

Ce document ne définit pas la logique fonctionnelle détaillée du produit. Les règles métier restent définies dans le document Business Rules.

---

# 2. Principes fondamentaux

## ENG-001 : Lire avant d'écrire

Avant toute modification, le développeur ou Claude Code doit comprendre :

- la structure du projet ;
- le module concerné ;
- les modèles de données ;
- les services existants ;
- les composants existants ;
- les règles métier ;
- les permissions ;
- les tests existants.

---

## ENG-002 : Réutiliser avant de créer

Avant de créer un nouveau :

- composant ;
- service ;
- helper ;
- hook ;
- validation ;
- type ;
- utilitaire ;

rechercher d'abord une implémentation existante.

---

## ENG-003 : Une responsabilité claire

Une fonction, un composant, un service ou un module doit avoir une responsabilité compréhensible.

Éviter les composants ou services qui deviennent des points centraux pour des dizaines de responsabilités différentes.

---

## ENG-004 : Ne pas dupliquer la logique métier

Une règle métier importante doit avoir une source d'implémentation identifiable.

Éviter :

```text id="66f6my"
Frontend calcul
+
API calcul
+
Job calcul
```

avec trois implémentations différentes d'une même règle.

---

## ENG-005 : Le backend reste souverain

Le frontend peut améliorer l'expérience, mais il ne décide jamais :

- des permissions ;
- des montants ;
- des statuts financiers ;
- des allocations ;
- des accès ;
- des transitions critiques.

---

## ENG-006 : Préférer la simplicité

Lorsqu'une solution simple satisfait les exigences, elle doit être préférée à une abstraction ou une infrastructure plus complexe.

---

# 3. MVP

# 3.1 Structure générale du codebase

## MVP-ENG-001 : Organisation des répertoires

La structure doit conserver une séparation logique entre :

```text id="a9om5f"
app/
components/
modules/
lib/
db/
tests/
```

Cette structure peut évoluer, mais toute évolution doit préserver une séparation claire des responsabilités.

---

## MVP-ENG-002 : Modules métier

Les modules métier principaux doivent être isolés :

```text id="yb34dm"
auth
organizations
properties
apartments
managers
tenants
leases
rents
payments
receipts
charges
maintenance
expenses
notifications
reports
activity
```

Un module ne doit pas importer arbitrairement toute l'implémentation interne d'un autre module.

---

# 4. TypeScript

## MVP-ENG-003 : TypeScript strict

Le projet doit utiliser le mode strict de TypeScript.

Éviter autant que possible :

```ts
any
```

---

## MVP-ENG-004 : Types explicites aux frontières

Les fonctions situées aux frontières importantes doivent avoir des types explicites.

Exemples :

- API ;
- services ;
- repositories ;
- fonctions métier ;
- composants publics ;
- handlers.

---

## MVP-ENG-005 : Ne pas utiliser `any` comme solution rapide

Si une donnée n'est pas encore correctement typée :

1. identifier sa structure ;
2. créer le type approprié ;
3. valider les données si elles sont externes.

---

## MVP-ENG-006 : Types métier explicites

Les concepts critiques doivent avoir des types explicites, **dérivés d'une source unique** partagée avec le schéma Drizzle.

```ts
type UserRole = "OWNER" | "MANAGER" | "TENANT";

type ReceivableStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

type IncidentStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "RESOLVED"
  | "CLOSED";

type InterventionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type ApartmentStatus = "VACANT" | "OCCUPIED" | "MAINTENANCE";

type ReceivableKind = "RENT" | "CHARGE";
```

Les valeurs canoniques sont définies par **DEC-015 à DEC-021** et listées dans le Glossary §108.

Une valeur d'enum ne doit jamais être redéclarée indépendamment dans plusieurs couches.

---

# 5. Gestion des valeurs monétaires

## MVP-ENG-007 : Argent en entier

> **Convention unique : DEC-014.**

Tout montant est un **entier** exprimé dans la plus petite unité de la devise, accompagné d'un code ISO 4217.

```text id="k6s8od"
amount   = bigint, minor unit
currency = code ISO 4217 explicite
```

Pour le GNF, l'exposant de sous-unité est 0.

```text
2 500 000 GNF  ->  amount = 2500000, currency = 'GNF'
```

Interdits :

```ts
// INTERDIT
const total = rent * 1.05;
const amount: number = 2_500_000.75;
JSON: { "amount": "2 500 000 GNF" }
```

Obligatoire :

```ts
type Money = { amount: bigint | number; currency: string };
```

Le formatage d'affichage relève **exclusivement** du frontend.

---

## MVP-ENG-008 : Calcul financier côté serveur

Tout calcul financier critique doit être exécuté côté serveur.

Le frontend peut afficher un calcul prévisionnel, mais le serveur doit recalculer et valider.

---

## MVP-ENG-009 : Aucune conversion monétaire implicite

Ne jamais supposer qu'un nombre représente une devise particulière sans contexte.

---

# 6. Dates et temps

## MVP-ENG-010 : Dates explicites

Les dates doivent avoir une signification claire :

- date métier ;
- timestamp technique ;
- date de création ;
- date de paiement ;
- date d'échéance.

---

## MVP-ENG-011 : Timestamps système

Les enregistrements importants doivent conserver notamment :

```text
created_at
updated_at
```

Lorsque nécessaire :

```text
archived_at
```

`deleted_at` est **banni** du modèle du MVP (DEC-020). L'archivage est porté exclusivement par `archived_at`, et aucun enum de statut ne contient `ARCHIVED`.

---

## MVP-ENG-012 : Gestion timezone

Les traitements backend ne doivent pas dépendre implicitement de la timezone de la machine locale.

La timezone métier doit être explicite lorsqu'elle influence un calcul ou un job.

---

# 7. React et Next.js

## MVP-ENG-013 : Server-first lorsque pertinent

> **Note de version : DEC-006.**
>
> Le repository utilise **Next.js 16 et React 19**, en App Router.
>
> Les conventions de cette version priment sur les exemples génériques de la documentation.
>
> Consulter `node_modules/next/dist/docs/` **avant** d'écrire du code Next.js.

Utiliser les capacités server-side de Next.js lorsque cela améliore :

- sécurité ;
- performance ;
- simplicité ;
- accès aux données.

## Bibliothèques retenues

```text
Zod                 validation de toute entrée externe
React Hook Form     formulaires
TanStack Query      uniquement lorsque le cache client apporte une vraie valeur
```

TanStack Query ne doit pas être introduit par défaut sur chaque écran : les données rendues côté serveur n'en ont pas besoin.

---

## MVP-ENG-014 : Client Components justifiés

Un composant client ne doit pas être créé simplement par habitude.

Il doit être utilisé lorsqu'il nécessite notamment :

- interaction ;
- état local ;
- APIs navigateur ;
- écoute d'événements ;
- fonctionnalités intrinsèquement client.

---

## MVP-ENG-015 : Ne pas mettre la logique métier dans les composants

Éviter :

```tsx
function PaymentForm() {
  // 300 lignes de logique métier
}
```

Préférer :

```text id="tqf7nm"
UI
↓
Application Service
↓
Domain Rules
```

---

# 8. Composants React

## MVP-ENG-016 : Composants petits et composables

Un composant doit rester compréhensible.

Lorsqu'un composant devient trop complexe, découper selon les responsabilités.

---

## MVP-ENG-017 : Composants de domaine

Réutiliser les composants de domaine définis dans Component Specification.

Exemples :

```text
PaymentCard
TenantCard
PropertyCard
IncidentCard
ChargeCard
```

---

## MVP-ENG-018 : Props explicites

Les composants doivent utiliser des props clairement typées.

Éviter les objets génériques excessivement permissifs.

---

# 9. Mobile First

## MVP-ENG-019 : Smartphone comme référence

Tout composant frontend doit être conçu d'abord pour smartphone.

Ordre de raisonnement :

```text
Smartphone
↓
Tablet
↓
Desktop
```

---

## MVP-ENG-020 : Responsive par adaptation

Le responsive ne doit pas simplement consister à réduire la taille d'une interface desktop.

Il doit pouvoir modifier :

- layout ;
- navigation ;
- densité ;
- interactions ;
- présentation des tableaux ;
- placement des actions.

---

## MVP-ENG-021 : Actions tactiles

Les éléments interactifs doivent être utilisables confortablement sur smartphone.

---

# 10. Design System

## MVP-ENG-022 : Composants centralisés

Les éléments de base doivent provenir du Design System.

Éviter de recréer localement :

- boutons ;
- inputs ;
- badges ;
- modals ;
- alerts ;
- spacing ;
- typographie.

---

## MVP-ENG-023 : Pas de styles arbitraires

Éviter les valeurs visuelles isolées lorsque le Design System fournit déjà un token adapté.

---

# 11. Tailwind CSS

## MVP-ENG-024 : Utilisation cohérente

Utiliser Tailwind selon les conventions du projet.

Éviter une multiplication de classes contradictoires et de valeurs arbitraires.

---

## MVP-ENG-025 : Classes répétitives

Lorsqu'un pattern revient fréquemment, envisager :

- composant ;
- variant ;
- utility ;
- abstraction cohérente.

---

# 12. API

## MVP-ENG-026 : Contrat API explicite

Les APIs doivent avoir :

- input défini ;
- validation ;
- authorization ;
- résultat défini ;
- erreurs structurées.

---

## MVP-ENG-027 : Validation avec Zod

Les entrées externes doivent être validées.

Exemples :

- body ;
- query ;
- params ;
- données webhook.

---

## MVP-ENG-028 : Ne jamais faire confiance au frontend

Une donnée correcte selon le formulaire frontend doit toujours être considérée comme non fiable côté serveur.

---

# 13. Gestion des erreurs

## MVP-ENG-029 : Erreurs métier séparées des erreurs techniques

Exemple :

```text
PaymentAlreadyConfirmed
PermissionDenied
LeaseConflict
InvalidInvitation
```

doivent être distinguables des erreurs techniques générales.

---

## MVP-ENG-030 : Messages utilisateur sûrs

Le frontend reçoit des messages compréhensibles.

Les détails internes restent dans les logs.

---

## MVP-ENG-031 : Pas de stack trace côté utilisateur

Ne jamais exposer directement :

```text
stack
SQL
filesystem path
environment variable
secret
```

---

# 14. Architecture applicative

## MVP-ENG-032 : Présentation

Responsable de :

- rendu ;
- interaction ;
- navigation ;
- état UI.

---

## MVP-ENG-033 : Application

Responsable de :

- orchestration ;
- cas d'usage ;
- transactions métier ;
- coordination entre services.

---

## MVP-ENG-034 : Domain

Responsable de :

- règles métier ;
- validations métier ;
- états ;
- calculs ;
- invariants.

---

## MVP-ENG-035 : Infrastructure

Responsable de :

- PostgreSQL ;
- stockage ;
- paiements ;
- SMS ;
- WhatsApp ;
- email ;
- services externes.

---

# 15. Base de données

## MVP-ENG-036 : Accès via ORM

L'accès à PostgreSQL doit utiliser Drizzle ou une abstraction validée.

---

## MVP-ENG-037 : Pas de SQL concaténé

Interdit :

```ts
`SELECT * FROM payments WHERE id = '${id}'`
```

---

## MVP-ENG-038 : Transactions

Utiliser des transactions pour les opérations nécessitant une cohérence atomique.

Exemple :

```text id="l8tp1t"
Payment
↓
Allocation
↓
Receipt
```

Lorsque les règles métier exigent l'atomicité, toutes les opérations concernées doivent rester cohérentes.

---

# 16. Migrations

## MVP-ENG-039 : Toute modification de schéma passe par une migration

Ne pas modifier la structure de production manuellement comme pratique courante.

---

## MVP-ENG-040 : Migrations déterministes

Une migration doit pouvoir être exécutée de manière reproductible.

---

## MVP-ENG-041 : Migrations sécurisées

Les changements destructifs doivent être évités lorsque possible.

Privilégier les migrations progressives.

---

# 17. Repositories et accès aux données

## MVP-ENG-042 : Repository seulement lorsque nécessaire

Créer une abstraction repository lorsqu'elle apporte une vraie séparation ou réutilisation.

Ne pas créer des couches abstraites simplement pour multiplier les fichiers.

---

## MVP-ENG-043 : Scope au niveau data access

Le code chargé d'accéder aux données doit être compatible avec le contexte d'organisation et de périmètre.

---

# 18. Authorization

## MVP-ENG-044 : Vérification serveur

Toute action protégée doit vérifier :

```text
User
→ Organization
→ Role
→ Scope
→ Permission
→ Resource
```

---

## MVP-ENG-045 : Pas d'autorisation implicite

La connaissance d'un UUID ne doit jamais suffire.

---

## MVP-ENG-046 : UI guard non suffisant

Un `PermissionGuard` frontend est une aide UX.

Il ne remplace jamais le contrôle backend.

---

# 19. Authentification

## MVP-ENG-047 : Auth provider encapsulé

La logique métier ne doit pas dépendre directement d'une implémentation particulière du fournisseur d'authentification.

---

## MVP-ENG-048 : Session context

Le code métier doit recevoir un contexte d'utilisateur fiable au niveau serveur.

---

# 20. Paiements

## MVP-ENG-049 : Payment Provider Adapter

Les fournisseurs de paiement doivent être encapsulés.

---

## MVP-ENG-050 : Webhooks séparés

Les webhooks ne doivent pas être traités comme de simples appels frontend.

---

## MVP-ENG-051 : Idempotence

Toute opération susceptible d'être répétée doit être protégée contre les doublons.

---

## MVP-ENG-052 : Pas de confirmation côté frontend

Le frontend ne doit jamais pouvoir définir seul :

```text
payment.status = CONFIRMED
```

---

# 21. Notifications

## MVP-ENG-053 : Notification Provider Adapter

Créer une interface commune pour :

```text
Email
SMS
WhatsApp
```

---

## MVP-ENG-054 : Contenu minimal

Les messages externes ne doivent pas exposer plus d'informations personnelles que nécessaire.

---

# 22. Jobs

## MVP-ENG-055 : Jobs idempotents

Les jobs doivent être conçus pour supporter :

- retry ;
- duplication technique ;
- reprise.

---

## MVP-ENG-056 : Pas de traitement long dans une requête interactive

Une opération longue doit être déplacée vers un job lorsque nécessaire.

---

# 23. Logs

## MVP-ENG-057 : Logs structurés

Préférer des logs structurés avec :

```text
timestamp
level
event
requestId
module
context
```

---

## MVP-ENG-058 : Logs sans secrets

Interdit de journaliser :

- mot de passe ;
- token ;
- secret API ;
- clé privée ;
- données personnelles inutiles.

---

# 24. Audit

## MVP-ENG-059 : Audit centralisé

Les événements sensibles doivent utiliser un mécanisme d'audit cohérent.

---

## MVP-ENG-060 : Actor explicite

L'audit doit permettre de déterminer :

- qui ;
- quoi ;
- quand ;
- sur quelle ressource ;
- avec quel résultat.

---

# 25. Tests

## MVP-ENG-061 : Test avec le code

Une fonctionnalité métier critique doit être accompagnée des tests nécessaires.

---

## MVP-ENG-062 : Unit Tests

Utilisés pour :

- calculs ;
- règles ;
- transitions ;
- permissions ;
- validations.

---

## MVP-ENG-063 : Integration Tests

Utilisés pour :

- services ;
- API ;
- base ;
- transactions ;
- fournisseurs simulés.

---

## MVP-ENG-064 : E2E

Réservés aux parcours utilisateurs critiques.

---

# 26. Tests de sécurité

## MVP-ENG-065 : Tests négatifs

Chaque fonctionnalité sensible doit contenir des tests :

```text
Authorized
+
Unauthorized
+
Wrong Organization
+
Wrong Scope
```

---

## MVP-ENG-066 : Tests financiers

Tout module financier doit vérifier :

- intégrité ;
- arrondis ;
- doublons ;
- concurrence ;
- historique.

---

# 27. Configuration

## MVP-ENG-067 : Configuration externalisée

Ne pas mettre les secrets ou URLs d'environnement directement dans les modules métier.

---

## MVP-ENG-068 : Validation au démarrage

Les variables d'environnement obligatoires doivent être validées.

Une configuration invalide doit produire une erreur explicite au démarrage.

---

# 28. Feature Flags

## MVP-ENG-069 : Usage limité

Un feature flag ne doit pas devenir une dépendance permanente sans raison.

Lorsque la fonctionnalité est stabilisée :

```text
Feature Flag
↓
Validation
↓
Suppression du flag
```

---

# 29. Performance

## MVP-ENG-070 : Pas d'optimisation prématurée

Mesurer avant d'optimiser.

---

## MVP-ENG-071 : Requêtes maîtrisées

Éviter :

- N+1 queries ;
- SELECT inutile ;
- chargement massif ;
- appels répétés.

---

## MVP-ENG-072 : Images optimisées

Les images utilisateur doivent être adaptées à leur contexte.

---

# 30. Accessibilité

## MVP-ENG-073 : HTML sémantique

Utiliser les éléments HTML appropriés.

---

## MVP-ENG-074 : Formulaires accessibles

Chaque champ doit avoir :

- label ;
- état ;
- message d'erreur lorsque nécessaire.

---

## MVP-ENG-075 : Navigation clavier

Les interfaces desktop doivent rester navigables au clavier.

---

# 31. Git

## MVP-ENG-076 : Commits atomiques

Un commit doit idéalement correspondre à une intention claire.

---

## MVP-ENG-077 : Format de commit

Utiliser une convention cohérente.

Exemple :

```text
feat(payments): add manual payment
fix(auth): reject expired invitation
test(charges): cover rounding
refactor(tenants): simplify tenant service
```

---

## MVP-ENG-078 : Pas de commits secrets

Vérifier avant commit :

- secrets ;
- `.env` ;
- credentials ;
- fichiers sensibles.

---

# 32. Pull Requests

## MVP-ENG-079 : PR focalisée

Une PR doit éviter de mélanger :

```text
Feature
+
Refactor massif
+
Changement design
+
Migration non liée
```

---

## MVP-ENG-080 : Description structurée

Une PR doit contenir :

```text
What
Why
Scope
Tests
Migration
Risk
```

---

# 33. Code Review

## MVP-ENG-081 : Checklist de review

Une revue doit vérifier :

```text
[ ] Fonctionnement
[ ] Business Rules
[ ] Security
[ ] Authorization
[ ] Data Integrity
[ ] Tests
[ ] Mobile
[ ] Performance
[ ] Maintainability
```

---

# 34. Nommage

## MVP-ENG-082 : Noms explicites

Préférer :

```ts
calculateOutstandingBalance()
```

à :

```ts
calcBal()
```

---

## MVP-ENG-083 : Cohérence des noms

Le même concept doit conserver le même nom dans :

- database ;
- backend ;
- API ;
- frontend ;
- documentation.

---

## MVP-ENG-084 : Mapping explicite

Lorsqu'un nom métier diffère volontairement entre couches, le mapping doit être explicite.

---

# 35. Enums et statuts

## MVP-ENG-085 : Statuts centralisés

Les statuts critiques doivent être définis une seule fois selon la couche concernée.

Éviter :

```text
"paid"
"PAID"
"Payed"
```

pour représenter trois fois la même notion.

---

# 36. Validation

## MVP-ENG-086 : Validation externe

Toute donnée venant de l'extérieur doit être validée.

Sources :

- utilisateur ;
- URL ;
- query ;
- webhook ;
- fichier ;
- provider ;
- job payload.

---

## MVP-ENG-087 : Validation métier distincte

Une donnée peut être techniquement valide tout en étant interdite métier.

Exemple :

```text
Montant = valide
mais
Montant > solde autorisé = interdit
```

Les deux niveaux doivent être distingués.

---

# 37. Gestion des fichiers

## MVP-ENG-088 : Fichier jamais considéré comme fiable

Vérifier :

- taille ;
- type ;
- extension ;
- accès ;
- contexte ;
- permissions.

---

# 38. Sécurité frontend

## MVP-ENG-089 : Pas de secret client

Aucune clé secrète ne doit être envoyée au bundle navigateur.

---

## MVP-ENG-090 : Données minimales

Le frontend ne doit recevoir que les informations nécessaires.

---

# 39. Sécurité API

## MVP-ENG-091 : Contrôles systématiques

Chaque route sensible doit appliquer :

```text
Authentication
Authorization
Validation
Business Rules
```

---

# 40. Documentation dans le code

## MVP-ENG-092 : Commentaires utiles uniquement

Ne pas commenter des lignes évidentes.

Un commentaire doit expliquer :

- pourquoi ;
- une contrainte ;
- une décision ;
- un comportement inhabituel.

---

## MVP-ENG-093 : Pas de documentation obsolète

Lorsqu'une implémentation change, les commentaires et documents concernés doivent être mis à jour.

---

## MVP-ENG-093-bis : Pas de tiret cadratin

Le **tiret cadratin** est interdit dans la documentation, les commentaires, le code, les libellés d'interface et les messages produits par l'application.

Remplacements attendus selon le rôle joué :

| Rôle du tiret | Remplacement |
|---|---|
| Le second membre définit ou nomme le premier | deux-points |
| Le second membre est une incise ou une précision | virgule |
| Le second membre est une référence (règle, décision) | parenthèses |
| Cellule de tableau sans valeur | un mot explicite, par exemple `aucun` ou `sans objet` |

Le tiret demi-cadratin est soumis à la même interdiction.

Contrôle, écrit avec les octets UTF-8 des deux caractères afin que la commande ne se détecte pas elle-même :

```bash
grep -rn $'\xe2\x80\x94\|\xe2\x80\x93' docs/ src/
```

Elle doit ne rien afficher et sortir en code 1.

Deux pièges à éviter. Ne pas écrire le caractère littéralement dans la commande, sinon le contrôle se signale lui-même. Ne pas utiliser `grep -P '\x{2014}'` : hors mode UTF-8, PCRE rejette le motif, et l'échec de la commande se confond alors avec un résultat vide.

---

# 41. Décisions techniques

## MVP-ENG-094 : ADR pour décisions structurantes

Les décisions ayant un impact architectural important doivent pouvoir être documentées sous forme d'ADR.

Exemples :

- changement d'auth ;
- changement de stockage ;
- changement de paiement ;
- changement d'ORM ;
- architecture de jobs.

---

# 42. Future Evolutions

## FUT-ENG-001 : Design Tokens avancés

Ajouter une infrastructure plus poussée pour :

- thèmes ;
- branding multi-client ;
- white label.

---

## FUT-ENG-002 : Internationalisation complète

Introduire :

- traduction ;
- locale ;
- formats locaux ;
- pluralisation.

---

## FUT-ENG-003 : Architecture multi-app

Séparer éventuellement :

```text
Web
Admin
Mobile
API
```

si la croissance du produit le justifie.

---

## FUT-ENG-004 : Monorepo avancé

Un monorepo avec packages partagés pourra être introduit lorsque plusieurs applications réellement distinctes existeront.

---

## FUT-ENG-005 : Observabilité distribuée

Introduire des mécanismes plus avancés lorsque plusieurs services deviennent nécessaires.

---

# 43. Architecture Constraints Related to Future Evolutions

## ARCH-ENG-001 : Garder la logique métier indépendante de React

Les règles métier doivent pouvoir être réutilisées par d'autres clients futurs.

---

## ARCH-ENG-002 : Garder les intégrations interchangeables

Les fournisseurs externes doivent passer par des interfaces adaptées.

---

## ARCH-ENG-003 : Garder les données historiques

Les structures doivent permettre :

- changement de locataire ;
- changement de gestionnaire ;
- évolution des loyers ;
- évolution des permissions ;

sans perte d'historique.

---

## ARCH-ENG-004 : Préparer les clients multiples

L'architecture API ne doit pas supposer que le seul client futur sera le navigateur.

---

## ARCH-ENG-005 : Préserver la séparation des modules

Même dans un monolithe, les frontières métier doivent rester explicites.

---

# 44. Out of Scope

## OUT-ENG-001

Refonte architecturale majeure sans besoin réel.

---

## OUT-ENG-002

Microservices au MVP.

---

## OUT-ENG-003

Monorepo multi-application complexe au lancement.

---

## OUT-ENG-004

Système de plugins extensible.

---

## OUT-ENG-005

Architecture distribuée avancée.

---

# 45. Checklist Claude Code avant modification

Avant de commencer :

```text
[ ] Lire les fichiers concernés
[ ] Lire les modules liés
[ ] Chercher une implémentation existante
[ ] Vérifier Business Rules
[ ] Vérifier Permissions
[ ] Vérifier Data Model
[ ] Vérifier API
[ ] Vérifier Tests
```

---

# 46. Checklist Claude Code après modification

Après développement :

```text
[ ] Tests ajoutés
[ ] Typecheck
[ ] Lint
[ ] Tests
[ ] Build
[ ] Security check
[ ] Mobile check
[ ] Scope check
[ ] Aucun fichier inutile créé
[ ] Aucun secret ajouté
```

---

# 47. Checklist de revue humaine

Avant merge :

```text
[ ] Le comportement est correct
[ ] La solution reste simple
[ ] Pas de scope creep
[ ] Permissions correctes
[ ] Data integrity correcte
[ ] Tests pertinents
[ ] UI mobile first
[ ] Documentation cohérente
```

---

# 48. Règle finale

Le codebase doit rester suffisamment simple pour qu'un développeur entrant dans le projet puisse comprendre :

```text
Où est la fonctionnalité ?
Où est la règle métier ?
Où est l'autorisation ?
Où sont les données ?
Où sont les tests ?
```

sans devoir reconstituer l'architecture à partir de centaines de fichiers.

Le principe directeur est :

> **Écrire du code que l'équipe pourra encore comprendre, tester et modifier lorsque le produit aura fortement grandi.**