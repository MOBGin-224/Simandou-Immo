# Development Specification & Implementation Plan

## 1. Objet du document

Ce document transforme les spécifications produit, UX, métier, sécurité, API et données en un plan de développement exécutable.

Il sert de référence pour :

- organiser le développement ;
- définir l'ordre d'implémentation ;
- découper le produit en modules et tâches ;
- réduire les dépendances inutiles ;
- guider Claude Code ;
- définir les critères de validation ;
- empêcher l'introduction prématurée de fonctionnalités non prévues pour le MVP ;
- préparer les tests et la mise en production.

Le développement doit suivre une logique :

```text
Produit
↓
Fondations techniques
↓
Domaine métier
↓
API / Backend
↓
Interface mobile first
↓
Tests
↓
Staging
↓
Validation
↓
Production
```

---

# 2. Principes de développement

## DEV-001 : Mobile First

Toutes les interfaces frontend sont développées selon le principe :

> Responsive Mobile First

Le smartphone constitue le format de référence.

La tablette et le desktop sont des adaptations de cette interface.

Aucune fonctionnalité du MVP ne doit être conçue d'abord pour desktop puis réduite pour mobile.

---

## DEV-002 : MVP contrôlé

Une fonctionnalité non nécessaire au fonctionnement du cœur du produit ne doit pas être ajoutée au MVP simplement parce qu'elle peut être développée.

Chaque fonctionnalité doit être classée dans l'une des catégories suivantes :

```text
MVP
Future Evolution
Architecture Constraint
Out of Scope
```

---

## DEV-003 : Architecture avant accélération

Claude Code doit respecter l'architecture définie avant de multiplier les fonctionnalités.

La vitesse de génération de code ne doit pas conduire à :

- dupliquer la logique métier ;
- contourner les permissions ;
- créer des routes incohérentes ;
- créer plusieurs sources de vérité ;
- introduire des bibliothèques inutiles.

---

## DEV-004 : Backend comme source d'autorité

Les règles métier critiques doivent être implémentées côté serveur.

Le frontend ne doit jamais être la source d'autorité pour :

- les permissions ;
- les montants ;
- les statuts ;
- les calculs financiers ;
- les allocations ;
- les accès aux ressources.

---

## DEV-005 : Une fonctionnalité complète

Une fonctionnalité considérée comme terminée doit inclure, lorsque nécessaire :

```text
Data
+
Business Logic
+
API
+
Authorization
+
UI
+
Validation
+
Tests
+
Audit
```

Une interface visuellement terminée mais sans contrôle backend n'est pas considérée comme terminée.

---

# 3. Architecture cible de développement

> **Stack verrouillée — DEC-006.**
>
> ```text
> Next.js (App Router) + React + TypeScript strict
> Tailwind CSS + shadcn/ui
> PostgreSQL + Drizzle ORM
> Zod + React Hook Form + TanStack Query (si nécessaire)
> ```
>
> Infrastructure — DEC-007 : Docker en local, Supabase PostgreSQL ailleurs, Vercel pour l'application.

Le MVP sera développé comme un **modular monolith**, dans un repository unique.

```text
Next.js
├── Presentation
├── Application
├── Domain
└── Infrastructure
```

Modules métier principaux :

```text
Auth
Organizations
Properties
Apartments
Managers
Tenants
Leases
Rents
Payments
Charges
Maintenance
Expenses
Notifications
Reports
Activity / Audit
```

---

# 4. Règles de structure du code

L'organisation exacte des dossiers pourra évoluer pendant l'implémentation, mais la séparation logique doit rester claire.

Exemple :

```text
src/
├── app/
├── components/
├── modules/
│   ├── auth/
│   ├── organizations/
│   ├── properties/
│   ├── apartments/
│   ├── managers/
│   ├── tenants/
│   ├── leases/
│   ├── rents/
│   ├── payments/
│   ├── charges/
│   ├── maintenance/
│   ├── expenses/
│   ├── notifications/
│   └── reports/
├── lib/
├── db/
└── tests/
```

Cette structure est indicative.

La règle importante est la séparation claire des responsabilités.

---

# 5. Classification des travaux

## 5.1 MVP

Le MVP permet de gérer opérationnellement un portefeuille immobilier depuis la création de l'organisation jusqu'au suivi quotidien :

- immeubles ;
- appartements ;
- gestionnaires ;
- locataires ;
- contrats ;
- loyers ;
- paiements ;
- quittances ;
- charges ;
- incidents ;
- interventions ;
- dépenses ;
- notifications ;
- tableaux de bord ;
- historique ;
- permissions.

---

# 6. MVP : Phase 0, fondations du projet

## MVP-DEV-001 : Initialisation du repository

Mettre en place :

- repository Git ;
- projet Next.js ;
- TypeScript ;
- configuration lint ;
- formatage ;
- gestion des variables d'environnement ;
- structure initiale du projet.

### Critères d'acceptation

```text
npm install
npm run dev
```

doivent permettre de démarrer le projet localement.

Le projet doit également pouvoir être compilé sans erreur.

---

## MVP-DEV-002 : Configuration qualité

Configurer :

- ESLint ;
- Prettier ;
- TypeScript strict ;
- scripts de test ;
- scripts de build ;
- vérifications CI.

---

## MVP-DEV-003 : Base de données

Mettre en place :

- PostgreSQL ;
- Drizzle ORM ;
- configuration de connexion ;
- migrations ;
- environnement local ;
- environnement staging.

---

## MVP-DEV-004 : Schéma initial

Implémenter les tables nécessaires au MVP conformément au document Database Schema & Migration Specification.

Ne pas implémenter immédiatement les tables exclusivement destinées aux futures évolutions.

---

## MVP-DEV-005 : Seed de développement

Créer des données de démonstration permettant de tester rapidement :

- une organisation ;
- un propriétaire ;
- plusieurs gestionnaires ;
- un immeuble ;
- plusieurs appartements ;
- plusieurs locataires ;
- plusieurs contrats ;
- loyers ;
- paiements ;
- charges ;
- incidents ;
- interventions ;
- dépenses.

---

# 7. MVP : Phase 1, authentification et identité

## MVP-DEV-006 : Authentification

Implémenter :

- connexion ;
- déconnexion ;
- session ;
- récupération de compte ;
- changement de mot de passe ;
- gestion de session expirée.

L'authentification est assurée par **Better Auth** avec adaptateur Drizzle (DEC-032), branchée derrière un service interne permettant son remplacement éventuel.

Identification par **téléphone et mot de passe**. Pas d'OTP au MVP (DEC-008).

La récupération de compte au MVP passe par la régénération d'un lien d'activation par un utilisateur autorisé, selon le mécanisme des invitations (DEC-026), faute de canal de communication automatisé.

---

## MVP-DEV-007 : Utilisateur

Créer la gestion de :

- nom ;
- téléphone ;
- email lorsque disponible ;
- statut ;
- préférences essentielles ;
- timestamps.

---

## MVP-DEV-008 : Organisation

Créer :

- organisation ;
- propriétaire principal ;
- paramètres de base ;
- devise par défaut ;
- informations principales.

---

# 8. MVP : Phase 2, autorisation et accès

## MVP-DEV-009 : RBAC

Implémenter les rôles :

```text
OWNER
MANAGER
TENANT
```

---

## MVP-DEV-010 : Scope d'accès

Le système doit permettre :

- propriétaire sur son organisation ;
- gestionnaire sur un ou plusieurs immeubles ;
- locataire sur son propre contexte locatif.

---

## MVP-DEV-011 : Permission service

Créer un service centralisé de contrôle des autorisations.

Exemple conceptuel :

```text
can(user, permission, resource)
```

Aucune fonctionnalité métier sensible ne doit contourner ce service.

---

## MVP-DEV-012 : Tests d'isolation

Tester :

- utilisateur de l'organisation A ;
- ressource de l'organisation B ;
- refus systématique.

---

# 9. MVP : Phase 3, immeubles

## MVP-DEV-013 : CRUD immeuble

Permettre au propriétaire :

- créer ;
- consulter ;
- modifier ;
- archiver.

---

## MVP-DEV-014 : Informations de l'immeuble

Un immeuble peut contenir notamment :

- nom ;
- adresse ;
- description ;
- nombre d'appartements ;
- statut ;
- gestionnaires affectés.

---

## MVP-DEV-015 : Liste des immeubles

Interface mobile first permettant :

- affichage ;
- recherche ;
- filtre lorsque nécessaire ;
- accès au détail.

---

# 10. MVP : Phase 4, appartements

## MVP-DEV-016 : CRUD appartement

Créer :

- numéro ou référence ;
- immeuble ;
- type ;
- statut ;
- loyer de référence lorsque pertinent.

---

## MVP-DEV-017 : Vue appartement

La fiche appartement doit devenir un point contextuel central.

Elle doit permettre d'accéder notamment à :

```text
Appartement
↓
Locataire
↓
Contrat
↓
Loyers
↓
Paiements
↓
Charges
↓
Incidents
↓
Historique
```

---

## MVP-DEV-018 : Statuts appartement

Valeurs canoniques — DEC-019 :

```text
VACANT
OCCUPIED
MAINTENANCE
```

`AVAILABLE` n'est pas utilisé : le terme officiel est « Vacant ».

`ARCHIVED` n'est pas un statut : l'archivage est porté par `archived_at` (DEC-020).

---

# 11. MVP : Phase 5, gestionnaires et invitations

## MVP-DEV-019 : Invitation gestionnaire

Le propriétaire doit pouvoir :

- saisir un destinataire ;
- sélectionner les immeubles concernés ;
- définir les permissions disponibles ;
- envoyer l'invitation.

---

## MVP-DEV-020 : Acceptation invitation

Le gestionnaire doit pouvoir :

1. ouvrir le lien ;
2. vérifier son invitation ;
3. définir son mot de passe ;
4. activer son compte ;
5. accéder à son espace.

---

## MVP-DEV-021 : Gestion des gestionnaires

Le propriétaire peut :

- consulter ;
- modifier les accès ;
- modifier le périmètre ;
- suspendre ;
- révoquer.

---

## MVP-DEV-022 : Révocation

La révocation doit :

- empêcher les nouvelles actions ;
- préserver l'historique ;
- conserver les traces d'activité.

---

# 12. MVP : Phase 6, locataires

## MVP-DEV-023 : Création du locataire

Le gestionnaire doit pouvoir créer un locataire dans son périmètre.

---

## MVP-DEV-024 : Invitation locataire

> **DEC-026** — au MVP, la diffusion se fait par **lien de partage sécurisé** copié par le gestionnaire.

```text
Le système génère l'invitation et le lien.
Le gestionnaire copie le lien depuis l'interface.
Le gestionnaire le transmet par son propre moyen.
```

WhatsApp et SMS sont conçus comme des adaptateurs de notification, non comme des dépendances métier. Leur activation est reportée (DEC-008) et n'impliquera aucune modification du modèle d'invitation.

---

## MVP-DEV-025 : Activation locataire

Le locataire :

```text
Reçoit invitation
↓
Ouvre le lien
↓
Définit son mot de passe
↓
Active son compte
↓
Accède à son espace
```

---

# 13. MVP : Phase 7, contrats

## MVP-DEV-026 : Création du contrat

Un contrat doit relier :

```text
Locataire
+
Appartement
+
Date de début
+
Date de fin éventuelle
+
Loyer
+
Conditions utiles
```

---

## MVP-DEV-027 : Historique contractuel

Les anciens contrats doivent être conservés.

Le remplacement d'un locataire ne doit pas écraser les anciennes relations.

---

## MVP-DEV-028 : Statuts

Enum `lease_status` :

```text
DRAFT
ACTIVE
ENDED
CANCELLED
```

---

# 14. MVP : Phase 8, loyers

## MVP-DEV-029 : Génération des échéances

Le système doit générer les échéances selon le contrat.

Exemple :

```text
01 septembre
Loyer septembre
2 500 000 GNF
```

---

## MVP-DEV-030 : Statuts de créance

Ces statuts sont ceux de la **créance**, pas du paiement.

Enum `receivable_status`, partagé par les créances de loyer et de charge — DEC-015 :

```text
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

Les statuts du **paiement** sont distincts — DEC-016 :

```text
PENDING
CONFIRMED
FAILED
CANCELLED
```

---

## MVP-DEV-031 : Calcul du restant dû

Exemple :

```text
Montant attendu : 2 800 000 GNF
Montant payé :    1 500 000 GNF
Restant :         1 300 000 GNF
```

Le calcul doit être réalisé côté serveur.

---

# 15. MVP : Phase 9, paiements

## MVP-DEV-032 : Paiement manuel

Le gestionnaire doit pouvoir enregistrer un paiement :

- cash ;
- mobile money confirmé ;
- autre méthode manuelle autorisée.

Le paiement doit contenir au minimum :

- montant ;
- date ;
- méthode ;
- période ;
- locataire ;
- appartement ;
- référence lorsque disponible ;
- utilisateur ayant enregistré l'opération.

---

## MVP-DEV-033 : Paiement digital

Architecture permettant l'intégration d'un fournisseur de paiement sans dépendre de son implémentation directement dans le domaine métier.

---

## MVP-DEV-034 : Idempotence

Une même transaction fournisseur ne doit pas générer plusieurs paiements.

---

## MVP-DEV-035 : Allocation

> **DEC-022, conséquence de DEC-005.**

Un paiement peut être affecté à **plusieurs créances**, de types différents : créances de loyer et créances de charge.

Chaque allocation référence **exactement une** créance, via une double clé étrangère exclusive.

L'allocation automatique suit un ordre déterministe : échéance croissante, loyer avant charge, création croissante.

Un paiement supérieur au total dû est refusé (`AMOUNT_EXCEEDS_OUTSTANDING`, DEC-023).

---

# 16. MVP : Phase 10, quittances

## MVP-DEV-036 : Génération de quittance

Une quittance doit être générée lorsqu'un paiement répond aux conditions métier définies.

Elle doit être liée à :

- paiement ;
- période ;
- locataire ;
- appartement ;
- montant ;
- organisation.

---

## MVP-DEV-037 : Accès à la quittance

Le locataire doit pouvoir consulter ses quittances depuis son espace.

---

# 17. MVP : Phase 11, charges communes

## MVP-DEV-038 : Création de charge

Permettre d'enregistrer une charge commune.

Exemple :

```text
Facture eau
Montant : 3 600 000 GNF
Nombre d'appartements : 12
```

---

## MVP-DEV-039 : Répartition

Le MVP doit supporter au minimum la répartition uniforme lorsque celle-ci correspond au besoin.

Exemple :

```text
3 600 000 / 12
=
300 000 GNF par appartement
```

---

## MVP-DEV-040 : Aperçu avant publication

Avant validation, afficher :

- montant total ;
- nombre de logements ;
- montant par logement ;
- arrondis éventuels.

---

# 18. MVP : Phase 12, maintenance

## MVP-DEV-041 : Incident

Permettre de créer :

- titre ;
- description ;
- appartement ou immeuble ;
- urgence ;
- photos ;
- statut.

---

## MVP-DEV-042 : Intervention

Associer à un incident :

- intervenant ;
- date ;
- statut ;
- estimation ;
- coût réel ;
- commentaires ;
- pièces jointes.

---

## MVP-DEV-043 : Cycles de vie

L'incident et l'intervention ont **deux cycles distincts**.

Incident — DEC-017 :

```text
OPEN
ASSIGNED
IN_PROGRESS
ON_HOLD
RESOLVED
CLOSED
```

Intervention — DEC-018 :

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

La clôture d'une intervention ne clôture pas automatiquement l'incident.

Les transitions non autorisées doivent être rejetées avec `INVALID_STATE`.

---

# 19. MVP : Phase 13, dépenses

## MVP-DEV-044 : Enregistrer une dépense

Une dépense doit pouvoir être liée à :

- immeuble ;
- incident ou intervention lorsque pertinent ;
- fournisseur ;
- montant ;
- date ;
- catégorie ;
- justificatif.

---

## MVP-DEV-045 : Historique des dépenses

Le propriétaire et les gestionnaires autorisés doivent pouvoir consulter les dépenses selon leur périmètre.

---

# 20. MVP : Phase 14, notifications

## MVP-DEV-046 : Notifications applicatives

> **DEC-027** — au MVP, le seul canal actif est `IN_APP`.

Prévoir les notifications essentielles :

- invitation ;
- loyer dû ;
- loyer en retard ;
- paiement confirmé ;
- charge publiée ;
- incident mis à jour ;
- intervention terminée.

---

## MVP-DEV-047 : Centre de notifications

Créer un espace permettant :

- voir les notifications ;
- marquer comme lue ;
- accéder à la ressource concernée.

---

# 21. MVP : Phase 15, rappels et relances

## MVP-DEV-048 : Relance automatique

Le système doit pouvoir déclencher des rappels selon des règles définies :

```text
Échéance proche
↓
Échéance
↓
Retard
```

Les tâches doivent être exécutées de manière asynchrone.

---

## MVP-DEV-049 : Protection contre le spam

Éviter l'envoi répété d'une même notification dans une période trop courte.

---

# 22. MVP : Phase 16, tableaux de bord

## MVP-DEV-050 : Dashboard propriétaire

Le dashboard doit répondre rapidement à :

- combien d'immeubles ;
- combien de logements ;
- combien occupés ;
- combien dus ;
- combien encaissés ;
- combien en retard ;
- incidents ouverts ;
- dépenses récentes.

---

## MVP-DEV-051 : Dashboard gestionnaire

Le gestionnaire doit voir les éléments opérationnels de son périmètre.

---

## MVP-DEV-052 : Dashboard locataire

Le locataire doit voir :

- logement ;
- prochain montant à payer ;
- retard éventuel ;
- paiements récents ;
- charges ;
- incidents en cours.

---

# 23. MVP : Phase 17, historique et activité

## MVP-DEV-053 : Activity Log

Afficher l'activité utile au fonctionnement du produit.

Exemple :

```text
12 septembre
Le gestionnaire a enregistré un paiement de 1 500 000 GNF.
```

---

## MVP-DEV-054 : Audit des opérations sensibles

Les opérations critiques doivent être enregistrées dans l'audit conformément au Security Specification.

---

# 24. MVP : Phase 18, expérience mobile

## MVP-DEV-055 : Navigation mobile

Les parcours principaux doivent être optimisés pour smartphone.

Les éléments de navigation doivent privilégier :

- accès rapide ;
- zones tactiles suffisamment grandes ;
- réduction du nombre d'étapes ;
- actions principales immédiatement visibles.

---

## MVP-DEV-056 : Formulaires mobile first

Les formulaires doivent :

- utiliser des champs adaptés au mobile ;
- éviter les écrans inutilement longs ;
- regrouper les informations logiquement ;
- utiliser des sélecteurs adaptés ;
- permettre la saisie monétaire simple.

---

## MVP-DEV-057 : Actions rapides

Les actions fréquentes doivent être directement accessibles.

Exemple :

```text
Créer immeuble
Ajouter locataire
Enregistrer paiement
Déclarer incident
```

---

# 25. MVP : Phase 19, documents et fichiers

## MVP-DEV-058 : Stockage privé

Mettre en place un stockage objet privé.

---

## MVP-DEV-059 : Upload

Supporter les fichiers nécessaires au MVP :

- photos ;
- justificatifs ;
- documents locatifs essentiels.

---

## MVP-DEV-060 : Accès sécurisé

Les documents doivent être servis via un mécanisme autorisé et temporaire lorsque nécessaire.

---

# 26. MVP : Phase 20, recherche et filtrage

## MVP-DEV-061 : Recherche

Permettre de retrouver rapidement :

- immeubles ;
- appartements ;
- locataires ;
- paiements ;
- incidents.

---

## MVP-DEV-062 : Filtrage

Les filtres doivent être adaptés au rôle et au contexte.

---

# 27. MVP : Phase 21, qualité et tests

Chaque module livré doit contenir ses tests essentiels.

### Unit tests

Pour :

- calculs ;
- règles métier ;
- permissions ;
- statuts ;
- allocations.

### Integration tests

Pour :

- API ;
- base de données ;
- transactions ;
- webhooks.

### End-to-end tests

Pour les parcours critiques :

```text
Owner → Property → Apartment
Owner → Manager invitation
Manager → Tenant invitation
Manager → Lease
Manager → Rent
Manager → Payment
Tenant → Payment view
Manager → Charge
Tenant → Charge view
Tenant → Incident
Manager → Intervention
```

---

# 28. MVP : Phase 22, staging

Avant production :

```text
Local
↓
CI
↓
Staging
↓
Tests
↓
Validation fonctionnelle
↓
Production
```

Le staging doit reproduire autant que possible la configuration réelle sans exposer les données de production.

---

# 29. MVP : Phase 23, préparation production

Vérifier :

- migrations ;
- variables d'environnement ;
- secrets ;
- sauvegardes ;
- monitoring ;
- logs ;
- gestion des erreurs ;
- rate limiting ;
- sécurité ;
- performance ;
- PWA ;
- responsive mobile.

---

# 30. Future Evolutions

Les éléments suivants ne doivent pas bloquer le lancement du MVP.

## FUT-DEV-001 : Application native iOS

Une application iOS dédiée pourra être développée ultérieurement.

---

## FUT-DEV-002 : Application native Android

Même principe pour Android.

Le MVP doit donc être construit de manière à ne pas enfermer la logique métier dans l'interface web.

---

## FUT-DEV-003 : Comptabilité avancée

Évolutions possibles :

- rapprochement bancaire ;
- comptabilité ;
- grands livres ;
- amortissements ;
- fiscalité ;
- exports comptables avancés.

---

## FUT-DEV-004 : Gestion de copropriété

Fonctionnalités possibles :

- syndic ;
- assemblées ;
- copropriétaires ;
- tantièmes ;
- votes ;
- appels de fonds spécifiques.

---

## FUT-DEV-005 : Gestion avancée des fournisseurs

Évolutions possibles :

- portefeuille fournisseurs ;
- contrats fournisseurs ;
- historique de performance ;
- demandes de devis ;
- appels d'offres.

---

## FUT-DEV-006 : Automatisations avancées

Possibilités :

- workflows ;
- règles personnalisées ;
- relances avancées ;
- automatisation des interventions ;
- automatisation des échéances spécifiques.

---

## FUT-DEV-007 : Analytics avancés

Possibilités :

- prévisions ;
- indicateurs avancés ;
- tendances ;
- benchmarking ;
- analyses patrimoniales.

---

## FUT-DEV-008 : Multi-pays

Le produit pourra évoluer pour gérer plusieurs marchés avec :

- devises ;
- formats ;
- réglementations ;
- fournisseurs ;
- fiscalité locale ;
- méthodes de paiement.

---

# 31. Architecture Constraints Related to Future Evolutions

Ces éléments ne doivent pas nécessairement être entièrement développés dans le MVP, mais l'architecture doit éviter de les rendre impossibles.

## ARCH-DEV-001 : Indépendance de la couche métier

La logique métier ne doit pas être fortement couplée à l'interface web.

---

## ARCH-DEV-002 : Adapters pour services externes

Les fournisseurs de :

- paiement ;
- WhatsApp ;
- SMS ;
- email ;
- stockage ;

doivent être encapsulés derrière des services ou adaptateurs.

Exemple :

```text
PaymentService
    ↓
PaymentProviderAdapter
    ↓
Provider A
```

---

## ARCH-DEV-003 : Internationalisation future

Les textes frontend doivent éviter d'être codés de manière à rendre l'internationalisation impossible.

Le MVP peut rester en français.

---

## ARCH-DEV-004 : Multi-devise future

Les montants doivent conserver une devise explicite dans la base.

Ne jamais supposer implicitement que tous les montants sont en GNF au niveau du modèle de données.

---

## ARCH-DEV-005 : Multi-pays future

Les informations telles que :

- pays ;
- devise ;
- timezone ;
- formats ;

doivent être suffisamment structurées pour évoluer.

---

## ARCH-DEV-006 : API cohérente

Même si le MVP reste majoritairement web, les APIs doivent être suffisamment propres pour permettre plus tard :

- application mobile native ;
- intégrations tierces ;
- partenaires.

---

## ARCH-DEV-007 : Jobs asynchrones

Les tâches planifiées doivent passer par une couche de jobs.

Ne pas mettre des opérations longues directement dans une requête utilisateur.

---

## ARCH-DEV-008 : Événements métier

Les événements métier doivent être identifiables afin de permettre plus tard :

```text
PaymentConfirmed
RentOverdue
IncidentCreated
InterventionCompleted
```

Le MVP ne doit toutefois pas être transformé en architecture événementielle complexe inutilement.

---

# 32. Out of Scope

Les éléments suivants sont explicitement exclus du MVP.

## OUT-DEV-001 : Microservices

Ne pas transformer le produit en architecture microservices au lancement.

---

## OUT-DEV-002 : Kubernetes

Aucune nécessité pour le MVP.

---

## OUT-DEV-003 : Application native obligatoire

Pas d'application native obligatoire pour le lancement.

Le PWA responsive mobile first est la référence.

---

## OUT-DEV-004 : Comptabilité complète

Non incluse dans le MVP.

---

## OUT-DEV-005 : Fiscalité automatisée

Non incluse.

---

## OUT-DEV-006 : ERP immobilier complet

Le produit ne doit pas devenir un ERP généraliste dans le MVP.

---

## OUT-DEV-007 : IA avancée

Pas de dépendance à une couche IA pour les opérations fondamentales du produit.

---

## OUT-DEV-008 : Blockchain

Aucun besoin dans le MVP.

---

# 33. Ordre global d'implémentation

L'ordre recommandé est :

```text
1. Repository / Tooling
2. Database / ORM
3. Auth
4. Organization
5. Roles / Permissions
6. Properties
7. Apartments
8. Managers / Invitations
9. Tenants
10. Leases
11. Rents
12. Payments
13. Receipts
14. Charges
15. Maintenance
16. Expenses
17. Notifications
18. Dashboards
19. Activity / Audit
20. Documents
21. Search / Filters
22. Tests complets
23. Staging
24. Production
```

---

# 34. Dépendances fonctionnelles

Le développement doit respecter les dépendances.

```text
Auth
  ↓
Organization
  ↓
Permissions
  ↓
Properties
  ↓
Apartments
  ↓
Managers / Tenants
  ↓
Leases
  ↓
Rents
  ↓
Payments
  ↓
Receipts
```

En parallèle :

```text
Properties
↓
Maintenance
↓
Interventions
↓
Expenses
```

Et :

```text
Rents
+
Properties / Apartments
↓
Charges
```

---

# 35. Stratégie de développement par Vertical Slice

Le projet ne doit pas être construit comme :

```text
Frontend complet
puis
Backend complet
puis
Database complète
```

Il faut privilégier les vertical slices :

```text
Feature
↓
Database
↓
Backend
↓
Authorization
↓
Frontend
↓
Tests
```

Exemple :

```text
Créer un immeuble
↓
Table / migration
↓
Service métier
↓
API
↓
Permission
↓
Écran mobile
↓
Tests
```

---

# 36. Format d'une tâche Claude Code

Chaque tâche doit idéalement être définie comme suit :

```text
## Task ID

DEV-XXXX

## Module

Nom du module

## Objectif

Ce que la tâche doit permettre.

## Scope

Ce qui est inclus.

## Non-Scope

Ce qui n'est pas inclus.

## Dépendances

Tâches préalables.

## Data

Tables / modèles concernés.

## Backend

Services / routes / actions.

## Authorization

Permissions nécessaires.

## Frontend

Écrans / composants.

## Mobile

Comportement smartphone.

## Tablet

Adaptation tablette.

## Desktop

Adaptation desktop.

## Validation

Règles métier.

## Tests

Tests attendus.

## Acceptance Criteria

Critères de succès.

## Definition of Done

Conditions de livraison.
```

---

# 37. Règles spécifiques à Claude Code

## DEV-CLAUDE-001 : Lire avant de modifier

Avant toute modification, Claude Code doit examiner :

- architecture existante ;
- fichiers concernés ;
- modèles ;
- routes ;
- composants réutilisables ;
- tests existants.

---

## DEV-CLAUDE-002 : Ne pas réinventer

Avant de créer :

- composant ;
- helper ;
- service ;
- hook ;
- validation ;

chercher si une implémentation existante peut être réutilisée.

---

## DEV-CLAUDE-003 : Une modification cohérente

Éviter les modifications dispersées qui n'ont pas de lien avec la tâche.

---

## DEV-CLAUDE-004 : Pas de fonctionnalité implicite

Claude Code ne doit pas ajouter une fonctionnalité simplement parce qu'elle semble utile.

Si elle n'est pas dans le scope de la tâche, elle doit rester hors de la modification.

---

## DEV-CLAUDE-005 : Préserver les règles métier

Toute modification d'interface ne doit pas affaiblir :

- permissions ;
- validations ;
- historique ;
- intégrité financière.

---

# 38. Stratégie Git

Le workflow recommandé :

```text
main
│
├── feature/auth
├── feature/properties
├── feature/tenants
├── feature/payments
└── feature/maintenance
```

Chaque feature doit être :

- limitée ;
- testable ;
- révisable ;
- fusionnable.

---

# 39. Commits

Les commits doivent décrire une intention claire.

Exemples :

```text
feat(auth): add invitation activation
feat(properties): add property creation
feat(payments): add manual payment recording
fix(payments): prevent duplicate allocation
test(auth): add permission isolation tests
```

---

# 40. Pull Request

Une PR doit permettre de comprendre rapidement :

- ce qui change ;
- pourquoi ;
- quels modules sont touchés ;
- quels tests ont été ajoutés ;
- quelles migrations sont nécessaires ;
- quels risques existent.

---

# 41. Definition of Done globale

Une fonctionnalité MVP est considérée comme terminée lorsque :

### Produit

- comportement conforme au besoin ;
- règles métier respectées.

### Backend

- validation ;
- authorization ;
- erreurs ;
- transactions lorsque nécessaires.

### Database

- migration ;
- contraintes ;
- indexes nécessaires.

### Frontend

- mobile first ;
- responsive ;
- états loading ;
- états empty ;
- états error ;
- état success.

### Sécurité

- isolation ;
- permissions ;
- validation serveur ;
- absence de secrets exposés.

### Tests

- unit ;
- integration lorsque nécessaire ;
- end-to-end pour parcours critique.

### Qualité

- lint ;
- typecheck ;
- build ;
- tests passent.

### Documentation

- comportement important documenté ;
- API mise à jour si nécessaire.

---

# 42. Critères de sortie du MVP

Le MVP peut être considéré comme techniquement prêt lorsque les parcours critiques suivants fonctionnent de bout en bout.

## Parcours 1 : propriétaire

```text
Créer compte
↓
Créer organisation
↓
Créer immeuble
↓
Créer appartements
↓
Inviter gestionnaire
```

---

## Parcours 2 : gestionnaire

```text
Accepter invitation
↓
Accéder à l'immeuble
↓
Ajouter locataire
↓
Créer contrat
↓
Configurer loyer
```

---

## Parcours 3 : cycle financier

```text
Échéance créée
↓
Locataire voit montant
↓
Paiement
↓
Confirmation
↓
Allocation
↓
Quittance
```

---

## Parcours 4 : charges

```text
Gestionnaire crée charge
↓
Répartition
↓
Validation
↓
Locataire voit sa part
```

---

## Parcours 5 : maintenance

```text
Locataire crée incident
↓
Gestionnaire le reçoit
↓
Intervention
↓
Dépense
↓
Résolution
```

---

## Parcours 6 : sécurité

```text
Gestionnaire révoqué
↓
Accès refusé
↓
Historique conservé
```

---

# 43. Priorité absolue du développement

L'ordre de priorité est :

```text
P1
Sécurité
+
Intégrité des données
+
Cœur métier
```

puis :

```text
P2
Expérience utilisateur
+
Automatisation
```

puis :

```text
P3
Optimisation
+
Fonctionnalités avancées
```

Une fonctionnalité P3 ne doit jamais ralentir ou fragiliser une fonctionnalité P1.

---

# 44. Règle de décision pendant le développement

Lorsqu'un choix technique ou fonctionnel apparaît et n'est pas explicitement défini dans les documents :

```text
1. Vérifier les Business Rules
2. Vérifier le Data Model
3. Vérifier le Security Specification
4. Vérifier le UX Specification
5. Vérifier le API Specification
6. Choisir l'option la plus simple compatible avec le MVP
7. Documenter la décision si elle a un impact durable
```

---

# 45. Règle finale

Le développement du produit doit suivre une logique simple :

```text
Construire peu
Construire correctement
Tester
Valider
Puis élargir
```

Le MVP doit être suffisamment complet pour permettre une gestion réelle d'un portefeuille locatif, mais suffisamment limité pour rester :

- développable rapidement ;
- maintenable ;
- compréhensible ;
- testable ;
- sécurisé ;
- évolutif.

Le principe directeur est :

> **Construire d'abord le cœur opérationnel, sans sacrifier l'architecture qui permettra de faire évoluer le produit ensuite.**