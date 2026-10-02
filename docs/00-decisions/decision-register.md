# Product & Technical Decision Register

## 1. Objet du document

Ce document est le **registre central des décisions** produit et techniques du projet.

Il répond à une seule question :

> **Quelles décisions sont définitives, lesquelles ont été déduites de la documentation, et lesquelles restent ouvertes ?**

Il a été créé pour résoudre un problème observé lors de l'audit documentaire : plusieurs concepts importants possédaient deux ou trois définitions différentes selon les documents, et aucune source ne permettait de savoir laquelle faisait autorité.

Ce document ne décrit ni le produit, ni l'architecture, ni les règles métier.

Il enregistre **les décisions** et indique **où elles sont appliquées**.

---

# 2. Statuts de décision

Chaque décision porte l'un des trois statuts suivants.

## VERROUILLÉE

Décision explicitement validée par le fondateur.

Elle ne peut être modifiée que par une nouvelle décision explicite du fondateur.

Claude Code ne doit jamais la contourner ni la réinterpréter.

---

## DÉDUITE

Décision **non validée explicitement** par le fondateur, mais déduite de l'ensemble de la documentation afin d'éliminer une contradiction bloquant l'implémentation.

Elle est appliquée dans la documentation et peut être implémentée.

Elle reste **réversible** : le fondateur peut la modifier à tout moment, et l'impact est indiqué dans la fiche.

Une décision DÉDUITE ne doit jamais être présentée comme définitive.

À ce jour, seules **DEC-021, DEC-024, DEC-028 et DEC-030** portent ce statut. Toutes relèvent de choix d'implémentation sans impact sur le produit.

---

## OUVERTE

Décision qui ne peut pas être raisonnablement déduite de la documentation et qui nécessite une validation du fondateur.

Une décision OUVERTE **bloque** les lots de développement listés dans sa fiche.

Elle ne bloque pas les autres lots.

---

# 3. Règle de préséance documentaire

En cas de contradiction entre deux documents, l'ordre d'autorité est :

```text
1. Product & Technical Decision Register
2. Master Product Specification
3. MVP Scope & Feature Matrix
4. Business Rules
5. Security & Access Control Specification
6. Database Schema & Migration Specification
7. API & Backend Specification
8. Product UX / Information Architecture / Design System / Component Specification
9. Engineering / Implementation / QA / DevOps / Operations
```

Précisions :

- le présent registre fait autorité sur **la décision elle-même** ;
- le Master Product Specification fait autorité sur **le cadre et le périmètre** ;
- le MVP Scope & Feature Matrix est **subordonné** au Master Product Specification et détaille le périmètre ;
- les documents spécialisés restent la référence de **détail** pour leur domaine.

Un document de niveau inférieur ne peut jamais contredire un document de niveau supérieur.

Lorsqu'une contradiction est détectée, elle doit être corrigée dans le document de niveau inférieur.

---

# 4. Index des décisions

| ID | Sujet | Statut | Bloque |
|---|---|---|---|
| DEC-001 | Positionnement et principe produit | VERROUILLÉE | aucun |
| DEC-002 | Mobile first | VERROUILLÉE | aucun |
| DEC-003 | Rôles MVP | VERROUILLÉE | aucun |
| DEC-004 | Périmètre fonctionnel MVP | VERROUILLÉE | aucun |
| DEC-005 | Créances de charges distinctes du loyer | VERROUILLÉE | aucun |
| DEC-006 | Stack applicative | VERROUILLÉE | aucun |
| DEC-007 | Infrastructure et environnements | VERROUILLÉE | aucun |
| DEC-008 | Intégrations externes non implémentées au MVP | VERROUILLÉE | aucun |
| DEC-009 | Confirmation des paiements | VERROUILLÉE | aucun |
| DEC-010 | Exigences de sécurité | VERROUILLÉE | aucun |
| DEC-011 | Conventions de données | VERROUILLÉE | aucun |
| DEC-012 | Direction visuelle « Property Infrastructure » | VERROUILLÉE | aucun |
| DEC-013 | Préservation de l'historique | VERROUILLÉE | aucun |
| DEC-014 | Convention de stockage des montants | VERROUILLÉE | aucun |
| DEC-015 | Statuts de créance (loyer et charge) | VERROUILLÉE | aucun |
| DEC-016 | Statuts de paiement | VERROUILLÉE | aucun |
| DEC-017 | Statuts d'incident | VERROUILLÉE | aucun |
| DEC-018 | Statuts d'intervention | VERROUILLÉE | aucun |
| DEC-019 | Statuts d'appartement | VERROUILLÉE | aucun |
| DEC-020 | Archivage et suppression | VERROUILLÉE | aucun |
| DEC-021 | Enums PostgreSQL et listes de référence | DÉDUITE | aucun |
| DEC-022 | Allocation des paiements | VERROUILLÉE | aucun |
| DEC-023 | Paiement supérieur au montant dû | VERROUILLÉE | aucun |
| DEC-024 | Rattachement des documents | DÉDUITE | aucun |
| DEC-025 | Modèle de permissions du MVP | VERROUILLÉE | aucun |
| DEC-026 | Canal de diffusion des invitations au MVP | VERROUILLÉE | aucun |
| DEC-027 | Canaux de notification du MVP | VERROUILLÉE | aucun |
| DEC-028 | Jobs et tâches planifiées | DÉDUITE | aucun |
| DEC-029 | Méthodes de répartition des charges | VERROUILLÉE | aucun |
| DEC-030 | Documents de référence manquants | DÉDUITE | aucun |
| DEC-031 | Nom du produit : SIMANDOU IMMO | VERROUILLÉE | aucun |
| DEC-032 | Fournisseur d'authentification : Better Auth | VERROUILLÉE | aucun |
| DEC-033 | Fournisseur de stockage objet | OUVERTE | Lot Documents |
| DEC-034 | Fournisseur de paiement | OUVERTE | Paiement digital |
| DEC-035 | Base de données des tests : PGlite | VERROUILLÉE | aucun |
| DEC-036 | Formulaires et mutations de l'interface | DÉDUITE | aucun |
| DEC-037 | Socle d'interface introduit au Lot 4 | DÉDUITE | aucun |
| DEC-038 | Base de développement de secours, sans virtualisation | DÉDUITE | aucun |
| DEC-039 | Archivage d'un appartement | VERROUILLÉE | aucun |
| DEC-040 | Méthode de vérification du rendu mobile | DÉDUITE | aucun |

---

# 5. Décisions verrouillées

## DEC-001 : Positionnement et principe produit

**Statut** : VERROUILLÉE

SaaS de gestion opérationnelle des immeubles et biens locatifs, adapté au contexte guinéen.

Principe directeur :

> **Complexe technologiquement. Simple humainement.**

**Appliqué dans** : Product Vision, Master Product Specification, PRD.

---

## DEC-002 : Mobile first

**Statut** : VERROUILLÉE

Tous les parcours sont conçus d'abord pour smartphone, puis adaptés à la tablette et au desktop.

Il est interdit de concevoir une interface desktop puis de la compresser.

Touch target minimum : **44 × 44 px**.

**Appliqué dans** : Master §17, Design System, Visual Identity, Component Specification, Engineering Standards, Testing Strategy, Accessibility.

---

## DEC-003 : Rôles MVP

**Statut** : VERROUILLÉE

Les rôles du MVP sont exactement :

```text
OWNER
MANAGER
TENANT
```

Règles associées :

- un OWNER peut également agir comme MANAGER sur son organisation, sans créer de second compte ;
- un MANAGER peut être affecté à plusieurs immeubles ;
- plusieurs MANAGER peuvent être affectés au même immeuble ;
- la révocation d'un accès ne supprime jamais l'historique ;
- le départ d'un locataire met fin à son accès opérationnel sans détruire l'historique du bail, des paiements, des incidents et des documents.

Aucun autre rôle n'existe au MVP.

**Appliqué dans** : Roles & Permissions Matrix, Security, Master §4, Glossary.

---

## DEC-004 : Périmètre fonctionnel MVP

**Statut** : VERROUILLÉE

Le MVP couvre :

```text
Organisations
Utilisateurs
Rôles et permissions
Immeubles
Appartements
Locataires
Invitations
Baux / contrats
Échéances de loyer
Paiements
Quittances
Charges communes
Répartition des charges
Incidents
Interventions / travaux
Dépenses
Documents
Notifications
Rappels / relances
Tableaux de bord
Historique
Activité / audit
Recherche et filtres
Sécurité
Sauvegarde et récupération de base
```

Aucune fonctionnalité métier hors de cette liste ne doit être ajoutée au MVP, même si elle paraît utile ou facile à développer.

**Appliqué dans** : Master §15, MVP Scope & Feature Matrix.

---

## DEC-005 : Créances de charges distinctes du loyer

**Statut** : VERROUILLÉE

C'est la décision structurante du modèle financier.

Une **part de charge** constitue une **créance payable distincte** de l'échéance de loyer.

Le système doit donc distinguer explicitement :

```text
Créance de loyer      (rent_installment)
Créance de charge     (charge_allocation)
Montant total dû      (somme des soldes des créances ouvertes)
Paiement              (payment)
Allocation            (payment_allocation)
```

Exemple de référence :

```text
Loyer            2 500 000 GNF
Charge eau         300 000 GNF
Total dû         2 800 000 GNF
Paiement         1 500 000 GNF
Reste à payer    1 300 000 GNF
```

Le locataire voit un **montant global à payer**.

Le système conserve les **composantes séparées**.

**Conséquences obligatoires** :

1. un paiement peut être alloué à **plusieurs créances** (voir DEC-022) ;
2. `payment_allocations` référence soit une créance de loyer, soit une créance de charge ;
3. les créances de loyer et de charge partagent le **même cycle de statut** (voir DEC-015) ;
4. la quittance doit indiquer la ventilation loyer / charges ;
5. les tableaux de bord distinguent loyers et charges ;
6. les tests financiers couvrent les deux types de créance.

**Appliqué dans** : Master §11-12, Business Rules §13-16, Database Schema §19-32, API, Product UX, Component Specification, Testing Strategy, Traceability.

---

## DEC-006 : Stack applicative

**Statut** : VERROUILLÉE

```text
Next.js (App Router)
React
TypeScript strict
Tailwind CSS
shadcn/ui
PostgreSQL
Drizzle ORM
Zod
React Hook Form
TanStack Query (uniquement lorsque nécessaire)
```

Architecture : **modular monolith**, un seul repository.

TypeScript end-to-end.

PostgreSQL reste la **source de vérité**.

Pas de microservices.

**Note de version** : le repository utilise Next.js 16 et React 19. Les conventions de cette version priment sur les exemples génériques présents dans la documentation. Se référer à `node_modules/next/dist/docs/` avant d'écrire du code Next.js.

**Appliqué dans** : Master §22, Engineering Standards, Architecture Governance, Handoff §9.

---

## DEC-007 : Infrastructure et environnements

**Statut** : VERROUILLÉE

| Environnement | Base de données | Application |
|---|---|---|
| Local | PostgreSQL via Docker | Next.js local |
| Development | Supabase PostgreSQL | Vercel |
| Staging | Supabase PostgreSQL | Vercel |
| Production | Supabase PostgreSQL | Vercel |

**Contrainte de portabilité** : éviter tout verrouillage inutile aux APIs propriétaires de Supabase.

Supabase est utilisé comme **fournisseur PostgreSQL managé**, pas comme framework applicatif.

En conséquence :

- l'accès aux données passe **exclusivement** par Drizzle ;
- les règles d'autorisation sont implémentées dans le **service d'autorisation applicatif**, pas dans des politiques RLS Supabase ;
- aucune fonctionnalité métier ne doit dépendre d'une capacité spécifique à Supabase.

**Appliqué dans** : Deployment & DevOps, Architecture Governance, Database Schema, Disaster Recovery.

---

## DEC-008 : Intégrations externes non implémentées au MVP

**Statut** : VERROUILLÉE

Règle applicable à toute intégration externe :

> **Fournisseur non sélectionné, abstraction définie, intégration réelle ultérieure.**

Les intégrations suivantes ne sont **pas implémentées** au MVP :

```text
WhatsApp Business API
SMS
Paiements réels
Monitoring externe
Analytics externe
Domaine personnalisé
Application native iOS
Application native Android
VPS
Kubernetes
```

### Distinction essentielle

Il faut distinguer deux situations qui ne doivent jamais être confondues :

| Situation | Signification |
|---|---|
| **Non implémenté au MVP** | La capacité n'est pas branchée maintenant. Le fournisseur peut rester à choisir. |
| **Écarté** | Le fournisseur a été examiné et rejeté. |

**Aucun fournisseur n'est écarté à ce stade.**

En particulier, **Cloudflare R2 et les solutions compatibles S3 restent des candidats valides** pour le stockage objet (DEC-033). Ils ne sont ni retenus, ni rejetés.

De même, aucun fournisseur de monitoring ou d'analytics n'est rejeté : leur intégration est simplement postérieure au MVP.

### Conséquence architecturale

Les interfaces `PaymentProvider`, `NotificationProvider`, `StorageProvider`, `AnalyticsProvider` sont **définies et utilisées** dès le MVP, avec des implémentations minimales ou inertes.

Le choix ultérieur d'un fournisseur ne doit impacter que son adapter, sa configuration et ses tests d'intégration.

**Appliqué dans** : External Integrations, Deployment & DevOps, Master §23-24.

---

## DEC-009 : Confirmation des paiements

**Statut** : VERROUILLÉE

Le frontend ne considère **jamais** un paiement comme confirmé.

La confirmation provient exclusivement :

- d'un webhook fournisseur authentifié ;
- ou d'une vérification serveur explicite du statut.

Le système doit garantir :

```text
Idempotence
Protection contre les doublons
Transactions
Allocations
Historique
Audit
```

**Appliqué dans** : Business Rules §13, Security §25-28, API §21-25, Engineering Standards §20.

---

## DEC-010 : Exigences de sécurité

**Statut** : VERROUILLÉE

L'autorisation est **toujours** effectuée côté serveur.

Exigences minimales :

```text
Isolation multi-tenant
Contrôle d'accès par organisation et périmètre
Invitations sécurisées
Sessions sécurisées
Révocation effective
Documents privés
URLs signées lorsque nécessaire
Validation des fichiers
Protection des webhooks
Idempotence
Rate limiting
Protection brute force
CSRF / XSS / SQL injection
Security headers
Audit logs
Secrets hors Git
Sauvegardes
```

Claude Code ne doit jamais disposer d'un accès incontrôlé à la production.

**Appliqué dans** : Security & Access Control Specification (document de référence).

---

## DEC-011 : Conventions de données

**Statut** : VERROUILLÉE

```text
Identifiants        UUID
Nommage base        snake_case
Timestamps          explicites
Contraintes         uniques lorsque la règle métier l'exige
Index               sur les colonnes de filtre, jointure et permission
Transactions        pour toute opération multi-tables atomique
Migrations          versionnées, jamais modifiées après application
Archivage           soft delete / archive lorsque nécessaire
```

Les données historiques ne doivent jamais être supprimées par une cascade destructive.

**Appliqué dans** : Database Schema & Migration Specification.

---

## DEC-012 : Direction visuelle « Property Infrastructure »

**Statut** : VERROUILLÉE

La direction visuelle est **validée** et ne constitue plus une décision ouverte.

### Palette

| Token | Valeur | Usage |
|---|---|---|
| Navy | `#123B4A` | Couleur d'identité, navigation, titres forts |
| Teal | `#138A8A` | Couleur d'action principale |
| Secondary Teal | `#2B9A8F` | Accent secondaire |
| Background | `#F7F9F8` | Fond d'application |
| Surface | `#FFFFFF` | Cartes, feuilles, panneaux |
| Text | `#172126` | Texte principal |
| Muted | `#66747A` | Texte secondaire |
| Border | `#DCE4E5` | Bordures et séparateurs |

### États fonctionnels

| Token | Valeur | Signification |
|---|---|---|
| Success | `#18794E` | Payé, résolu, confirmé |
| Warning | `#A15C00` | En attente, à traiter |
| Danger | `#B42318` | En retard, échec, critique |
| Info | `#1769AA` | Information neutre |

### Typographie

- **Manrope** : identité, titres, chiffres importants, marque.
- **Inter** : contenu, formulaires, boutons, tableaux, navigation.

### Autres

- Icônes : **Lucide**.
- Touch target minimum : **44 × 44 px**.
- Mobile first obligatoire.
- Radius et spacing : selon le Design System.

La couleur ne doit jamais être le seul porteur d'une information.

**Appliqué dans** : Design System, Visual Identity, Component Specification, Accessibility.

---

## DEC-013 : Préservation de l'historique

**Statut** : VERROUILLÉE

Le produit privilégie systématiquement :

```text
Archive / Deactivate / Revoke / End / Cancel
>
Delete
```

La révocation d'un accès et le départ d'un locataire conservent intégralement :

- les baux ;
- les créances ;
- les paiements ;
- les quittances ;
- les charges ;
- les incidents ;
- les interventions ;
- les dépenses ;
- les documents ;
- l'activité et l'audit.

**Appliqué dans** : Business Rules, Database Schema, Privacy, Security.

---

## DEC-031 : Nom du produit

**Statut** : VERROUILLÉE

Le nom officiel du produit est :

> **SIMANDOU IMMO**

### Distinction obligatoire

**SIMANDOU IMMO** est un produit **distinct de SIMANDOU SEJOUR**.

Aucun document, aucune interface, aucun message et aucun commentaire de code ne doit confondre les deux.

Le nom **SIMANDOU SEJOUR** ne doit jamais être utilisé pour désigner ce SaaS.

### Usage

| Contexte | Valeur |
|---|---|
| Nom produit | SIMANDOU IMMO |
| Repository | `Simandou-Immo` |
| Métadonnées applicatives | SIMANDOU IMMO |
| En-tête des notifications | SIMANDOU IMMO |

Le nom du repository existant est cohérent avec cette décision.

### Marqueurs supprimés

Les marqueurs temporaires `[NOM_PRODUIT]`, « À définir » et tout autre nom provisoire ont été retirés de la documentation.

Ils ne doivent jamais être réintroduits.

**Appliqué dans** : l'ensemble du corpus documentaire.

## DEC-032 : Fournisseur d'authentification

**Statut** : VERROUILLÉE

**Date** : 26 septembre 2026

**Décision du fondateur** :

```text
Better Auth, avec son adaptateur Drizzle
```

### Pourquoi ce choix

Trois contraintes devaient être satisfaites simultanément.

| Contrainte | Satisfaction |
|---|---|
| PostgreSQL source de vérité (DEC-007) | Les tables d'authentification vivent dans notre base, gérées par Drizzle et versionnées par nos migrations |
| Aucune adhérence aux APIs propriétaires de Supabase (DEC-007) | Better Auth ne dépend que d'une connexion PostgreSQL ; Supabase reste un simple hébergeur de base |
| Aucun fournisseur SMS au MVP (DEC-008) | L'identification se fait par téléphone et mot de passe, sans OTP, donc sans dépendance externe |

### Modèle d'identité

Le MVP n'introduit **aucune seconde identité**.

```text
users          table métier, sert également de modèle utilisateur à Better Auth
accounts       identifiants de connexion, dont le hash du mot de passe
sessions       sessions actives, révocables individuellement
verifications  jetons de vérification et de réinitialisation
```

Conséquences :

1. `users.id` reste la **clé métier unique** référencée par toutes les autres tables. Aucun `auth_user_id` parallèle n'est créé.
2. Les **identifiants de connexion** sont isolés dans `accounts`. Aucun secret d'authentification ne figure dans `users`, conformément à l'exigence de séparation.
3. Les champs métier de `users` (`full_name`, `phone`, `status`, `archived_at`) sont déclarés comme champs additionnels du modèle utilisateur.

### Identification au MVP

```text
Identifiant principal   téléphone
Identifiant secondaire  email, optionnel
Preuve                  mot de passe
```

L'authentification par OTP SMS ou WhatsApp est reportée avec DEC-008. Son activation ultérieure ne modifiera ni `users`, ni le service interne.

Cela reste cohérent avec DEC-026 : l'activation d'un compte se fait par lien d'invitation, jamais par code envoyé.

### Encapsulation obligatoire

Le code métier n'appelle **jamais** Better Auth directement. Un service interne expose :

```text
getCurrentUser()
getSession()
requireAuthenticatedUser()
signOut()
```

Toute violation de cette règle est un défaut bloquant en revue.

### Ce que cette décision ne tranche pas

Le mécanisme de récupération de compte reste dépendant d'un canal de communication, donc de DEC-008. Au MVP, la réinitialisation d'un mot de passe est effectuée par un utilisateur autorisé (propriétaire ou gestionnaire) qui régénère un lien d'activation, selon le même mécanisme que l'invitation.

### Vérification à l'installation

La version exacte et la compatibilité avec Next.js 16 et React 19 doivent être vérifiées au moment de l'installation, au lot Authentification. Si une incompatibilité bloquante apparaît, elle constitue une nouvelle décision à porter au registre, pas un contournement silencieux.

### Résultat de la vérification, 27 septembre 2026

**Version installée** : `better-auth` 1.7.6. **Aucune incompatibilité bloquante**, donc aucune décision nouvelle à porter au registre.

| Dépendance | Version du projet | Exigence de Better Auth 1.7.6 |
|---|---|---|
| `next` | 16.3.5 | `^14.0.0 \|\| ^15.0.0 \|\| ^16.0.0` |
| `react` | 19.2.8 | `^18.0.0 \|\| ^19.0.0` |
| `react-dom` | 19.2.8 | `^18.0.0 \|\| ^19.0.0` |
| `drizzle-orm` | 0.45.3 | `^0.45.2 \|\| >=1.0.0-rc.1 <2.0.0` |
| `drizzle-kit` | 0.31.11 | `>=0.31.4 \|\| >=1.0.0-beta.1` |

#### Ce que la vérification a confirmé

1. **Téléphone et mot de passe sans OTP sont supportés nativement.** Le greffon téléphone expose `POST /sign-in/phone-number`, qui vérifie le mot de passe du compte `credential` sans envoyer aucun code, à condition de laisser `requireVerification` à `false`. Son message d'échec est identique pour un numéro inconnu et pour un mot de passe faux, ce qui satisfait l'exigence de ne jamais révéler l'existence d'un compte.
2. **`users.email` reste nullable.** La bibliothèque déclare l'email obligatoire, mais son contrôle de schéma n'exige que l'existence de la colonne. La nullabilité n'est contrôlée que dans l'autre sens, pour les colonnes que Better Auth n'écrit pas. L'email facultatif de DEC-032 tient donc sans aménagement.
3. **Trois colonnes ont été ajoutées à `users`**, exigées par la bibliothèque et sans usage métier au MVP : `phone_verified`, `email_verified` et `image`. Leur absence empêche le démarrage.
4. **Trois correspondances de champs sont déclarées** : `name` vers `full_name`, `phoneNumber` vers `phone`, `phoneNumberVerified` vers `phone_verified`. Aucune colonne existante n'a été renommée.

#### Points d'attention issus de la lecture du code source

1. **L'adaptateur Drizzle adresse les colonnes par leur nom de propriété TypeScript**, jamais par leur nom physique. Renommer une propriété des tables d'authentification casse la connexion sans que le typage ni la migration ne le signalent. Un test de conformité garde ce point.
2. **Le greffon exige une fonction d'envoi d'OTP**, même inutilisée. Elle échoue explicitement : les points d'entrée `/phone-number/send-otp`, `/phone-number/verify` et `/phone-number/request-password-reset` restent donc inutilisables, ce qui est le comportement voulu par DEC-008 et DEC-026.
3. **La connexion et l'inscription par email sont désactivées.** Laisser `/sign-up/email` actif aurait ouvert une inscription libre, alors que l'entrée se fait exclusivement par invitation (ADR-008).
4. **Un changement de mot de passe révoque toutes les sessions**, celle de l'appelant comprise, et en crée une nouvelle. Le service interne renvoie le jeton de remplacement : l'ignorer déconnecterait l'utilisateur juste après son changement de mot de passe.
5. **Les identifiants sont générés en UUID** par `advanced.database.generateId`, sans quoi Better Auth produit des chaînes courtes qu'une colonne `uuid` refuse.

#### Contrôle métier ajouté

Better Auth ignore `users.status`. Un hook de création de session refuse donc toute session pour un compte qui n'est pas `ACTIVE` ou qui est archivé : sans lui, suspendre un compte n'empêcherait pas de s'y connecter, et le statut ne serait qu'une étiquette.

---

## DEC-035 : Base de données des tests automatisés

**Statut** : VERROUILLÉE

**Date** : 27 septembre 2026

**Décision du fondateur** :

```text
PGlite pour les tests automatisés.
Docker reste la base de développement (DEC-007, inchangée).
```

### Le problème

Les invariants du produit vivent dans la base : contraintes `CHECK`, clés étrangères en `RESTRICT`, unicités, énumérations. Les tester avec des doublures ne prouve rien, puisque ce sont précisément ces contraintes que l'on veut vérifier.

Faire dépendre les tests d'un serveur PostgreSQL pose deux problèmes : la CI n'en a pas, et un poste de développement neuf ne peut rien exécuter avant une installation.

### La décision

**PGlite**, PostgreSQL compilé en WebAssembly, exécuté dans le processus de test.

Les tests appliquent la **vraie migration** de `src/db/migrations`. Les contraintes vérifiées sont donc celles que la production appliquera.

### Ce que cette décision ne change pas

DEC-007 reste intacte. La base de **développement** est PostgreSQL via Docker.

PGlite n'est pas un environnement, c'est un outil de test. Il n'apparaît ni dans la liste des environnements, ni dans le déploiement.

### Limite à respecter

PGlite n'est pas identique à un serveur PostgreSQL : extensions, réglages serveur et comportements de concurrence peuvent différer.

Un comportement qui dépend de l'un de ces trois points doit être validé sur le vrai moteur, en local ou en staging, et non considéré comme acquis parce qu'un test PGlite passe.

### Conséquence outillage

`tsx` est ajouté en dépendance de développement pour exécuter les scripts TypeScript, dont le seed. Node 24 sait exécuter du TypeScript nativement, mais exige l'extension `.ts` dans les imports relatifs, ce qui imposerait d'activer `allowImportingTsExtensions` et rendrait les imports incohérents entre le code applicatif et les scripts.

**Appliqué dans** : `tests/helpers/database.ts`, `src/db/seed.ts`, Testing Strategy.

---

# 6. Décisions consolidées

Cette section regroupe les décisions issues de la consolidation documentaire, ainsi que les décisions déduites apparues à l'exécution des lots.

La **majorité a été explicitement verrouillée par le fondateur** : elles portent le statut VERROUILLÉE et ne sont plus réversibles sans nouvelle décision de sa part.

Sept d'entre elles conservent le statut DÉDUITE, **DEC-021, DEC-024, DEC-028, DEC-030, DEC-036, DEC-037, DEC-038**. Elles relèvent de choix d'implémentation sans impact produit, et restent réversibles.

Chaque fiche indique son impact en cas de changement.

---

## DEC-014 : Convention de stockage des montants

**Statut** : VERROUILLÉE

**Contradiction résolue** : la documentation stockait les montants « en unité monétaire entière » sans définir le comportement pour une devise à décimales.

**Décision** :

Tout montant monétaire est stocké comme un **entier signé** exprimé dans la **plus petite unité de la devise** (*minor unit*), accompagné d'un **code devise ISO 4217 explicite**.

```text
amount    bigint     NOT NULL
currency  char(3)    NOT NULL
```

Pour le **GNF**, l'exposant de sous-unité est **0**.

```text
2 500 000 GNF  ->  amount = 2500000, currency = 'GNF'
```

Règles :

- aucun nombre à virgule flottante dans un calcul financier ;
- aucune addition implicite entre devises différentes ;
- l'API transmet toujours le couple `{ amount, currency }` ;
- le formatage d'affichage est une responsabilité exclusive du frontend ;
- la table d'exposants par devise est portée par le code, pas par la base, tant qu'une seule devise existe.

**Impact si changé** : migration de toutes les colonnes monétaires et de tous les calculs.

---

## DEC-015 : Statuts de créance (loyer et charge)

**Statut** : VERROUILLÉE

**Contradiction résolue** : deux listes de statuts de loyer coexistaient, l'une avec un état « à venir », l'autre sans. Les charges n'avaient aucun statut.

**Décision** :

Les créances de loyer et les créances de charge partagent **un seul cycle de statut**.

```text
receivable_status

UNPAID
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

Libellés UI :

| Valeur | Libellé UI |
|---|---|
| `UNPAID` | À payer |
| `PARTIALLY_PAID` | Partiellement payé |
| `PAID` | Payé |
| `OVERDUE` | En retard |
| `CANCELLED` | Annulé |

**« À venir » n'est pas un statut stocké.**

C'est un état **dérivé** :

```text
status = UNPAID  ET  due_date > date du jour
-> affiché « À venir »
```

Cette dérivation appartient à la couche de présentation et ne doit jamais être persistée.

**Impact si changé** : enum PostgreSQL, moteur de statut, badges UI, tests.

---

## DEC-016 : Statuts de paiement

**Statut** : VERROUILLÉE

**Contradiction résolue** : trois listes différentes existaient, certaines contenant `INITIATED` et `REFUNDED`.

**Décision** :

```text
payment_status

PENDING
CONFIRMED
FAILED
CANCELLED
```

- `INITIATED` est **supprimé** : un paiement créé et non encore confirmé est `PENDING`.
- `REFUNDED` est **hors MVP**. Une correction de paiement au MVP utilise `CANCELLED` accompagné d'une trace d'audit.

Méthodes de paiement du MVP :

```text
payment_method

CASH
BANK_TRANSFER
MOBILE_MONEY
OTHER
```

**Impact si changé** : enum PostgreSQL, machine à états de paiement, webhooks, tests.

---

## DEC-017 : Statuts d'incident

**Statut** : VERROUILLÉE

**Contradiction résolue** : un cycle français à six états et un cycle anglais à cinq états coexistaient, et le cycle anglais était appliqué tantôt à l'incident, tantôt à l'intervention.

**Décision** :

L'incident possède son propre cycle, distinct de celui de l'intervention.

```text
incident_status

OPEN
ASSIGNED
IN_PROGRESS
ON_HOLD
RESOLVED
CLOSED
```

Libellés UI :

| Valeur | Libellé UI |
|---|---|
| `OPEN` | Nouveau |
| `ASSIGNED` | Affecté |
| `IN_PROGRESS` | En cours |
| `ON_HOLD` | En attente |
| `RESOLVED` | Résolu |
| `CLOSED` | Clôturé |

**« À traiter » n'est pas un statut.**

C'est un **filtre** du tableau de bord gestionnaire portant sur `OPEN` et `ASSIGNED`.

Transitions autorisées :

```text
OPEN        -> ASSIGNED | IN_PROGRESS | CLOSED
ASSIGNED    -> IN_PROGRESS | ON_HOLD | CLOSED
IN_PROGRESS -> ON_HOLD | RESOLVED | CLOSED
ON_HOLD     -> IN_PROGRESS | CLOSED
RESOLVED    -> CLOSED | IN_PROGRESS
CLOSED      -> (terminal)
```

Toute transition non listée doit être rejetée par le backend.

Priorités :

```text
incident_priority

LOW
NORMAL
URGENT
```

**Impact si changé** : enum, machine à états, filtres, timeline, tests.

---

## DEC-018 : Statuts d'intervention

**Statut** : VERROUILLÉE

**Contradiction résolue** : l'intervention n'avait pas de cycle propre et empruntait celui de l'incident, en contradiction avec la règle « Incident ≠ Intervention ».

**Décision** :

```text
intervention_status

PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

Libellés UI : Planifiée / En cours / Terminée / Annulée.

Règle métier conservée : la clôture d'une intervention ne clôture pas automatiquement l'incident. Un incident peut nécessiter plusieurs interventions.

**Impact si changé** : enum, workflow maintenance, tests.

---

## DEC-019 : Statuts d'appartement

**Statut** : VERROUILLÉE

**Contradiction résolue** : l'enum technique utilisait `AVAILABLE` alors que le vocabulaire officiel de l'interface est « Vacant ».

**Décision** :

```text
apartment_status

VACANT
OCCUPIED
MAINTENANCE
```

Libellés UI : Vacant / Occupé / En maintenance.

- `RESERVED` est **hors MVP**.
- `ARCHIVED` **ne fait pas partie de cet enum** : l'archivage est porté par `archived_at` (voir DEC-020).

**Impact si changé** : enum, vues patrimoine, tests.

---

## DEC-020 : Archivage et suppression

**Statut** : VERROUILLÉE

**Contradiction résolue** : `archived_at` et `deleted_at` coexistaient, et certaines entités portaient à la fois une colonne `archived_at` et une valeur de statut `ARCHIVED`, créant deux sources de vérité.

**Décision** :

1. L'archivage est porté **exclusivement** par la colonne `archived_at timestamptz NULL`.
2. `deleted_at` est **banni** du modèle du MVP.
3. **Aucun enum de statut ne contient la valeur `ARCHIVED`.**
4. Les entités dont le seul état était actif/archivé perdent leur colonne `status` :
   - `organizations` : `archived_at` seul ;
   - `properties` : `archived_at` seul.
5. Les entités dont le statut est orthogonal à l'archivage conservent les deux :
   - `apartments` : `apartment_status` + `archived_at`.
6. Aucun `DELETE` physique sur une entité métier dans le fonctionnement normal.
7. Comportement des clés étrangères :
   - `RESTRICT` par défaut ;
   - `SET NULL` uniquement pour une référence optionnelle non structurante ;
   - `CASCADE` **interdit** sur toute relation portant de l'historique.

**Impact si changé** : schéma, requêtes de liste, filtres.

---

## DEC-021 : Enums PostgreSQL et listes de référence

**Statut** : DÉDUITE

**Contradiction résolue** : la documentation indiquait que le choix « sera standardisé avant implémentation » sans le trancher.

**Décision** :

| Nature de la liste | Implémentation |
|---|---|
| Statut fermé et stable, contrôlé par le domaine | **Enum PostgreSQL natif** (`pgEnum` Drizzle) |
| Liste métier destinée à s'étendre sans changement de logique | **`text` + contrainte `CHECK`** |
| Liste éditable par les utilisateurs | Table de référence : **aucune au MVP** |

Répartition MVP :

```text
Enums PostgreSQL
  user_status
  user_access_status
  role
  apartment_status
  lease_status
  receivable_status
  payment_status
  payment_method
  charge_status
  allocation_method
  incident_status
  incident_priority
  intervention_status
  invitation_status
  expense_status
  notification_channel
  notification_status

text + CHECK
  charge_type
  incident_category
  expense_category
```

Toutes les valeurs d'enum sont en **MAJUSCULES**, en anglais, et identiques entre base, domaine, API, frontend et tests.

**Impact si changé** : migration initiale.

---

## DEC-022 : Allocation des paiements

**Statut** : VERROUILLÉE, conséquence directe de DEC-005

**Contradiction résolue** : la documentation limitait le MVP à une allocation « un paiement -> une échéance », ce qui est incompatible avec la décision verrouillée DEC-005 puisqu'un paiement global couvre à la fois du loyer et des charges.

**Décision** :

Flux canonique :

```text
Payment
   ↓
Payment Allocation
   ↓
Rent Receivable  OU  Charge Receivable
```

- une **allocation** référence **exactement une** créance ;
- un **paiement** peut porter **plusieurs allocations** ;
- l'ordre d'allocation automatique est **déterministe**.

1. L'**allocation multi-créances est dans le périmètre du MVP**.
2. `payment_allocations` référence **exactement une** créance, via deux clés étrangères nullables et une contrainte d'exclusion mutuelle :

```text
payment_allocations
  id                    uuid        PK
  payment_id            uuid        NOT NULL  FK payments
  rent_installment_id   uuid        NULL      FK rent_installments
  charge_allocation_id  uuid        NULL      FK charge_allocations
  amount                bigint      NOT NULL  CHECK (amount > 0)
  currency              char(3)     NOT NULL
  created_at            timestamptz NOT NULL

CHECK (
  (rent_installment_id IS NOT NULL)::int
  + (charge_allocation_id IS NOT NULL)::int
  = 1
)
```

Aucune relation polymorphe non contrainte n'est utilisée.

3. **Ordre d'allocation automatique déterministe** lorsque le locataire règle un montant global :

```text
1. due_date croissante
2. à date égale : loyer avant charge
3. à date et type égaux : created_at croissante
```

Cet ordre doit produire le même résultat pour les mêmes entrées.

4. Invariants vérifiés en transaction :

```text
somme(allocations d'un paiement)  <=  payment.amount
allocation.amount                 <=  receivable.balance au moment de l'allocation
receivable.balance                =   amount_due - somme(allocations confirmées)
receivable.balance                >=  0
```

**Impact si changé** : modèle financier complet.

---

## DEC-023 : Paiement supérieur au montant dû

**Statut** : VERROUILLÉE

**Contradiction résolue** : Business Rules laissait explicitement deux options ouvertes (bloquer, ou créer un crédit), en indiquant que la règle devait être arrêtée avant l'implémentation du paiement.

**Décision retenue : option A, refus.**

Un paiement dont le montant dépasse le **total dû restant** du locataire est **refusé** par le backend.

```text
Code d'erreur : AMOUNT_EXCEEDS_OUTSTANDING
```

Justification :

- Business Rules impose déjà que le solde d'une créance ne puisse pas être négatif ;
- la notion de crédit, d'avoir ou de trop-perçu **n'apparaît pas** dans le périmètre MVP validé (DEC-004) ;
- l'introduire créerait une entité financière supplémentaire non prévue.

Conséquences pratiques :

- paiement digital : le montant proposé est calculé par le serveur et plafonné au total dû ;
- paiement manuel en espèces : le gestionnaire enregistre le montant réellement imputé, la monnaie rendue n'étant pas un objet du système.

La gestion des crédits et trop-perçus est classée **Future Evolution**.

**Impact si changé** : ajout d'une entité de crédit, modification du moteur d'allocation, nouveaux statuts, nouveaux écrans. Réversible sans refonte tant que le module Paiements n'est pas livré.

---

## DEC-024 : Rattachement des documents

**Statut** : DÉDUITE

**Contradiction résolue** : trois approches coexistaient dans le même document, colonnes `document_id` directes, tables de liaison explicites, et relation polymorphe.

**Décision** :

| Cas | Implémentation |
|---|---|
| Document unique généré par le système | **Clé étrangère directe** |
| Pièces jointes multiples ajoutées par un utilisateur | **Table de liaison explicite** |

Aucune relation polymorphe `entity_type` / `entity_id` n'est utilisée pour les documents ni pour aucune donnée métier.

**Unique exception, strictement délimitée** : les colonnes `related_entity_type` / `related_entity_id` de la table `notifications`, qui constituent un lien de **navigation** sans clé étrangère ni intégrité métier. Aucune autre table ne peut invoquer ce précédent.

Concrètement :

```text
receipts.document_id          FK directe (quittance générée, relation 1-1)

lease_documents
charge_documents
expense_documents
incident_documents
intervention_documents
```

Chaque table de liaison contient :

```text
id           uuid        PK
document_id  uuid        NOT NULL FK documents
<entity>_id  uuid        NOT NULL FK <entity>
created_at   timestamptz NOT NULL
UNIQUE (document_id, <entity>_id)
```

Les colonnes `document_id` présentes sur `leases`, `charges` et `expenses` sont **supprimées** au profit des tables de liaison.

**Impact si changé** : schéma documentaire, API d'upload, écrans de pièces jointes.

---

## DEC-025 : Modèle de permissions du MVP

**Statut** : VERROUILLÉE

**Contradiction résolue** : le périmètre MVP ne mentionnait que « RBAC + Scope », tandis que la matrice des rôles décrivait une interface de délégation à cases à cocher et que le schéma prévoyait des tables `permissions` et `access_permissions`.

**Décision** :

Le MVP évalue les droits à partir de **deux dimensions seulement** :

```text
Rôle   (OWNER | MANAGER | TENANT)
+
Scope  (organisation, et pour MANAGER la liste des immeubles autorisés)
```

1. Le catalogue des permissions `resource.action` est **défini en code** comme une constante, et mappé statiquement par rôle.
2. Les tables `permissions` et `access_permissions` **ne sont pas créées** au MVP.
3. Le champ `permissions[]` est **retiré** de l'API d'invitation d'un gestionnaire.
4. `manager_property_access.access_level` est conservé avec une **unique valeur MVP** : `MANAGE`.
5. La délégation fine par gestionnaire est classée **Future Evolution**.
6. La distinction « gestionnaire principal / gestionnaire secondaire » **n'existe pas au MVP**, confirmée par le fondateur le 28 septembre 2026. Tous les gestionnaires d'une organisation sont égaux en droits sur leur périmètre, et **seul le propriétaire invite ou révoque un gestionnaire**. Elle reste une évolution possible, sans refonte du service d'autorisation.

Le service d'autorisation conserve la signature `can(user, permission, resource)` afin que l'ajout futur de permissions granulaires n'impose aucune refonte.

**Impact si changé** : ajout de deux tables, d'un écran de délégation et d'un champ d'API. Additif, sans refonte du service d'autorisation.

**DEC-025 ne bloque plus rien.** Elle devait être confirmée avant le lot **Gestionnaires**, parce que c'est à ce moment que l'écran d'invitation et l'attribution de périmètre se construisent. Ce fut fait le 28 septembre 2026, sur son dernier point ouvert.

### Résolution de la mention « selon droits », 27 septembre 2026, CONFIRMÉE

La matrice globale des rôles porte la mention « selon droits » sur sept lignes du gestionnaire. Cette mention visait la délégation fine que DEC-025 abandonne : elle n'a donc plus de référent, et le Lot 3 devait la résoudre pour écrire le catalogue en code.

**Ce qui n'est pas une interprétation** : tous les gestionnaires d'une organisation disposent du même ensemble de capacités, et « selon droits » ne peut donc plus signifier qu'une chose, la borne du périmètre d'immeubles.

**Ce qui était une interprétation, et que le fondateur a CONFIRMÉE le 27 septembre 2026** :

| Permission | Décision retenue | Sur quoi elle s'appuie |
|---|---|---|
| `property.create` | Propriétaire seul | La liste des capacités du gestionnaire, section 10 de la matrice, ne contient pas la création d'un immeuble ; celle du propriétaire, section 6, la contient |
| `property.archive` | Propriétaire seul | Même raisonnement : archiver un immeuble est un acte patrimonial, absent de la liste du gestionnaire |
| `manager.invite`, `manager.update`, `manager.revoke` | Propriétaire seul | La matrice refuse au gestionnaire chacune des quatre lignes concernant les gestionnaires |
| `manager.read` | Propriétaire seul | Aucune ligne de la matrice n'ouvre la consultation d'un gestionnaire au gestionnaire. En l'absence de règle, le moindre privilège décide |
| `audit.read` | Propriétaire seul | Le journal d'audit est une donnée de sécurité, et aucun document ne l'ouvre au gestionnaire |
| `apartment.archive` | Propriétaire seul | Ajoutée le 28 septembre 2026 par DEC-039 : retirer un logement de l'exploitation est un acte patrimonial, absent de la liste du gestionnaire |

Chacune se modifie en ajoutant une ligne dans `src/lib/authorization/permissions.ts`, et un test fige aujourd'hui chaque exclusion afin qu'un changement soit visible en revue.

**Portée de cette confirmation du 27 septembre** : ces cinq permissions. La sixième ligne « selon droits » de la matrice, l'archivage d'un appartement, a échappé à cette revue et n'a été tranchée que le 28 septembre : voir **DEC-039**, qui la réserve au propriétaire pour le même motif patrimonial que `property.archive`. La question du gestionnaire principal et du gestionnaire secondaire a été tranchée le même jour, au point 6 ci-dessus. **Plus aucune mention « selon droits » n'est sans référent.**

**Une formulation du PRD ne rouvre pas le sujet.** Le PRD section 10.3 écrit que « le propriétaire ou un gestionnaire autorisé » peut créer un immeuble. Cette formulation désignait la délégation fine qu'abandonne le point 1 de DEC-025 : elle est sans référent depuis, et ne constitue pas une contradiction.

### Deux conséquences du modèle à deux dimensions

1. **Un gestionnaire n'atteint aucune ressource de niveau organisation.** ADR-007 borne son autorité à un périmètre d'immeubles sans condition, donc une ressource sans immeuble en sort. Aucune permission qu'il porte au MVP ne s'applique à ce niveau. Le jour où un rapport global apparaîtra, au lot Dashboards, il faudra décider s'il le voit restreint à son périmètre plutôt que d'ouvrir cette porte.

2. **Le locataire n'atteint que ses propres données.** Son rattachement à un immeuble passera par son bail, au lot Contrats. D'ici là, il n'accède à aucune ressource d'immeuble, ce qui est exactement le refus exigé par MVP-BACKLOG-015.

### Motif de refus et code HTTP

Le service distingue deux refus, et la distinction n'est pas cosmétique.

```text
out-of-scope        hors organisation, hors perimetre, ou donnee d'autrui   ->  NOT_FOUND
permission-denied   ressource atteignable, role sans la permission          ->  FORBIDDEN
```

Répondre « interdit » sur une ressource hors périmètre confirmerait son existence : une ressource hors périmètre doit se comporter comme une ressource inexistante (ADR-007).

---

## DEC-026 : Canal de diffusion des invitations au MVP

**Statut** : VERROUILLÉE, conséquence de DEC-008

**Contradiction résolue** : les parcours d'invitation supposaient un envoi automatique par SMS ou WhatsApp, or ces intégrations sont explicitement reportées.

**Décision** :

Au MVP, l'invitation est diffusée par **lien de partage sécurisé**.

```text
Le système génère l'invitation et le lien.
L'inviteur copie le lien.
L'inviteur le transmet par son propre moyen (WhatsApp, SMS, en personne).
```

L'interface fournit une action explicite de copie du lien et affiche l'état de l'invitation.

Les envois automatiques par SMS, WhatsApp et email sont branchés plus tard derrière `NotificationProvider`, sans modification du modèle d'invitation.

Toutes les propriétés de sécurité de l'invitation restent inchangées : token imprévisible, stocké hashé, expirant, à usage unique, révocable, lié à son contexte.

**Impact si changé** : ajout d'un adapter et d'un job d'envoi. Additif.

---

## DEC-027 : Canaux de notification du MVP

**Statut** : VERROUILLÉE, conséquence de DEC-008

**Décision** :

Au MVP, le seul canal de notification actif est **`IN_APP`**.

```text
notification_channel

IN_APP      actif au MVP
SMS         défini, inactif
WHATSAPP    défini, inactif
EMAIL       défini, inactif
```

Le centre de notifications, les rappels d'échéance et les relances de retard sont **dans le périmètre MVP** et produisent des notifications in-app.

`NotificationService` et les préférences de notification sont implémentés dès le MVP. Les adapters externes existent sous forme d'implémentations inertes journalisées.

**Impact si changé** : activation d'un adapter. Additif.

---

## DEC-028 : Jobs et tâches planifiées

**Statut** : DÉDUITE

**Contradiction résolue** : la documentation évoquait un fournisseur de jobs sans le choisir, alors que la génération des échéances et les relances en dépendent.

**Décision** :

Au MVP, les tâches planifiées utilisent **les Cron Jobs de la plateforme d'hébergement** (Vercel), déclenchant des routes internes protégées.

```text
Cron plateforme
->
POST /internal/jobs/<nom>   (secret interne obligatoire)
->
Service de job idempotent
```

Exigences :

- toute route `/internal/*` est inaccessible publiquement ;
- tout job est **idempotent** et rejouable sans double effet métier ;
- chaque exécution est journalisée avec son résultat ;
- aucun traitement long dans une requête interactive.

Jobs du MVP :

```text
generateRentInstallments
sendRentReminders
markOverdueReceivables
expireInvitations
retryNotifications
```

Aucun fournisseur de files d'attente externe n'est introduit au MVP.

**Impact si changé** : remplacement du déclencheur. Les services de job restent inchangés.

---

## DEC-029 : Méthodes de répartition des charges

**Statut** : VERROUILLÉE

**Contradiction résolue** : le PRD listait trois méthodes, le périmètre MVP n'en exigeait qu'une.

**Décision** :

```text
allocation_method

EQUAL        MVP
CUSTOM       Future Evolution
CONSUMPTION  Future Evolution
```

Le MVP implémente uniquement la **répartition égale** entre les appartements concernés.

Règle d'arrondi déterministe obligatoire :

```text
part_de_base = total / nombre_de_logements   (division entière)
reste        = total - (part_de_base * nombre_de_logements)
```

Le reste est réparti **une unité par logement**, dans l'ordre croissant de la référence d'appartement, jusqu'à épuisement.

Invariant vérifié avant publication :

```text
somme(charge_allocations.amount_due) = charges.total_amount
```

**Impact si changé** : ajout de méthodes dans le moteur de répartition. Additif.

---

## DEC-030 : Documents de référence manquants

**Statut** : DÉDUITE

**Contradiction résolue** : trois documents étaient référencés et déclarés terminés alors qu'ils n'existent pas.

**Décision** :

| Document référencé | Résolution |
|---|---|
| *Data Model* | Le **Database Schema & Migration Specification** tient lieu de modèle de données. Aucun document séparé ne sera créé. |
| *Technical Architecture* | Couvert par **Master §22**, **Technical Decision Records & Architecture Governance** et **Development Specification §3**. Aucun document séparé ne sera créé. |
| *Screen & UX Specification* | **Lacune réelle et reconnue.** Les écrans P0 ne sont pas spécifiés au niveau détail. À produire pendant le Milestone 2, écran par écran, avant les tickets UI correspondants. |

Les listes de références et les tableaux d'état des documents sont corrigés en conséquence.

**Impact si changé** : aucun sur le code.

---

## DEC-036 : Formulaires et mutations de l'interface

**Statut** : DÉDUITE

**Date** : 27 septembre 2026

### Le problème

MVP-ENG-013 retient **React Hook Form** pour les formulaires. Or cette liste a été écrite avant le choix de Next 16 et React 19 (DEC-006), qui offrent les **Server Actions** et `useActionState`. Trois questions se posaient donc au premier écran : par quel mécanisme une mutation part de l'interface, où la validation est appliquée, et faut-il installer une bibliothèque de formulaires.

### La décision

**Les mutations d'interface passent par des Server Actions**, qui appellent exactement les mêmes cas d'usage que les routes HTTP. Une règle ne peut donc pas exister d'un côté et manquer de l'autre.

**La validation Zod est appliquée DANS le cas d'usage**, et non dans la route ni dans l'action. C'est ce qui garantit qu'aucun appelant ne peut l'oublier, et c'est la lecture stricte de « le schéma est appliqué avant la logique métier » (API section 47).

**L'état d'un formulaire vient de `useActionState`**, et l'état de soumission de `useFormStatus`. Les messages par champ sont renvoyés par le serveur, jamais recalculés côté client.

**React Hook Form n'est pas installé à ce lot.** Les formulaires d'immeuble comptent cinq champs sans dépendance entre eux : la bibliothèque n'apporterait rien qu'une dépendance de plus. Elle reste disponible pour un formulaire qui le justifiera, par exemple la création groupée d'appartements, dont les champs sont dynamiques.

**Tout formulaire fonctionne sans JavaScript.** Sur un réseau mobile guinéen, un script peut ne jamais arriver : la soumission native reste le comportement de repli, et la connexion passe pour cette raison par un gestionnaire de route et non par une Server Action.

### Conséquence sur l'autorisation

Une Server Action est joignable par une requête POST directe, indépendamment de l'écran qui l'expose. Chacune vérifie donc l'autorisation pour son propre compte. **Un bouton masqué n'est pas une sécurité**, il n'est qu'une honnêteté d'interface.

### Impact si changé

Introduire React Hook Form est additif et se fait formulaire par formulaire. Le contrat avec le serveur ne change pas, la validation restant côté serveur.

**Appliqué dans** : `src/app/(app)/immeubles/actions.ts`, `src/components/property/`, `src/modules/properties/service.ts`.

---

## DEC-037 : Socle d'interface introduit au Lot 4

**Statut** : DÉDUITE

**Date** : 27 septembre 2026

### Le problème

Trois documents se contredisaient en apparence. Le Lot 23 s'appelle « Design System Implementation », donc l'interface semblait devoir attendre. MVP-BACKLOG-018 exige pourtant les écrans d'immeuble au Lot 4. Et la Component Specification section 88 interdit explicitement de développer des écrans avant les primitives.

S'ajoutait la lacune consignée par DEC-030 : la **Screen & UX Specification n'existe pas**, et devait être produite écran par écran avant les tickets d'interface. Elle ne l'a pas été.

### La décision

**Le socle strictement nécessaire aux écrans du Lot 4 est construit maintenant**, dans l'ordre imposé par la section 88 : tokens, typographie, boutons, champs, navigation, cartes, statuts, retours, puis écrans.

**Les tokens sont ceux de la charte verrouillée** (DEC-012), exposés dans `globals.css` par le mécanisme `@theme` de Tailwind 4. Aucun composant ne contient de couleur littérale. Une table de correspondance entre les noms du document, en `color.action.primary`, et les noms Tailwind, en `action`, est inscrite dans le fichier : les points sont impossibles dans un nom de classe.

Primitives créées : `Button`, `SubmitButton`, `Field`, `Input`, `Textarea`, `Card`, `Badge`, `PropertyStatusBadge`, `Alert`, `EmptyState`, `PageHeader`, `AppHeader`, `PropertyCard`.

### Écrans livrés, qui tiennent lieu de spécification d'écran

En l'absence de Screen & UX Specification, cette liste est la référence jusqu'à ce que le Lot 22 ou 23 la remplace. Elle est dérivée de l'Information Architecture sections 4 et 5.3, de la Component Specification sections 23, 39, 45 et 60, du parcours 2 des User Flows et du PRD section 10.3.

```text
/connexion                          telephone et mot de passe, sans inscription
/immeubles                          liste, recherche, filtre actifs/archives/tous, pagination
/immeubles/nouveau                  creation, proprietaire seul
/immeubles/[id]                     fiche, informations, occupation, actions
/immeubles/[id]/modifier            modification, gestionnaire compris
/immeubles/[id]/archiver            confirmation d'archivage, proprietaire seul
```

Recherche, filtre et page vivent dans l'**URL** et non dans un état local : l'écran est partageable, le bouton retour fonctionne, et la recherche marche sans JavaScript.

### L'écran de connexion, livré hors périmètre du ticket

Le Lot 2 a construit le service d'authentification, pas son interface, et aucun ticket ne demande d'écran de connexion. Sans lui, **les écrans de ce lot sont inatteignables par un humain**, donc MVP-BACKLOG-018 serait invérifiable. Il est donc livré, réduit au strict nécessaire. Le parcours complet, activation d'une invitation comprise, reste au lot Gestionnaires (ADR-008, DEC-026).

### Ce qui est délibérément reporté

| Élément | Raison |
|---|---|
| `BottomNavigation` | Le produit n'a qu'une destination à ce lot. Une barre d'onglets à une entrée est un ornement. Elle arrive au lot Appartements. |
| Thème sombre | La charte n'en définit pas. En inventer un anticiperait le Lot 23 avec des valeurs que personne n'a validées. |
| `Toast`, `Skeleton`, `Modal`, `BottomSheet` | Aucun écran de ce lot n'en a besoin : la confirmation d'archivage est une page, plus lisible sur téléphone et fonctionnelle sans JavaScript. |
| Tests de rendu de composants | `jsdom` et React Testing Library ne sont pas installés. MVP-BACKLOG-019 demande des tests de création, modification, archivage, permissions et isolation, qui sont tous des tests de cas d'usage. |
| Indicateur financier de `PropertyCard` | Aucun montant n'existe avant le lot Loyers. Un zéro serait lu comme une information. |

### Le chrome ne porte pas d'identité

L'en-tête affiche le **rôle** de l'utilisateur, jamais son nom. Ce qui sert en permanence est le point de vue depuis lequel les données se lisent, puisqu'il commande le périmètre visible. Bénéfice secondaire réel : une capture d'écran qui circule ne divulgue pas l'identité d'un agent.

### Impact si changé

Le Lot 23 consolidera ces primitives. Les valeurs de couleur et de typographie étant déjà celles de la charte verrouillée, un changement portera sur les composants, pas sur la palette.

**Appliqué dans** : `src/app/globals.css`, `src/app/layout.tsx`, `src/components/`, `src/app/(app)/`, `src/app/connexion/`.

---

## DEC-038 : Base de développement de secours, sans virtualisation

**Statut** : DÉDUITE

**Date** : 28 septembre 2026

### Le problème

DEC-007 fixe PostgreSQL via Docker comme base de développement. Docker Desktop 4.92 a été installé le 28 septembre 2026, et son moteur Linux ne démarre pas : la machine de développement a **Intel VT-x désactivé dans son microprogramme** et **aucun WSL installé**. Le journal de Docker le dit sans ambiguïté, « backend is not running ».

Lever ces deux verrous demande un passage par le BIOS et une installation en droits administrateur, donc une action du fondateur, qui n'est pas développeur. Sans base locale, **aucun écran du produit ne peut être affiché ni vérifié** : le Lot 4 a été livré sans qu'un seul de ses six écrans ait jamais été rendu.

### La décision

Un script de secours, `npm run db:pglite`, sert **PGlite sur le port 5432**, par `@electric-sql/pglite-socket`. C'est le moteur déjà retenu pour les tests par DEC-035, PostgreSQL 17 compilé en WebAssembly, mais exposé cette fois sur le réseau local plutôt qu'appelé dans le processus.

Conséquence pratique : `DATABASE_URL` ne change pas, et **aucun code applicatif ne sait que le moteur n'est pas un serveur classique**. `drizzle-kit migrate`, le seed, l'application et `drizzle-kit studio` s'y connectent normalement.

Les données sont persistées dans `.pglite/`, ignoré par git : migration et seed ne sont pas à rejouer à chaque démarrage, et une donnée saisie à l'écran survit à un redémarrage du serveur.

### Ce que cette décision ne change pas

**DEC-007 reste la référence.** Docker demeure la base de développement du projet, et ce script est une porte de sortie pour une machine empêchée, pas un remplacement.

**Les limites de PGlite consignées par DEC-035 s'appliquent telles quelles** : extensions, réglages serveur et comportements de concurrence peuvent différer d'un vrai serveur. Un comportement qui en dépend doit être validé sur le vrai moteur, en local une fois la virtualisation débloquée, ou en staging.

Le serveur n'a ni authentification, ni chiffrement, ni sauvegarde. Il n'écoute que sur `127.0.0.1` et refuse de démarrer si `NODE_ENV` vaut `production`.

### Impact si changé

Aucun sur le code applicatif. Le jour où Docker démarre, `npm run db:start` reprend son rôle et ce script peut rester inutilisé ou être retiré, sans qu'une ligne de code métier bouge.

**Appliqué dans** : `scripts/db-pglite.ts`, `package.json`, `.gitignore`, README.

---

## DEC-039 : Archivage d'un appartement

**Statut** : VERROUILLÉE

**Date d'ouverture** : 28 septembre 2026. **Confirmée par le fondateur le 28 septembre 2026.**

### La lacune découverte

Le Lot 5 a rencontré un manque que les Lots 1 et 3 avaient laissé passer sans qu'il soit visible.

La matrice des rôles, section 12 de `roles-permissions.md`, porte une ligne « Archiver un appartement », notée `A` pour le propriétaire et « Selon droits » pour le gestionnaire. La table `apartments` porte bien une colonne `archived_at` depuis le Lot 1, DEC-020 l'ayant prévue à côté du statut d'occupation.

Or **la permission `apartment.archive` n'existait pas au catalogue** écrit en code au Lot 3, et la résolution « selon droits » du 27 septembre 2026 ne l'avait pas tranchée : elle portait sur sept permissions, celle-ci n'en faisait pas partie.

### La décision

**`apartment.archive` est réservée au PROPRIÉTAIRE.**

Le motif est celui qui a déjà servi pour `property.archive` : retirer un logement de l'exploitation est un acte **patrimonial**, et la liste des capacités du gestionnaire ne contient aucun acte de cette nature. Un gestionnaire garde la main sur tout l'opérationnel de son périmètre, `apartment.create` et `apartment.update` comprises.

La mention « selon droits » de cette ligne est donc résolue comme les sept autres, et la matrice n'en porte plus aucune sans référent.

### Ce que l'archivage fait, et ne fait pas

```text
archived_at renseigne       le logement sort de l exploitation
statut d occupation         CONSERVE, tel qu il etait (DEC-019, DEC-020)
historique                  intact et consultable (BR-025)
modification ulterieure     refusee
suppression physique        jamais (DEC-020 point 6)
```

**L'archivage d'un immeuble ne cascade pas sur ses appartements.** Un immeuble archivé bloque déjà toute opération sur ses logements, qui restent individuellement actifs : leur statut d'occupation reste la dernière information vraie, et les archiver en masse effacerait cette distinction sans rien apporter.

**Un logement archivé conserve sa référence.** La contrainte d'unicité `(property_id, number)` porte sur toutes les lignes, archivées comprises : « A04 » reste pris. C'est la même règle que pour le nom d'un immeuble, et pour la même raison, deux lignes homonymes seraient indistinguables dans un historique de bail.

**Aucun désarchivage au MVP.** Aucun document ne le prévoit, et l'introduire demanderait de décider ce que devient un logement qui revient dans le parc après un bail passé. La question se posera si le besoin apparaît.

**Impact si changé** : une ligne dans `MANAGER_PERMISSIONS` suffirait à l'ouvrir au gestionnaire, et le test qui fige les exclusions le rendrait visible en revue.

---

## DEC-040 : Méthode de vérification du rendu mobile

**Statut** : DÉDUITE

**Date** : 28 septembre 2026

### Le problème

Le Mobile First est un principe verrouillé du projet, et MVP-UI-001 fait du téléphone l'écran de référence. Il n'existait pourtant aucune méthode pour le vérifier.

Le Lot 4 avait été parcouru en redimensionnant la fenêtre du navigateur. Au Lot 5, cette fenêtre a refusé toute réduction de largeur : le rendu mobile est resté non vérifié, et le lot a été intégré avec ce manque assumé. Une méthode qui dépend de la coopération d'une fenêtre n'est pas une méthode.

### La décision

Le rendu mobile se vérifie par **`Emulation.setDeviceMetricsOverride` du protocole CDP**, sur un Chrome lancé en mode `--headless=new` avec un profil jetable.

C'est ce qui change tout : cette commande fixe le viewport que la PAGE perçoit. Les media queries répondent réellement, sans que la taille de la fenêtre entre en jeu. Le pilote tient en un fichier sans aucune dépendance, Node 24 fournissant `WebSocket` et `fetch` nativement, ce qui compte sur une machine où la mémoire manque.

**Deux largeurs de référence** : **360 px**, le plus petit écran courant en Guinée, et **390 px**, le format des iPhone récents.

### Ce qui est vérifié, et comment

Trois mesures faites DANS la page, parce qu'une capture d'écran montre ce qui va mal sans le nommer :

```text
debordement horizontal   scrollWidth compare a clientWidth, page entiere
                         puis element par element, hors conteneurs defilants
cible tactile            hauteur inferieure a 44 px, seuil impose par le projet
texte coupe              scrollWidth d un element compare a son clientWidth
```

**Une mesure ne suffit pas pour une cible tactile.** Un lien peut étendre sa zone par un pseudo-élément qui recouvre son conteneur : sa propre boîte ment alors sur ce qui est touchable. La vérification se fait donc aussi par un **clic réel** à des coordonnées réelles, ce qui est de toute façon ce que fait un utilisateur.

Un **parcours interactif** complète l'audit : chaque étape est un vrai clic, et il enchaîne création groupée, création unitaire, modification, effacement d'un champ et navigation. Ses références portent un suffixe tiré de l'horloge, faute de quoi il n'est jouable qu'une fois.

### Ce que cette méthode a trouvé au Lot 5

Six points, dont aucun n'était visible au typage, aux tests, ni au build :

```text
cibles tactiles    titres de carte a 28 par 22 px, sur les deux listes
onglets coupes     « En maintenance » debordait de 14 px a 360 px
bouton non pleine  largeur sur « Creer les logements », contrairement
  largeur          aux autres actions de formulaire
en-tete            lien du titre a 20 px de haut, sur tous les ecrans
decompte trompeur  « 3 logements » pour un immeuble qui en compte seize,
                   des qu une recherche etait active
serie invisible    apres une creation groupee, la serie atterrissait en
                   page 2 d une liste paginee
```

### L'outil, depuis le 2 octobre 2026

La méthode est devenue un outil du dépôt, `scripts/mobile/`, lancé par `npm run mobile -- <chemin>...`. Elle ne se perd donc plus à chaque changement de session ou de machine, ce qui était arrivé aux scripts du 28 septembre.

```text
cdp.ts      pilote du protocole, sans dépendance
audit.ts    mesures exécutées dans la page
report.ts   verdict et seuils, pur, couvert par tests/tooling
run.ts      lanceur : connexion, parcours des adresses, résumé, code de sortie
```

L'outil est en **lecture seule** : il ne fait que naviguer, hormis la connexion. Un parcours qui agit, comme un archivage, s'écrit à part avec `tap` et `waitForUrl` sur des données jetables, car une archive n'a pas de retour. Il est **local seulement** : il se connecte avec le mot de passe de développement et refuse toute adresse autre que `localhost`.

**Ce que l'outil a appris en étant éprouvé**, à ne pas désapprendre :

1. **Le débordement se lit contre la largeur DEMANDÉE, jamais contre le viewport mesuré.** En émulation mobile, comme sur un vrai téléphone, un contenu de 500 px ne fait pas défiler la page : Chrome élargit le viewport à 500 px, et `scrollWidth` reste égal au viewport. Une règle « scrollWidth supérieur au viewport » ne se déclenche donc jamais. Constaté avec une page témoin à défauts connus.
2. **Chrome impose un plancher d'environ 330 px** à l'émulation : 240 px demandés livrent 330 px, sans erreur. L'outil le signale avec ses deux causes possibles.
3. **Une zone cliquable étendue doit appartenir au lien lui-même**, par son `::after`. Un élément voisin qui recouvre le lien le rend inatteignable, et la mesure par `elementFromPoint` le rapporte ainsi.
4. **Un élément réduit à un pixel est le motif « réservé aux lecteurs d'écran »**, coupé exprès : il n'est pas un texte coupé.
5. **`npm run start` ne convient pas à PGlite.** Le client de base ouvre une connexion hors production et cinq en production, et PGlite n'en accepte qu'une : Chrome, qui envoie des requêtes en parallèle, provoque des `read ECONNRESET`, alors que des requêtes `curl` en série passent. Vérifier sous `npm run dev`.
6. **Un cache `.next/dev` périmé peut faire répondre 404 sur toutes les routes**, sans aucune erreur dans les journaux. Arrêter `next dev`, déplacer `.next/dev`, relancer.
7. **Git Bash déforme les arguments qui commencent par `/`** en chemins Windows. L'outil accepte les chemins sans `/` initial et refuse clairement un chemin déformé.

Un test témoin, une page à défauts connus et à deux éléments légitimes, a servi à contrôler que l'outil voit ce qu'il doit voir et n'invente rien. Il a coûté deux corrections : la règle de débordement du point 1, et un montage de test erroné, un voisin recouvrant un lien, que la mesure avait pourtant correctement jugé.

**Impact si changé** : aucune règle métier. C'est une méthode de vérification, à appliquer sur tout lot qui produit des écrans.

---

# 7. Décisions ouvertes

Ces décisions nécessitent une validation explicite du fondateur.

Tant qu'elles ne sont pas tranchées, les lots indiqués ne doivent pas être développés.

Elles portent toutes sur la **sélection d'un fournisseur externe**. Aucune ne remet en cause le périmètre, le modèle de données ou les règles métier.

Règle commune :

> **Fournisseur non sélectionné, abstraction définie, intégration réelle ultérieure.**

Aucun fournisseur n'est écarté : une décision ouverte porte sur le choix, jamais sur l'exclusion.

---

## DEC-033 : Fournisseur de stockage objet

**Statut** : OUVERTE

**Bloque** : le lot **Documents**, les photos d'incident et les quittances téléchargeables.

**Ne bloque pas** : les lots antérieurs, à condition que l'interface `StorageProvider` soit définie dès le lot **Base de données**.

Contraintes connues :

- bucket **privé**, aucune URL publique permanente ;
- accès par URL signée à durée limitée après vérification des permissions ;
- validation de taille, type MIME et extension ;
- indépendance du filesystem local.

**Cloudflare R2 et les solutions compatibles S3 restent des candidats valides.** Aucun fournisseur n'est écarté. La décision porte sur la sélection, pas sur l'exclusion.

L'interface `StorageProvider` doit être définie dès le Lot 1 afin que ce choix n'impacte que l'adapter.

---

## DEC-034 : Fournisseur de paiement

**Statut** : OUVERTE

**Bloque** : uniquement le **paiement digital**.

**Ne bloque pas** : le paiement manuel, les créances, les allocations, les quittances et les tableaux de bord, qui constituent le cœur financier du MVP.

Contraintes connues :

- disponibilité en Guinée, mobile money ;
- webhooks signés, environnement de test, idempotence, réconciliation ;
- encapsulation obligatoire derrière `PaymentProvider`.

Aucun nom de fournisseur ne doit être inventé ou supposé dans le code ou la documentation.

Tant que cette décision est ouverte, le MVP fonctionne avec le **paiement manuel** comme unique moyen opérationnel.

---

# 8. Règles d'utilisation du registre

## REG-001 : Consulter avant d'implémenter

Avant toute tâche de développement, vérifier si le sujet fait l'objet d'une décision enregistrée.

---

## REG-002 : Ne jamais contourner une décision VERROUILLÉE

Une décision verrouillée ne peut être ni réinterprétée, ni élargie, ni contournée par une implémentation « plus pratique ».

---

## REG-003 : Signaler avant de dévier d'une décision DÉDUITE

Si l'implémentation révèle qu'une décision déduite est incorrecte ou impraticable, il faut le signaler et proposer une alternative, sans modifier silencieusement le comportement.

---

## REG-004 : Ne jamais implémenter une décision OUVERTE

Une décision ouverte ne doit pas être tranchée par défaut dans le code.

---

## REG-005 : Toute nouvelle décision structurante entre dans le registre

Une décision ayant un impact durable sur le produit, les données, la sécurité ou l'architecture doit être enregistrée ici, puis développée dans une ADR lorsque son impact le justifie.

---

## REG-006 : Le registre ne crée pas de périmètre

Le registre enregistre des décisions.

Il n'ajoute jamais de fonctionnalité au MVP.

Toute fonctionnalité reste gouvernée par le Master Product Specification et le MVP Scope & Feature Matrix.

---

# 9. Journal des révisions

| Version | Date | Contenu |
|---|---|---|
| 1.0 | 2026-09-19 | Création du registre. Enregistrement de DEC-001 à DEC-034. Consolidation documentaire initiale. |
| 1.1 | 2026-09-19 | Nom du produit verrouillé : **SIMANDOU IMMO** (DEC-031). Promotion en VERROUILLÉE de 13 décisions auparavant déduites : DEC-014 à DEC-020, DEC-022, DEC-023, DEC-025 à DEC-027, DEC-029. Clarification de DEC-008 : aucun fournisseur n'est écarté, R2 et les solutions compatibles S3 restent candidats. Hiérarchie documentaire renumérotée 1 à 9. Ordre des migrations aligné sur la séquence de référence. Élimination des définitions dupliquées. |
| 1.2 | 2026-09-26 | Verrouillage de DEC-032 : l'authentification est assurée par **Better Auth** avec son adaptateur Drizzle, tables dans notre PostgreSQL, identification téléphone et mot de passe, aucune adhérence à Supabase Auth. DEC-032 déplacée de la section 7 vers la section 5. Il ne reste que DEC-033 et DEC-034 ouvertes. |
| 1.3 | 2026-09-26 | Lot 0 exécuté. Les 33 documents sont réorganisés dans `docs/` selon la structure du Master §48, avec un dossier `08-execution/` ajouté pour les documents d'exécution. Les douze ADR (ADR-001 à ADR-012) sont rédigées dans `docs/architecture/adr/`, dont ADR-006 pour Better Auth. La table d'ADR dupliquée de la gouvernance d'architecture est remplacée par un renvoi vers l'index unique du dossier ADR, et ses sections 14 à 19 sont fusionnées en une section de correspondance. |
| 1.4 | 2026-09-27 | Suppression des 198 tirets cadratins répartis dans 28 documents, selon une règle par rôle syntaxique : deux-points quand le second membre définit le premier, virgule pour une incise, parenthèses pour une référence, mot explicite dans une cellule de tableau vide. La convention est inscrite dans les standards d'ingénierie sous MVP-ENG-093-bis, avec une commande de contrôle vérifiée. Aucune règle métier modifiée. |
| 1.5 | 2026-09-27 | Lot 1 exécuté. Enregistrement de DEC-035 : les tests automatisés utilisent PGlite, PostgreSQL en WebAssembly, et appliquent la vraie migration ; DEC-007 reste inchangée, Docker demeure la base de développement. Ajout de `tsx` pour l'exécution des scripts TypeScript. Correction d'un double séparateur en fin de section 5. |
| 1.6 | 2026-09-27 | Lot 2 exécuté. Consignation du résultat de la vérification exigée par DEC-032 : `better-auth` 1.7.6 est compatible avec Next 16.3.5 et React 19.2.8, aucune incompatibilité bloquante, donc aucune décision nouvelle. Téléphone et mot de passe sans OTP confirmés supportés nativement. `users.email` reste facultatif. Trois colonnes exigées par la bibliothèque ajoutées à `users` : `phone_verified`, `email_verified`, `image`. Connexion et inscription par email désactivées. Contrôle métier ajouté : un compte non ACTIF ou archivé n'obtient aucune session. |
| 1.7 | 2026-09-27 | Lot 3 exécuté. Le catalogue des 41 permissions et son association aux rôles sont écrits en code, et un test compare le catalogue à la liste de `database.md` section 11 afin que code et document ne puissent plus diverger. Résolution de la mention « selon droits » de la matrice, devenue sans référent depuis DEC-025 : cinq permissions sont réservées au propriétaire, `property.create`, `property.archive`, les trois `manager.*` en écriture, `manager.read` et `audit.read`. **Ces interprétations sont à confirmer avant le lot Gestionnaires.** Deux conséquences consignées : un gestionnaire n'atteint aucune ressource de niveau organisation, et un locataire n'atteint que ses propres données jusqu'au lot Contrats. Le service distingue `out-of-scope`, à traduire en NOT_FOUND, de `permission-denied`, à traduire en FORBIDDEN. |
| 1.8 | 2026-09-27 | Lot 4 exécuté, premier lot qui produit des écrans. **Confirmation par le fondateur de la résolution « selon droits » de DEC-025** : les cinq permissions restent réservées au propriétaire, `property.create` et `property.archive` comprises. La question du gestionnaire principal et secondaire reste ouverte, donc DEC-025 continue de bloquer le lot Gestionnaires. La formulation « ou un gestionnaire autorisé » du PRD section 10.3 est consignée comme sans référent depuis l'abandon de la délégation fine, et non comme une contradiction. Enregistrement de **DEC-036**, formulaires et mutations par Server Actions avec validation Zod dans le cas d'usage, React Hook Form non installé, fonctionnement sans JavaScript garanti. Enregistrement de **DEC-037**, socle d'interface introduit maintenant selon l'ordre imposé par la Component Specification section 88 : la liste des six écrans livrés y tient lieu de spécification d'écran, en attendant de combler la lacune consignée par DEC-030. Le périmètre de lecture des collections est dérivé du point de décision unique et non réécrit, et un test confronte ce filtre à `can()` sur les 41 permissions. L'écran de connexion est livré hors périmètre du ticket, faute de quoi MVP-BACKLOG-018 serait invérifiable. Deux défauts corrigés au passage : les fonctions de `@/lib/auth` lisaient l'environnement avant `headers()`, ce qui faisait échouer `next build` sur le pré-rendu de la connexion, et une surface client distincte du module Immeubles évite d'embarquer le pilote PostgreSQL dans le navigateur. |
| 1.9 | 2026-09-28 | **Les six écrans du Lot 4 ont été affichés et parcourus pour la première fois**, et le schéma appliqué pour la première fois hors du processus de test. Enregistrement de **DEC-038** : Docker Desktop est installé mais son moteur ne démarre pas, la machine ayant Intel VT-x désactivé dans son microprogramme et aucun WSL, donc un script de secours sert PGlite sur le port 5432 par `@electric-sql/pglite-socket`. DEC-007 reste la référence et les limites de DEC-035 s'appliquent telles quelles. Sept défauts corrigés, tous invisibles au typage et aux tests : `npm run db:seed` ne chargeait pas `.env` et n'avait donc jamais pu tourner ; deux connexions simultanées sur un moteur à session unique écrasaient leur instruction préparée, d'où un pool ramené à une connexion hors production ; l'en-tête passait sur deux lignes à 390 pixels ; le libellé d'un champ facultatif s'annonçait « Quartier(facultatif) » sans espace ; le message d'erreur d'un champ s'affichait après son aide plutôt qu'avant ; la fiche d'un immeuble n'avait pas de titre d'onglet ; et la confirmation d'archivage promettait de ne pas supprimer « ses 0 logement ». |
| 2.0 | 2026-09-28 | Lot 5 exécuté : les appartements. Le module, l'API des cinq routes de la section 12 et les quatre écrans sont livrés, la fiche d'appartement étant construite comme le point d'entrée que MVP-BACKLOG-023 exige. Enregistrement de **DEC-039**, OUVERTE : la matrice des rôles prévoit « Archiver un appartement » mais la permission `apartment.archive` n'est pas au catalogue écrit au Lot 3, et la résolution « selon droits » du 27 septembre ne l'a pas tranchée ; l'archivage n'est donc pas offert et le lien vers les archives est retiré de l'écran, le modèle et l'API restant prêts. Trois défauts corrigés, tous trouvés hors du typage et des tests : l'échappement des jokers `LIKE` avait perdu ses antislashs à l'écriture du fichier, ce que le lint a relevé et qu'un test qui passait par accident ne voyait pas ; la liste triait d'abord par étage, ce qui dispersait une série créée sans étage entre les logements du rez-de-chaussée, vu à l'écran ; et le décompte annonçait « 13 logements » pour un immeuble qui en compte quinze lorsqu'un filtre était actif. Deux améliorations d'interface : une page « introuvable » propre aux appartements, l'ancienne parlant d'immeuble alors que l'immeuble existait, et la surface préremplie avec la virgule décimale française. La conversion d'un formulaire vers l'entrée du cas d'usage est sortie du fichier de Server Actions vers `src/modules/apartments/form.ts` : un fichier `'use server'` ne pouvant exporter que des fonctions asynchrones, elle n'était testable qu'en pilotant un navigateur. **Le rendu mobile n'a pas pu être vérifié à l'œil** : la fenêtre du navigateur piloté a refusé tout redimensionnement en largeur dans cette session. |
| 2.1 | 2026-09-28 | **Rendu mobile du Lot 5 vérifié**, ce que la révision 2.0 avait laissé en suspens faute de pouvoir réduire la fenêtre du navigateur. Enregistrement de **DEC-040** : le rendu mobile se vérifie par `Emulation.setDeviceMetricsOverride` du protocole CDP sur un Chrome en mode sans interface, méthode qui fixe le viewport perçu par la page et ne dépend donc d'aucune fenêtre, aux deux largeurs de référence 360 et 390 pixels. Six points corrigés, aucun visible au typage, aux tests ni au build : les titres de carte n'offraient que 28 par 22 pixels au doigt, sur les deux listes, là où le projet impose 44 pixels ; l'onglet « En maintenance » débordait de 14 pixels à 360 pixels, les onglets se replient désormais sur deux rangées plutôt que de défiler en cachant le dernier ; le bouton « Créer les logements » n'était pas pleine largeur, contrairement aux autres actions de formulaire ; le lien du titre dans l'en-tête ne faisait que 20 pixels de haut, sur tous les écrans du produit ; le décompte annonçait « 3 logements » pour un immeuble qui en compte seize dès qu'une recherche était active ; et une série fraîchement créée atterrissait en page 2 d'une liste paginée, la création groupée renvoyant maintenant vers la liste préfiltrée sur le préfixe employé. Les espaces insécables qui lient un montant à sa devise et une surface à son unité sont figées par des tests : le français en emploie deux différentes, celle d'`Intl` pour les milliers et celle du produit devant l'unité, et les confondre ne se verrait que sur un téléphone. Une note erronée est corrigée dans l'en-tête de l'application : la BottomNavigation ne devient pas justifiée au lot Appartements, l'appartement étant un niveau 3 sous l'immeuble et n'ajoutant donc aucune destination de premier niveau. |
| 2.2 | 2026-10-02 | **Lot 5 clos : archivage d'un appartement.** DEC-039 passe à VERROUILLÉE : `apartment.archive` est réservée au propriétaire, le même motif patrimonial que `property.archive`. DEC-025 ne bloque plus rien : pas de gestionnaire principal ni secondaire au MVP, seul le propriétaire invite ou révoque. Les deux étaient confirmées par le fondateur le 28 septembre 2026 et intégrées par la PR #10, qui n'avait pas ajouté d'entrée à ce journal : elle l'est ici. **Le Lot 6 Gestionnaires est débloqué.** Le rendu mobile des deux écrans ajoutés a été vérifié à 360 et 390 px, et la règle a été éprouvée sur des logements jetables : le gestionnaire n'a ni bouton, ni page, et l'API répond 403 ; un second archivage et une modification après archivage répondent 409. **La méthode DEC-040 devient un outil du dépôt**, `scripts/mobile/`, dont la logique de verdict est couverte par des tests, avec sept enseignements consignés dans DEC-040, dont le plus important : en émulation mobile, un contenu trop large élargit le viewport au lieu de faire défiler la page, si bien que le débordement doit se lire contre la largeur demandée. |
