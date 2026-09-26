# Master Product Specification

## 1. Objet du document

Ce document constitue la **référence centrale du produit** pour le développement du MVP.

Il consolide les décisions et exigences définies dans l'ensemble des documents précédents afin d'éviter :

- les contradictions ;
- les doublons ;
- les fonctionnalités futures introduites par erreur dans le MVP ;
- les décisions techniques dispersées ;
- les ambiguïtés de vocabulaire ;
- les règles métier oubliées ;
- les différences entre produit, UX, backend et code.

En cas de divergence entre les anciens documents et celui-ci concernant le périmètre du MVP, **ce document devient la référence de consolidation**.

Les documents spécialisés restent applicables pour leurs détails respectifs.

---

# 2. Principe directeur du produit

**SIMANDOU IMMO** est un SaaS de gestion opérationnelle des immeubles et biens locatifs, adapté au contexte guinéen.

Sa promesse :

> **Complexe technologiquement. Simple humainement.**

> **Nom du produit — DEC-031, VERROUILLÉE.**
>
> Le nom officiel est **SIMANDOU IMMO**.
>
> Il s'agit d'un produit **distinct de SIMANDOU SEJOUR**. Aucun document, interface ou message ne doit confondre les deux.

Le système doit permettre à un propriétaire ou gestionnaire de piloter son patrimoine locatif depuis une interface extrêmement simple, principalement utilisée sur smartphone.

---

# 3. Positionnement produit

Le produit n'est pas simplement :

- un outil de suivi des loyers ;
- un carnet numérique ;
- un tableau Excel amélioré ;
- une application de paiement.

Il constitue une infrastructure opérationnelle permettant de relier :

```text id="y5e3vu"
Patrimoine
↓
Logements
↓
Locataires
↓
Contrats
↓
Loyers
↓
Paiements
↓
Charges
↓
Maintenance
↓
Dépenses
↓
Historique
```

---

# 4. Utilisateurs principaux

Le MVP repose sur trois profils principaux.

## Owner

### Français

Propriétaire.

### Mission

Posséder et superviser le patrimoine.

---

## Manager

### Français

Gestionnaire.

### Mission

Assurer la gestion opérationnelle déléguée des immeubles.

---

## Tenant

### Français

Locataire.

### Mission

Gérer son propre contexte locatif :

- logement ;
- contrat ;
- loyer ;
- paiements ;
- charges ;
- incidents ;
- documents.

---

# 5. Modèle d'accès

Le modèle repose sur :

```text id="9wspm0"
User
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
```

Le système utilise :

```text id="hthn5x"
RBAC
+
Scope
```

---

# 6. Règle fondamentale d'accès

Le frontend peut masquer une action.

Le backend doit toujours décider si l'action est autorisée.

La connaissance d'un identifiant ne donne jamais automatiquement accès à une ressource.

---

# 7. Onboarding

Le modèle d'entrée principal est l'invitation.

## Owner

```text id="2na3w0"
Create Account
↓
Create Organization
↓
Create Property
↓
Create Apartments
↓
Invite Manager
```

## Manager

```text id="n5oy7u"
Receive Invitation
↓
Accept
↓
Activate Account
↓
Access Assigned Properties
```

## Tenant

```text id="v5r5q7"
Receive Invitation
↓
Accept
↓
Activate Account
↓
Access Own Rental Context
```

---

# 8. Relations principales

Le cœur du modèle :

```text id="z1yqsr"
Organization
    │
    ├── Users
    │
    └── Properties
          │
          └── Apartments
                │
                └── Lease
                      │
                      └── Tenant
                            │
                            ├── Rent Installments
                            ├── Payments
                            ├── Receipts
                            ├── Charges
                            └── Incidents
                                  │
                                  └── Interventions
                                        │
                                        └── Expenses
```

---

# 9. Modèle de données fondamental

Les entités principales sont :

```text id="8hmik7"
Organization
User
User Access                 rôle + organisation
Manager Property Access     périmètre d'immeubles
Property
Apartment
Tenant Profile
Lease
Rent Installment            créance de loyer
Payment
Payment Allocation
Receipt
Charge
Charge Allocation           créance de charge
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

Tables de liaison documentaire (DEC-024) :

```text
Lease Documents
Charge Documents
Expense Documents
Incident Documents
Intervention Documents
```

Les tables supplémentaires nécessaires à l'infrastructure :

```text id="k6vj2r"
Idempotency Keys
Notification Preferences
```

**Hors périmètre MVP** (DEC-025) :

```text
Permissions
Access Permissions
```

Le rôle est porté par `User Access` sous forme d'enum. Aucune table `Role` distincte n'est nécessaire au MVP.

Le détail des colonnes, contraintes et index relève du **Database Schema & Migration Specification**, qui tient lieu de modèle de données (DEC-030).

---

# 10. Vocabulaire officiel

Les concepts principaux doivent utiliser les termes suivants.

| Concept | Terme technique | Terme UI |
|---|---|---|
| Organisation | Organization | Organisation |
| Utilisateur | User | Utilisateur |
| Propriétaire | Owner | Propriétaire |
| Gestionnaire | Manager | Gestionnaire |
| Locataire | Tenant | Locataire |
| Immeuble | Property | Immeuble |
| Appartement | Apartment | Appartement |
| Contrat | Lease | Contrat |
| Loyer | Rent | Loyer |
| Créance | Receivable | Créance |
| Échéance de loyer | Rent Installment | Échéance |
| Créance de charge | Charge Allocation | Part de charge |
| Paiement | Payment | Paiement |
| Affectation paiement | Payment Allocation | Affectation |
| Quittance | Receipt | Quittance |
| Charge | Charge | Charge |
| Incident | Incident | Incident |
| Intervention | Intervention | Intervention |
| Dépense | Expense | Dépense |
| Document | Document | Document |
| Notification | Notification | Notification |
| Rappel | Reminder | Rappel |

---

# 11. Règles métier financières fondamentales

## 11.0 Créance

Le modèle financier repose sur la notion de **créance** (`Receivable`).

Une créance est une somme due par un locataire, portant son propre montant, son propre solde et son propre statut.

Le MVP comporte **deux types de créance** :

```text
Rent Installment    créance de loyer pour une période
Charge Allocation   créance de charge pour une part répartie
```

Les deux partagent le même cycle de statut (DEC-015) et sont réglées par le même mécanisme d'allocation (DEC-022).

---

## 11.1 Loyer

Un contrat actif génère des échéances de loyer.

```text id="v15l3x"
Rent Installment
=
créance de loyer pour une période
```

---

## 11.2 Paiement

Un paiement représente une opération financière.

```text id="u6msw7"
Payment
≠
Receivable
```

Un paiement est relié aux créances qu'il règle par des **allocations**.

Un même paiement peut régler plusieurs créances, de types différents.

---

## 11.3 Solde

Pour une créance :

```text id="a3j41z"
Outstanding Balance
=
Due Amount
-
Allocated Payments
```

Pour un locataire :

```text
Total dû
=
somme des Outstanding Balance des créances ouvertes
```

Le solde d'une créance ne peut jamais être négatif.

---

## 11.3.1 Montant total dû

Le locataire voit un **montant global à payer**.

Le système conserve les **composantes séparées**.

```text
Créance de loyer    septembre    2 500 000 GNF
Créance de charge   eau            300 000 GNF
-------------------------------------------------
Total dû                         2 800 000 GNF
```

Voir DEC-005.

---

## 11.4 Paiement partiel

Exemple :

```text id="7r1j8l"
Dû : 2 800 000 GNF
Payé : 1 500 000 GNF
Reste : 1 300 000 GNF
```

Statut :

```text id="r5vpq0"
PARTIALLY_PAID
```

---

## 11.5 Paiement complet

```text id="4q2yce"
Dû : 2 500 000 GNF
Payé : 2 500 000 GNF
Reste : 0
```

Statut :

```text id="b4n87c"
PAID
```

---

## 11.6 Idempotence

Une transaction externe répétée ne doit pas créer plusieurs paiements métier.

---

## 11.7 Paiement supérieur au montant dû

Un paiement dont le montant dépasse le total dû restant du locataire est **refusé**.

```text
AMOUNT_EXCEEDS_OUTSTANDING
```

Le MVP ne comporte ni crédit, ni avoir, ni trop-perçu.

Voir DEC-023.

---

## 11.8 Convention monétaire

```text
amount    entier signé, dans la plus petite unité de la devise
currency  code ISO 4217 explicite
```

Pour le GNF, l'exposant de sous-unité est 0.

Aucun flottant dans un calcul financier. Aucune addition inter-devises implicite.

Voir DEC-014.

---

# 12. Charges communes

Le MVP supporte **uniquement la répartition uniforme** (DEC-029).

Exemple :

```text id="8wrjkp"
Charge totale = 3 600 000 GNF
Logements = 12

Part =
3 600 000 ÷ 12
=
300 000 GNF
```

Le système doit garantir que :

```text id="fv07eh"
Somme des allocations
=
Montant de la charge
```

y compris lorsqu'une règle d'arrondi est nécessaire. La règle d'arrondi est déterministe : le reste de la division entière est distribué à raison d'une unité par logement, par référence d'appartement croissante.

## 12.1 La part de charge est une créance

La publication d'une charge crée, pour chaque appartement concerné, une **créance payable distincte du loyer**.

```text
Charge
↓
Répartition
↓
Charge Allocation = créance payable
↓
Allocation d'un paiement
```

Voir DEC-005.

---

# 13. Maintenance

L'incident et l'intervention possèdent **deux cycles de statut distincts**.

## 13.1 Cycle de l'incident

```text id="4mjm49"
OPEN
↓
ASSIGNED
↓
IN_PROGRESS
↓
RESOLVED
↓
CLOSED
```

`ON_HOLD` peut s'intercaler. Voir DEC-017 pour la liste exhaustive des transitions autorisées.

## 13.2 Cycle de l'intervention

```text
PLANNED
↓
IN_PROGRESS
↓
COMPLETED
```

ou `CANCELLED`. Voir DEC-018.

La clôture d'une intervention ne clôture pas automatiquement l'incident.

Un incident et une intervention sont deux concepts différents.

```text id="ndm6fu"
Incident
=
problème signalé

Intervention
=
action réalisée
```

---

# 14. Historique

Le système doit préserver l'historique.

Notamment :

- changement de locataire ;
- fin de contrat ;
- révocation gestionnaire ;
- paiements ;
- quittances ;
- charges ;
- incidents ;
- dépenses.

Le principe est :

```text id="x11y7u"
Archive / End / Revoke
>
Delete
```

lorsque l'historique doit être conservé.

---

# 15. MVP : périmètre obligatoire

## MVP-001 : Authentification

- création de compte propriétaire ;
- connexion ;
- déconnexion ;
- récupération de compte ;
- gestion des sessions.

---

## MVP-002 : Organisation

- création ;
- contexte organisationnel ;
- isolation.

---

## MVP-003 : Rôles

- Owner ;
- Manager ;
- Tenant.

---

## MVP-004 : Permissions

- RBAC : rôle `OWNER` | `MANAGER` | `TENANT` ;
- scope : organisation, et liste d'immeubles pour un `MANAGER` ;
- catalogue de permissions `resource.action` défini en code et mappé par rôle ;
- contrôle serveur systématique ;
- révocation immédiate.

Le MVP évalue les droits sur **deux dimensions uniquement : rôle + périmètre** (DEC-025).

La délégation fine par gestionnaire est classée FUT-017.

---

## MVP-005 : Immeubles

- création ;
- consultation ;
- modification ;
- archivage.

---

## MVP-006 : Appartements

- création ;
- consultation ;
- modification ;
- statut ;
- historique d'occupation.

---

## MVP-007 : Gestionnaires

- invitation ;
- activation ;
- attribution de périmètre ;
- modification ;
- révocation.

---

## MVP-008 : Locataires

- création ;
- invitation ;
- activation ;
- consultation ;
- fin de relation locative.

---

## MVP-009 : Contrats

- création ;
- activation ;
- fin ;
- historique.

---

## MVP-010 : Loyers

- génération des échéances ;
- statuts ;
- solde ;
- retard.

---

## MVP-011 : Paiements

- paiement manuel ;
- paiement digital — **architecture seule**, provider OUVERT (DEC-034) ;
- paiement partiel ;
- allocation multi-créances loyer et charge (DEC-022) ;
- refus du paiement supérieur au montant dû (DEC-023) ;
- confirmation serveur uniquement (DEC-009) ;
- idempotence.

---

## MVP-012 : Quittances

- génération ;
- ventilation loyer / charges ;
- consultation ;
- historique.

---

## MVP-013 : Charges

- création ;
- répartition uniforme (DEC-029) ;
- aperçu avant publication ;
- publication créant une **créance de charge payable** par appartement (DEC-005) ;
- suivi du solde de chaque part.

---

## MVP-014 : Incidents

- déclaration ;
- description ;
- photos ;
- suivi.

---

## MVP-015 : Interventions

- affectation ;
- statut ;
- coût ;
- résolution.

---

## MVP-016 : Dépenses

- création ;
- association ;
- justificatifs ;
- historique.

---

## MVP-017 : Notifications

- notifications internes ;
- invitations ;
- paiements ;
- charges ;
- incidents ;
- rappels essentiels.

---

## MVP-018 : Dashboards

- Owner ;
- Manager ;
- Tenant.

---

## MVP-019 : Documents

- upload ;
- stockage privé ;
- consultation sécurisée.

---

## MVP-020 : Recherche

- recherche contextualisée ;
- filtres essentiels.

---

## MVP-021 : Activity

- activité utilisateur ;
- historique opérationnel.

---

## MVP-022 : Audit

- opérations sensibles ;
- paiements ;
- permissions ;
- révocations ;
- corrections.

---

# 16. MVP : sécurité obligatoire

Le MVP ne peut pas être considéré comme terminé sans :

```text id="5k1m8d"
Authentication
+
RBAC
+
Scope
+
Organization Isolation
+
Server Authorization
+
IDOR Protection
+
Rate Limiting
+
Webhook Security
+
Idempotency
+
Private Storage
+
Audit
```

---

# 17. MVP : responsive

Toutes les interfaces sont :

> **Responsive Mobile First.**

Le smartphone est le format de référence.

Les interfaces sont ensuite adaptées à :

- tablette ;
- desktop.

Le mobile n'est jamais une version secondaire du desktop.

---

# 18. MVP : états UI obligatoires

Chaque écran critique doit gérer :

```text id="r2rgdu"
Loading
Empty
Success
Error
Unauthorized
Not Found
```

---

# 19. MVP : accessibilité

Les parcours critiques doivent notamment supporter :

- navigation clavier sur desktop ;
- labels ;
- focus ;
- contrastes suffisants ;
- statuts compréhensibles ;
- interactions tactiles adaptées ;
- alternatives aux informations dépendant uniquement de la couleur.

---

# 20. MVP : performance

Objectifs initiaux :

```text id="b4s5cj"
API courantes :
P50 < 300 ms
P95 < 800 ms
```

hors appels externes intrinsèquement plus lents.

Les objectifs seront réévalués à partir des données réelles.

Le produit doit être testé sur :

- smartphone ;
- réseau mobile raisonnable ;
- réseau dégradé.

---

# 21. MVP : fiabilité

Le système doit notamment supporter :

- retries contrôlés ;
- idempotence ;
- concurrence ;
- timeouts ;
- reprise des jobs ;
- gestion des fournisseurs indisponibles.

---

# 22. MVP : infrastructure

Architecture de référence — voir DEC-006 :

```text id="91c168"
Next.js (App Router)
+
React
+
TypeScript strict
+
Tailwind CSS
+
shadcn/ui
+
PostgreSQL
+
Drizzle ORM
+
Zod
+
React Hook Form
+
TanStack Query (uniquement lorsque nécessaire)
```

Architecture applicative :

```text id="a4kpwq"
Modular Monolith
```

Un seul repository. Pas de microservices. TypeScript end-to-end. PostgreSQL reste la source de vérité.

**Note de version** : le repository utilise Next.js 16 et React 19. Les conventions de cette version priment sur les exemples génériques de la documentation. Consulter `node_modules/next/dist/docs/` avant d'écrire du code Next.js.

## 22.1 Environnements

Voir DEC-007 :

| Environnement | Base de données | Application |
|---|---|---|
| Local | PostgreSQL via Docker | Next.js local |
| Development | Supabase PostgreSQL | Vercel |
| Staging | Supabase PostgreSQL | Vercel |
| Production | Supabase PostgreSQL | Vercel |

Supabase est utilisé comme **fournisseur PostgreSQL managé**, pas comme framework applicatif.

En conséquence :

- l'accès aux données passe exclusivement par Drizzle ;
- l'autorisation est implémentée dans le service applicatif, pas dans des politiques RLS ;
- aucune fonctionnalité métier ne dépend d'une capacité propre à Supabase.

---

# 23. MVP : infrastructure externe

Services externes et leur statut au MVP — voir DEC-008, DEC-026, DEC-027, DEC-028 :

| Service | Statut MVP | Décision |
|---|---|---|
| Base de données | Actif | PostgreSQL — Docker local, Supabase ailleurs |
| Hébergement applicatif | Actif | Vercel |
| Jobs / tâches planifiées | Actif | Cron plateforme + routes internes protégées |
| Authentification | Actif | **Better Auth** avec adaptateur Drizzle (DEC-032) |
| Object Storage | Requis | **DEC-033 OUVERTE** |
| Payment Provider | Architecture seule | **DEC-034 OUVERTE** — paiement manuel seul au MVP |
| Email Provider | Adapter inerte | Reporté (DEC-008) |
| SMS Provider | Adapter inerte | Reporté (DEC-008) |
| WhatsApp Provider | Adapter inerte | Reporté (DEC-008) |
| Monitoring | Non intégré | Logs structurés + logs plateforme |
| Analytics | Adapter inerte | Taxonomie définie, envoi désactivé |

Aucun nom de fournisseur ne doit être inventé ou supposé dans le code tant que la décision correspondante est OUVERTE.

**Conséquence sur les invitations** : au MVP, l'invitation est diffusée par **lien de partage sécurisé** copié par l'inviteur (DEC-026).

**Conséquence sur les notifications** : au MVP, le seul canal actif est **`IN_APP`** (DEC-027).

---

# 24. MVP : principe d'abstraction

Les fournisseurs externes doivent être encapsulés.

Exemple :

```text id="90z8r9"
PaymentService
↓
PaymentProviderAdapter
↓
External Provider
```

Même logique pour :

- stockage ;
- email ;
- SMS ;
- WhatsApp.

---

# 25. MVP : DevOps

Minimum :

```text id="q8s6eg"
Local
Development
Staging
Production
```

CI :

```text id="8e2cp8"
Lint
↓
Typecheck
↓
Tests
↓
Build
```

Production :

```text id="lqq5ao"
CI
↓
Validation
↓
Deploy
↓
Smoke Test
↓
Monitoring
```

---

# 26. MVP : sauvegardes

Obligatoire :

- backup PostgreSQL ;
- rétention ;
- test de restauration ;
- stratégie de récupération des fichiers.

---

# 27. MVP : monitoring

Surveiller au minimum :

```text id="72sbxs"
Application
Database
Jobs
Payments
Notifications
Storage
```

---

# 28. MVP : analytics

Le tracking doit rester minimal et répondre à des questions produit concrètes.

Événements essentiels :

```text id="o40q9p"
sign_up_completed
manager_invitation_accepted
tenant_activated
property_created
lease_created
payment_confirmed
charge_published
incident_created
intervention_completed
```

Les analytics ne sont jamais la source de vérité financière.

---

# 29. MVP : confidentialité

Principes :

```text id="w1h4ei"
Minimisation
+
Need to know
+
Isolation
+
Private Documents
+
Controlled Notifications
```

Les données sensibles ne doivent pas être envoyées inutilement à l'analytics ou aux canaux externes.

---

# 30. MVP : intégrations

## Payment

Flux :

```text id="18khjl"
Initiate
↓
Pending
↓
Provider Confirmation
↓
Confirmed
↓
Allocation
↓
Receipt
```

---

## Notifications

Flux :

```text id="31mxkr"
Business Event
↓
Notification
↓
Provider
↓
Delivery
```

L'échec d'une notification ne doit pas nécessairement annuler l'opération métier.

---

## Documents

Flux :

```text id="3xj1z6"
Upload
↓
Validation
↓
Private Storage
↓
Authorized Access
```

---

# 31. MVP : tests obligatoires

## Unit

- calculs ;
- statuts ;
- permissions ;
- allocations ;
- transitions.

## Integration

- API ;
- database ;
- paiements ;
- webhooks ;
- jobs.

## E2E

- onboarding Owner ;
- invitation Manager ;
- invitation Tenant ;
- contrat ;
- loyer ;
- paiement ;
- charge ;
- incident ;
- révocation.

## Security

- IDOR ;
- isolation ;
- escalation ;
- documents ;
- webhooks.

## Responsive

- smartphone ;
- tablette ;
- desktop.

## UAT

- Owner ;
- Manager ;
- Tenant.

---

# 32. MVP : parcours critiques

## Owner

```text id="y0r7dq"
Create Account
→ Organization
→ Property
→ Apartments
→ Manager
```

---

## Manager

```text id="pxv7sx"
Accept
→ Tenant
→ Lease
→ Rent
→ Payment
→ Charge
→ Maintenance
```

---

## Tenant

```text id="ygckx0"
Accept
→ Housing
→ Lease
→ Amount Due
→ Payment
→ Receipt
→ Charge
→ Incident
```

---

# 33. Future Evolutions

Les fonctionnalités suivantes ne doivent pas être développées dans le MVP :

## FUT-001

Application native iOS.

## FUT-002

Application native Android.

## FUT-003

Comptabilité avancée.

## FUT-004

Fiscalité automatisée.

## FUT-005

Gestion complète de copropriété.

## FUT-006

Marketplace de prestataires.

## FUT-007

Analytics avancés.

## FUT-008

IA immobilière.

## FUT-009

Multi-pays.

## FUT-010

White label.

## FUT-011

API publique.

## FUT-012

Réconciliation bancaire.

## FUT-013

Signature électronique avancée.

## FUT-014

Workflow engine configurable.

## FUT-015

Multi-provider avancé.

## FUT-016

Crédits, avoirs et trop-perçus.

Conséquence de DEC-023 : le MVP refuse tout paiement supérieur au montant dû. La gestion d'un solde créditeur au profit du locataire est reportée.

## FUT-017

Permissions granulaires par gestionnaire.

Conséquence de DEC-025 : le MVP évalue les droits sur rôle + périmètre uniquement. Les tables `permissions` et `access_permissions` et l'écran de délégation à cases à cocher sont reportés.

## FUT-018

Distinction gestionnaire principal / gestionnaire secondaire.

## FUT-019

Répartition de charge personnalisée et répartition selon consommation.

Conséquence de DEC-029 : le MVP implémente uniquement `EQUAL`.

## FUT-020

Remboursement de paiement (`REFUNDED`).

Conséquence de DEC-016 : au MVP, une correction utilise `CANCELLED` avec trace d'audit.

---

# 34. Architecture Constraints

Les contraintes suivantes doivent être respectées dès le MVP.

## ARCH-001 : User ≠ Role

Un User ne doit pas être modélisé comme une identité distincte pour chaque rôle.

---

## ARCH-002 : User ≠ Tenant Profile

Le changement de logement ne doit pas nécessiter la recréation d'un compte utilisateur.

---

## ARCH-003 : History Preservation

Les relations historiques doivent être conservées.

---

## ARCH-004 : Modular Monolith

Les frontières métier doivent rester explicites.

---

## ARCH-005 : Provider Abstraction

Les services externes doivent être remplaçables.

---

## ARCH-006 : API Reusability

Le backend ne doit pas être conçu comme une simple extension de l'interface actuelle.

---

## ARCH-007 : Mobile First

Les composants frontend doivent être pensés smartphone d'abord.

---

## ARCH-008 : Async Jobs

Les tâches longues doivent être indépendantes du cycle de requête interactif.

---

## ARCH-009 : Private Storage

Les documents ne doivent pas dépendre du filesystem local.

---

## ARCH-010 : Database as Source of Truth

Les données métier transactionnelles restent dans PostgreSQL.

---

## ARCH-011 : Financial Integrity

Les opérations financières doivent rester atomiques et idempotentes lorsque nécessaire.

---

## ARCH-012 : Security by Design

Les permissions doivent être intégrées au backend dès l'implémentation initiale.

---

# 35. Out of Scope

Les éléments suivants sont explicitement hors périmètre du MVP :

```text id="0f5h6c"
Microservices
Kubernetes
Multi-region HA
Full Accounting
Full ERP
Blockchain
Complex AI
Native Mobile
Complete Copropriété
Public API
Advanced Marketplace
Full BI Platform
```

---

# 36. Règle de périmètre

Avant toute nouvelle fonctionnalité, déterminer :

```text id="vmxkgu"
MVP ?
Future ?
Architecture Constraint ?
Out of Scope ?
```

Une fonctionnalité `Future` ne doit pas rejoindre le MVP simplement parce qu'elle est facile à développer.

---

# 37. Règle de modification du MVP

Une modification du périmètre doit être accompagnée de :

- justification ;
- impact ;
- dépendances ;
- tests supplémentaires ;
- impact planning ;
- éventuelle mise à jour du backlog.

---

# 38. Règle Claude Code

Claude Code doit traiter ce document comme une référence de périmètre.

Avant toute tâche :

```text id="4nkw9n"
Lire Master Product Specification
↓
Identifier catégorie
↓
Vérifier documents spécialisés
↓
Inspecter code
↓
Implémenter
↓
Tester
```

---

# 39. Règle de non-débordement

Claude Code ne doit pas ajouter automatiquement :

- nouvelles fonctionnalités ;
- nouvelles abstractions ;
- nouveaux providers ;
- nouveaux modèles ;
- nouveaux modules ;

simplement parce qu'ils pourraient être utiles plus tard.

---

# 40. Règle de changement architectural

Si une tâche nécessite un changement structurel important :

```text id="6n1c9k"
Identifier le besoin
↓
Vérifier l'architecture
↓
Évaluer les alternatives
↓
ADR si nécessaire
↓
Implémenter
```

---

# 41. Règle de décision en cas d'ambiguïté

Lorsqu'un comportement n'est pas explicitement défini :

```text id="eug4t8"
1. Business Rules
2. Security
3. Data Model
4. API
5. UX
6. Choix MVP le plus simple
7. Documenter la décision si durable
```

---

# 42. Validation finale du MVP

Le MVP est prêt lorsque :

```text id="h4r0mg"
Core Product
+
Security
+
Finance Integrity
+
Mobile First
+
Tests
+
UAT
+
Monitoring
+
Backups
```

sont tous validés.

---

# 43. Master Release Gate

Aucune release MVP ne doit être considérée comme prête si un problème critique subsiste dans :

```text id="lq7j5a"
Authentication
Authorization
Organization Isolation
Payments
Data Integrity
Critical User Journeys
```

---

# 44. Relation entre les documents

Le système documentaire devient :

```text id="n7q0as"
MASTER PRODUCT SPECIFICATION
            │
            ├── Product / Business
            ├── UX / UI
            ├── Data
            ├── API
            ├── Security
            ├── Development
            ├── QA
            ├── DevOps
            ├── Privacy
            ├── Integrations
            └── Operations
```

Les documents spécialisés apportent les détails.

Le Master Specification définit le cadre commun.

---

# 45. Documents qui restent spécialisés

Les documents suivants restent référents pour leur niveau de détail :

```text id="4sukwk"
Security & Access Control
Database Schema & Migration
API & Backend
Product UX
Design System
Component Specification
Testing Strategy
Deployment & DevOps
Privacy
External Integrations
Performance
Disaster Recovery
```

---

# 46. Documents qui ne doivent plus créer de nouveau périmètre sans validation

Les documents de :

- QA ;
- DevOps ;
- analytics ;
- architecture ;
- opérations ;

ne doivent pas introduire silencieusement de nouvelles fonctionnalités produit.

---

# 47. Règle de priorité documentaire

En cas de contradiction :

```text id="ymfm6h"
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

- le **Decision Register** fait autorité sur **la décision elle-même** : statut verrouillé, déduit ou ouvert ;
- le **Master Product Specification** fait autorité sur **le cadre et le périmètre** ;
- le **MVP Scope & Feature Matrix** est **subordonné** au Master et détaille le périmètre ; il ne peut pas le contredire ;
- le **Database Schema & Migration Specification** tient lieu de modèle de données ; aucun document « Data Model » séparé n'existe (DEC-030).

Lorsque la contradiction concerne un sujet spécialisé, le document spécialisé reste la source de détail après résolution avec le Master Specification.

Un document de niveau inférieur ne peut jamais contredire un document de niveau supérieur. Toute contradiction détectée doit être corrigée dans le document de niveau inférieur.

---

# 48. Documentation finale du produit

Structure effective du repository, appliquée au Lot 0 :

```text
docs/
├── 00-decisions/
│   └── decision-register.md          registre central, priorité 1
│
├── 01-product/
│   ├── master-product-specification.md
│   ├── product-vision.md
│   ├── prd.md
│   └── mvp-scope.md
│
├── 02-ux/
│   ├── user-flows.md
│   ├── information-architecture.md
│   ├── ux-specification.md
│   ├── design-system.md
│   ├── visual-identity.md
│   ├── components.md
│   └── screen-specification.md       À PRODUIRE, lacune reconnue (DEC-030)
│
├── 03-domain/
│   ├── roles-permissions.md
│   ├── business-rules.md
│   └── glossary.md
│
├── 04-technical/
│   ├── api.md
│   ├── database.md                   tient lieu de modèle de données
│   ├── architecture-governance.md
│   ├── engineering-standards.md
│   └── integrations.md
│
├── 05-security/
│   ├── security.md
│   ├── privacy.md
│   └── accessibility.md
│
├── 06-quality/
│   ├── testing.md
│   ├── uat.md
│   └── traceability.md
│
├── 07-operations/
│   ├── deployment.md
│   ├── monitoring.md
│   ├── performance.md
│   ├── disaster-recovery.md
│   └── maintenance.md
│
├── 08-execution/
│   ├── development-plan.md
│   ├── backlog.md
│   └── handoff.md
│
└── architecture/
    └── adr/                          ADR-001 à ADR-012
```

`screen-specification.md` est le seul fichier annoncé et non encore produit. Son absence est assumée et tracée par DEC-030 : il doit être écrit écran par écran pendant le Milestone 2, avant les tickets UI correspondants.

---

# 49. Definition of Done documentaire

La consolidation documentaire est considérée comme suffisamment mature lorsque :

```text id="sk1q69"
[ ] MVP clairement défini
[ ] Future clairement séparé
[ ] Architecture Constraints identifiées
[ ] Out of Scope identifié
[ ] Vocabulaire cohérent
[ ] Parcours critiques cohérents
[ ] Data cohérentes
[ ] API cohérentes
[ ] Permissions cohérentes
[ ] Tests alignés
[ ] UAT aligné
```

---

# 50. Règle finale du projet

À partir de maintenant, toute nouvelle idée doit être traitée selon ce processus :

```text id="n9w7f6"
Nouvelle idée
↓
Besoin réel ?
↓
Déjà couvert ?
↓
MVP / FUT / ARCH / OUT
↓
Impact produit
↓
Impact technique
↓
Backlog
↓
Développement
↓
Tests
↓
Validation
```

Le produit ne doit plus évoluer par accumulation informelle.

Il doit évoluer par décisions explicites.

---

# 51. Principe directeur

Le produit doit rester :

```text id="q1cb6q"
Simple pour l'utilisateur
+
Rigoureux dans les règles
+
Sûr dans les données
+
Modulaire dans le code
+
Mesurable en production
+
Évolutif dans l'architecture
```

Le principe final est :

> **Le MVP doit être petit par son périmètre, mais sérieux dans sa construction. Tout ce qui n'est pas nécessaire maintenant doit être reporté ou anticipé architecturalement, pas glissé silencieusement dans la V1.**