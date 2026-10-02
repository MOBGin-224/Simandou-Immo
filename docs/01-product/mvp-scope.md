# MVP Scope & Feature Matrix

## 1. Objet du document

Ce document constitue la référence consolidée du périmètre fonctionnel du MVP.

Il a un objectif précis :

> empêcher que le MVP grossisse progressivement jusqu'à devenir un produit trop complexe à construire, tester et lancer.

Les documents précédents décrivent parfois des capacités futures, des contraintes d'architecture ou des possibilités d'évolution.

Le présent document répond à une seule question :

> **Qu'est-ce qui doit réellement être construit pour la V1 ?**

Il sert donc de filtre avant toute nouvelle tâche de développement.

---

# 2. Règle de classification

Chaque capacité du produit appartient obligatoirement à l'une des catégories suivantes.

## MVP

Nécessaire au lancement.

Sans cette capacité, le cœur du produit ne fonctionne pas correctement.

Identifiant :

```text
MVP-FEAT-XXX
```

---

## Future Evolution

Intéressante et potentiellement importante, mais non nécessaire au lancement.

Identifiant :

```text
FUT-FEAT-XXX
```

---

## Architecture Constraint

Ne doit pas nécessairement être visible comme fonctionnalité dans le MVP, mais l'architecture doit éviter de bloquer son ajout futur.

Identifiant :

```text
ARCH-FEAT-XXX
```

---

## Out of Scope

Explicitement exclu du produit ou du MVP actuel.

Identifiant :

```text
OUT-FEAT-XXX
```

---

# 3. Définition du MVP

Le MVP est une plateforme SaaS permettant à un propriétaire ou gestionnaire de :

```text
Créer et organiser son patrimoine
↓
Gérer les appartements
↓
Gérer les gestionnaires
↓
Gérer les locataires
↓
Gérer les contrats
↓
Suivre les loyers
↓
Enregistrer et suivre les paiements
↓
Gérer les charges
↓
Gérer les incidents et interventions
↓
Suivre les dépenses
↓
Notifier les utilisateurs
```

Le locataire doit pouvoir :

```text
Activer son compte
↓
Consulter son logement
↓
Consulter son contrat
↓
Voir ce qu'il doit
↓
Voir ses paiements
↓
Voir ses quittances
↓
Voir ses charges
↓
Déclarer un incident
```

---

# 4. Core Product Loop

Le produit doit permettre de fermer cette boucle :

```text
Patrimoine
↓
Logement
↓
Locataire
↓
Contrat
↓
Loyer
↓
Paiement
↓
Quittance
```

Et cette boucle opérationnelle :

```text
Incident
↓
Intervention
↓
Dépense
↓
Résolution
```

Et cette boucle de charges :

```text
Charge
↓
Répartition
↓
Part du logement
↓
Montant dû
```

Si ces trois grandes boucles fonctionnent correctement, le cœur du MVP est fonctionnel.

---

# 5. MVP : Authentification et identité

## MVP-FEAT-001 : Création de compte propriétaire

Le propriétaire doit pouvoir créer son compte.

### Inclus

- téléphone et/ou email selon solution retenue ;
- mot de passe ;
- session ;
- activation.

### Critère

Le propriétaire peut accéder à son espace après authentification.

---

## MVP-FEAT-002 : Connexion

### Inclus

- login ;
- session ;
- logout ;
- session expirée.

---

## MVP-FEAT-003 : Récupération de compte

### Inclus

- demande ;
- mécanisme sécurisé ;
- nouveau mot de passe.

---

# 6. MVP : Organisation

## MVP-FEAT-004 : Organisation

Le compte propriétaire est associé à une organisation.

### Inclus

- identité de l'organisation ;
- propriétaire principal ;
- paramètres de base ;
- devise de référence.

---

# 7. MVP : Rôles

## MVP-FEAT-005 : OWNER

Accès principal à son organisation et à son patrimoine.

---

## MVP-FEAT-006 : MANAGER

Accès opérationnel sur les immeubles qui lui sont attribués.

---

## MVP-FEAT-007 : TENANT

Accès à son propre contexte locatif.

---

# 8. MVP : Permissions

> **Modèle du MVP : DEC-025.**
>
> Les droits sont évalués sur **deux dimensions uniquement** : le **rôle** et le **périmètre**.
>
> La délégation fine par gestionnaire est classée `FUT-FEAT-017`.

## MVP-FEAT-008 : RBAC

Le système gère les rôles `OWNER`, `MANAGER`, `TENANT`.

Le catalogue des permissions `resource.action` est défini en code et mappé statiquement par rôle.

Les tables `permissions` et `access_permissions` ne sont pas créées au MVP.

---

## MVP-FEAT-009 : Scope

Le système doit limiter le gestionnaire aux immeubles auxquels il est affecté.

Plusieurs gestionnaires peuvent être affectés au même immeuble. Ils disposent alors du même ensemble de permissions, appliqué à leur périmètre respectif.

---

## MVP-FEAT-010 : Contrôle serveur

Les permissions doivent être vérifiées côté serveur, via un service centralisé :

```text
can(user, permission, resource)
```

Aucune fonctionnalité sensible ne contourne ce service.

---

# 9. MVP : Immeubles

## MVP-FEAT-011 : Création d'immeuble

Le propriétaire doit pouvoir créer un immeuble.

### Données minimales

- nom ;
- adresse ;
- ville et quartier ;
- description éventuelle.

Un immeuble n'a **pas de colonne de statut** : il est actif tant qu'il n'est pas archivé (DEC-020).

---

## MVP-FEAT-012 : Modification

Modifier les informations nécessaires.

---

## MVP-FEAT-013 : Archivage

Un immeuble n'est jamais supprimé physiquement.

L'archivage est porté par `archived_at` (DEC-020). L'historique reste intégralement consultable.

---

## MVP-FEAT-014 : Liste et détail

Le propriétaire et les gestionnaires autorisés peuvent consulter les immeubles accessibles.

---

# 10. MVP : Appartements

## MVP-FEAT-015 : Création d'appartement

### Données minimales

- référence, unique dans l'immeuble ;
- immeuble ;
- type ;
- statut : `VACANT` | `OCCUPIED` | `MAINTENANCE` (DEC-019).

---

## MVP-FEAT-016 : Modification

Modifier les informations autorisées.

---

## MVP-FEAT-017 : Historique d'occupation

Le système doit préserver les relations locatives historiques.

---

## MVP-FEAT-018 : Contexte appartement

La fiche appartement doit permettre de retrouver :

- locataire ;
- contrat ;
- loyers ;
- paiements ;
- charges ;
- incidents ;
- historique.

---

# 11. MVP : Gestionnaires

## MVP-FEAT-019 : Invitation gestionnaire

Le propriétaire peut inviter un gestionnaire.

---

## MVP-FEAT-020 : Attribution du périmètre

Le propriétaire peut attribuer un ou plusieurs immeubles au gestionnaire.

Le périmètre est une **liste explicite** : « tous les immeubles » est une sélection de ceux qui existent, et les immeubles créés plus tard ne sont jamais ajoutés automatiquement (DEC-042).

---

## MVP-FEAT-021 : Modification du périmètre

Le propriétaire peut modifier la **liste des immeubles** attribués à un gestionnaire.

Il ne modifie pas les permissions elles-mêmes : elles découlent du rôle `MANAGER` (DEC-025).

Il peut également suspendre puis réactiver un accès.

---

## MVP-FEAT-022 : Révocation

Le propriétaire peut révoquer l'accès.

L'historique est conservé.

---

# 12. MVP : Locataires

## MVP-FEAT-023 : Création locataire

Le gestionnaire crée le profil locataire.

---

## MVP-FEAT-024 : Invitation locataire

Le gestionnaire génère une invitation sécurisée pour le locataire.

**Au MVP, la diffusion se fait par lien de partage sécurisé**, voir DEC-026 :

```text
Le système génère l'invitation et le lien.
Le gestionnaire copie le lien depuis l'interface.
Le gestionnaire le transmet par son propre moyen.
```

L'envoi automatique par SMS et WhatsApp est reporté (DEC-008).

Les propriétés de sécurité de l'invitation restent entières : token imprévisible, stocké hashé, expirant, à usage unique, révocable, lié à son contexte.

---

## MVP-FEAT-025 : Activation

Le locataire active son compte.

---

## MVP-FEAT-026 : Fin de relation locative

La fin du contrat retire l'accès au logement sans détruire l'historique.

---

# 13. MVP : Contrats

## MVP-FEAT-027 : Création

Un contrat relie :

```text
Locataire
+
Appartement
+
Dates
+
Loyer
```

---

## MVP-FEAT-028 : Activation

Un contrat peut passer à l'état actif.

---

## MVP-FEAT-029 : Fin de contrat

Le contrat peut être terminé.

---

## MVP-FEAT-030 : Historique

Les anciens contrats restent accessibles aux utilisateurs autorisés.

---

# 14. MVP : Loyers

## MVP-FEAT-031 : Échéance

Créer les échéances selon les contrats actifs.

---

## MVP-FEAT-032 : Statut

Cycle `receivable_status`, partagé avec les créances de charge, voir DEC-015 :

```text
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

« À venir » n'est pas un statut stocké : c'est un affichage dérivé lorsque `status = UNPAID` et `due_date` est future.

---

## MVP-FEAT-033 : Solde

Afficher pour chaque créance :

```text
Montant attendu
-
Montant payé
=
Montant restant
```

Et pour le locataire, le **total dû** :

```text
somme des soldes des créances ouvertes
(loyer + charges)
```

Voir DEC-005.

---

# 15. MVP : Paiements

## MVP-FEAT-034 : Paiement manuel

Supporter l'enregistrement manuel de paiements.

Exemples :

- cash ;
- mobile money enregistré ;
- autre méthode validée.

---

## MVP-FEAT-035 : Paiement digital

Mettre en place l'**architecture** `PaymentProvider` permettant l'intégration ultérieure d'un fournisseur.

Le fournisseur n'est pas sélectionné, décision DEC-034 OUVERTE.

**Au MVP, le paiement manuel est le seul moyen opérationnel.**

---

## MVP-FEAT-036 : Paiement partiel

Permettre :

```text
Dû
+
Paiement partiel
+
Solde
```

Un paiement supérieur au total dû est **refusé**, voir DEC-023.

---

## MVP-FEAT-037 : Allocation

Associer le paiement aux créances concernées.

L'allocation **multi-créances est dans le périmètre MVP** : un paiement unique peut régler une créance de loyer et une ou plusieurs créances de charge.

L'ordre d'allocation automatique est déterministe : date d'échéance croissante, puis loyer avant charge, puis date de création.

Voir DEC-022.

---

## MVP-FEAT-038 : Idempotence

Empêcher les doubles paiements métier dus à des événements répétés.

---

## MVP-FEAT-039 : Confirmation fournisseur

Le paiement digital doit être confirmé par une source fiable.

---

# 16. MVP : Quittances

## MVP-FEAT-040 : Génération

Générer une quittance selon les règles métier.

---

## MVP-FEAT-041 : Consultation

Le locataire peut consulter ses quittances.

---

## MVP-FEAT-042 : Historique

Les quittances restent liées aux paiements historiques.

---

# 17. MVP : Charges communes

## MVP-FEAT-043 : Création

Créer une charge au niveau d'un immeuble.

---

## MVP-FEAT-044 : Répartition uniforme

Le MVP supporte **uniquement** la répartition uniforme (`EQUAL`), voir DEC-029.

`CUSTOM` et `CONSUMPTION` sont classés Future Evolution.

Exemple :

```text
3 600 000 GNF
÷
12 appartements
=
300 000 GNF
```

Règle d'arrondi déterministe : le reste de la division entière est distribué à raison d'une unité par logement, par référence d'appartement croissante.

---

## MVP-FEAT-045 : Aperçu

Avant publication, afficher :

- total ;
- logements concernés ;
- part de chaque logement ;
- arrondis.

Invariant vérifié : `somme des parts = montant total de la charge`.

---

## MVP-FEAT-046 : Publication

La publication d'une charge crée, pour chaque appartement concerné, une **créance de charge payable**, distincte de l'échéance de loyer.

Chaque créance de charge porte :

- un montant dû ;
- un montant payé ;
- un solde ;
- une date d'échéance ;
- un statut `receivable_status`.

Les parts deviennent visibles et payables par les locataires concernés.

Voir DEC-005. C'est une **décision verrouillée** du fondateur.

---

## MVP-FEAT-046-bis : Total dû du locataire

Le locataire voit un **montant global à payer**, composé de ses créances ouvertes.

Le système conserve les composantes séparées et permet d'ouvrir le détail :

```text
Loyer septembre    2 500 000 GNF
Charge eau           300 000 GNF
------------------------------------
Total dû           2 800 000 GNF
```

Cette capacité n'est pas une nouvelle fonctionnalité : c'est la conséquence directe de MVP-FEAT-046 et de MVP-FEAT-037.

---

# 18. MVP : Incidents

## MVP-FEAT-047 : Déclaration

Le locataire peut déclarer un incident.

---

## MVP-FEAT-048 : Photos

Ajouter une ou plusieurs photos.

Dépend du stockage objet, décision DEC-033 OUVERTE.

---

## MVP-FEAT-049 : Suivi

Voir le statut de l'incident.

Cycle `incident_status`, voir DEC-017 :

```text
OPEN
ASSIGNED
IN_PROGRESS
ON_HOLD
RESOLVED
CLOSED
```

« À traiter » n'est pas un statut : c'est un filtre du tableau de bord gestionnaire sur `OPEN` et `ASSIGNED`.

---

# 19. MVP : Interventions

## MVP-FEAT-050 : Affectation

Un incident peut être affecté à un intervenant.

---

## MVP-FEAT-051 : Suivi

L'intervention possède un cycle **distinct** de celui de l'incident, voir DEC-018 :

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

La clôture d'une intervention ne clôture pas automatiquement l'incident.

---

## MVP-FEAT-052 : Coût

Enregistrer :

- estimation ;
- coût réel.

---

# 20. MVP : Dépenses

## MVP-FEAT-053 : Création

Enregistrer une dépense.

---

## MVP-FEAT-054 : Association

Associer la dépense à :

- immeuble ;
- intervention lorsqu'applicable ;
- fournisseur ;
- catégorie.

---

## MVP-FEAT-055 : Justificatif

Associer un document ou justificatif lorsque nécessaire.

---

# 21. MVP : Notifications

> **Canal du MVP : DEC-027.**
>
> Le seul canal actif au MVP est **`IN_APP`**.
>
> `SMS`, `WHATSAPP` et `EMAIL` sont définis dans le modèle mais inactifs.

## MVP-FEAT-056 : Notifications internes

Créer un centre de notifications in-app : liste, marquage comme lu, accès à la ressource concernée.

---

## MVP-FEAT-057 : Événements essentiels

Notifier notamment :

- invitation ;
- paiement confirmé ;
- créance de loyer due ;
- créance de charge publiée ;
- incident ;
- intervention.

---

# 22. MVP : Rappels

Le moteur de rappels fait partie du périmètre MVP. Seuls les canaux externes sont reportés.

## MVP-FEAT-058 : Rappels d'échéance

Notifier avant ou à l'échéance selon les règles choisies.

Porte sur les deux types de créance : loyer et charge.

---

## MVP-FEAT-059 : Relance de retard

Notifier les retards selon les règles métier.

Protection anti-répétition obligatoire : une même créance ne déclenche pas plusieurs relances identiques rapprochées.

---

# 23. MVP : Dashboards

## MVP-FEAT-060 : Dashboard propriétaire

Vue synthétique du patrimoine.

---

## MVP-FEAT-061 : Dashboard gestionnaire

Vue opérationnelle sur le périmètre.

---

## MVP-FEAT-062 : Dashboard locataire

Vue de :

- son logement ;
- montant dû ;
- paiements ;
- charges ;
- incidents.

---

# 24. MVP : Historique

## MVP-FEAT-063 : Activity Log

Afficher les événements utiles à la compréhension de l'activité.

---

## MVP-FEAT-064 : Audit Log

Tracer les opérations sensibles.

---

# 25. MVP : Documents

## MVP-FEAT-065 : Upload

Supporter :

- photos ;
- justificatifs ;
- documents locatifs essentiels.

---

## MVP-FEAT-066 : Stockage privé

Les documents ne sont pas publiquement accessibles.

---

## MVP-FEAT-067 : Consultation sécurisée

L'accès nécessite une autorisation valide.

---

# 26. MVP : Recherche

## MVP-FEAT-068 : Recherche contextualisée

Recherche parmi les ressources accessibles.

---

## MVP-FEAT-069 : Filtres essentiels

Filtres sur les principales listes lorsque nécessaires.

---

# 27. MVP : UX

## MVP-FEAT-070 : Mobile First

Smartphone = format de référence.

---

## MVP-FEAT-071 : Responsive

Le produit doit également fonctionner sur :

- tablette ;
- desktop.

---

## MVP-FEAT-072 : États UI

Tous les écrans critiques ont :

```text
Loading
Empty
Success
Error
Unauthorized
Not Found
```

---

# 28. MVP : Sécurité

## MVP-FEAT-073 : Authentification sécurisée

---

## MVP-FEAT-074 : RBAC + Scope

---

## MVP-FEAT-075 : Isolation multi-tenant

---

## MVP-FEAT-076 : IDOR Protection

---

## MVP-FEAT-077 : Protection des documents

---

## MVP-FEAT-078 : Protection des webhooks

---

## MVP-FEAT-079 : Rate Limiting

---

# 29. MVP : Observabilité

## MVP-FEAT-080 : Error Tracking

---

## MVP-FEAT-081 : Logs

---

## MVP-FEAT-082 : Monitoring

---

## MVP-FEAT-083 : Alertes critiques

---

# 30. MVP : Sauvegarde

## MVP-FEAT-084 : Backup automatique

---

## MVP-FEAT-085 : Restore Test

---

# 31. MVP : CI/CD

## MVP-FEAT-086 : CI

Au minimum :

```text
Lint
Typecheck
Tests
Build
```

---

## MVP-FEAT-087 : Staging

Environnement de validation avant production.

---

## MVP-FEAT-088 : Production

Déploiement contrôlé.

---

# 32. MVP : Analytics essentiels

## MVP-FEAT-089

Suivre les événements essentiels :

```text
sign_up
invitation
property_created
tenant_created
lease_created
payment
charge
incident
```

---

# 33. MVP : Intégrations externes

> **Statut des fournisseurs, DEC-008, DEC-032, DEC-033, DEC-034.**
>
> Au MVP, l'**interface** de chaque fournisseur est définie et utilisée. L'**implémentation réelle** dépend de la décision correspondante.
>
> Aucun nom de fournisseur ne doit être inventé ou supposé tant que la décision est OUVERTE.

| Feature | Interface | Implémentation MVP |
|---|---|---|
| MVP-FEAT-090 Authentification | Requise | **Better Auth** (DEC-032) |
| MVP-FEAT-091 Payment Provider | Requise | **DEC-034 OUVERTE**, paiement manuel seul |
| MVP-FEAT-092 Email Provider | Définie | Adapter inerte (DEC-008) |
| MVP-FEAT-093 SMS Provider | Définie | Adapter inerte (DEC-008) |
| MVP-FEAT-094 WhatsApp Provider | Définie | Adapter inerte (DEC-008) |
| MVP-FEAT-095 Storage Provider | Requise | **DEC-033 OUVERTE** |

## MVP-FEAT-090 : Authentification

**Better Auth** avec adaptateur Drizzle (DEC-032). Les tables d'authentification vivent dans notre PostgreSQL.

Identification par **téléphone et mot de passe**. Pas d'OTP au MVP, faute de fournisseur SMS (DEC-008).

Encapsulé derrière un service interne : `getCurrentUser`, `getSession`, `requireAuthenticatedUser`, `signOut`.

Aucun module métier n'appelle Better Auth directement.

---

## MVP-FEAT-091 : Payment Provider

Interface `PaymentProvider` : `createPayment`, `getPaymentStatus`, `verifyWebhook`.

Fournisseur non sélectionné : **DEC-034 OUVERTE**. Bloque uniquement le paiement digital.

---

## MVP-FEAT-092 : Email Provider

Interface définie, implémentation inerte journalisée au MVP.

---

## MVP-FEAT-093 : SMS Provider

Interface définie, implémentation inerte journalisée au MVP.

---

## MVP-FEAT-094 : WhatsApp Provider

Interface définie, implémentation inerte journalisée au MVP.

**Conséquence** : au MVP, les invitations sont diffusées par **lien de partage sécurisé** copié par l'inviteur (DEC-026).

---

## MVP-FEAT-095 : Storage Provider

Interface `StorageProvider` : `upload`, `delete`, `createSignedUrl`.

Bucket privé obligatoire, aucune URL publique permanente.

Fournisseur non sélectionné : **DEC-033 OUVERTE**, bloque le lot Documents.

---

# 34. Fonctionnalités secondaires non nécessaires au lancement

Les capacités suivantes sont intéressantes mais ne doivent pas être ajoutées au MVP simplement parce qu'elles apparaissent dans les spécifications générales.

# FUT-FEAT-001 : Application iOS native

---

# FUT-FEAT-002 : Application Android native

---

# FUT-FEAT-003 : Gestion de copropriété

Fonctionnalités possibles :

- copropriétaires ;
- syndic ;
- assemblées ;
- votes ;
- tantièmes.

---

# FUT-FEAT-004 : Comptabilité avancée

- écritures ;
- rapprochement bancaire ;
- fiscalité ;
- amortissements ;
- grand livre.

---

# FUT-FEAT-005 : Gestion avancée des fournisseurs

- contrats ;
- devis ;
- appels d'offres ;
- évaluations.

---

# FUT-FEAT-006 : Analytics avancés

- cohortes ;
- analyses poussées ;
- prédictions ;
- benchmarking.

---

# FUT-FEAT-007 : IA immobilière

Possibilités futures :

- détection d'anomalies ;
- prédiction des retards ;
- estimation des coûts ;
- assistant opérationnel.

Aucune de ces capacités n'est nécessaire pour le MVP.

---

# FUT-FEAT-008 : Multi-pays

Gestion de :

- plusieurs devises ;
- plusieurs pays ;
- formats locaux ;
- fournisseurs locaux ;
- règles locales.

---

# FUT-FEAT-009 : White Label

Permettre à d'autres entreprises d'utiliser la plateforme sous leur propre marque.

---

# FUT-FEAT-010 : Multi-provider avancé

Plusieurs fournisseurs simultanément pour :

- paiement ;
- SMS ;
- email ;
- stockage.

---

# FUT-FEAT-011 : Workflow Engine

Créer des automatisations métier configurables par les utilisateurs.

---

# FUT-FEAT-012 : Portail propriétaire avancé

Analytics patrimoniaux approfondis.

---

# FUT-FEAT-013 : API publique

Permettre à des tiers d'intégrer le produit.

---

# FUT-FEAT-014 : Marketplace fournisseurs

Mettre en relation propriétaires et prestataires.

---

# FUT-FEAT-015 : Signature électronique avancée

Ajouter une signature électronique complète de contrats.

---

# FUT-FEAT-016 : Réconciliation bancaire

Importer et rapprocher automatiquement les transactions bancaires.

---

# FUT-FEAT-017 : Permissions granulaires par gestionnaire

Tables `permissions` et `access_permissions`, écran de délégation à cases à cocher, champ `permissions[]` dans l'invitation gestionnaire.

Conséquence de DEC-025 : le MVP évalue les droits sur rôle + périmètre uniquement.

---

# FUT-FEAT-018 : Gestionnaire principal et gestionnaire secondaire

Hiérarchie entre gestionnaires d'un même immeuble.

Conséquence de DEC-025.

---

# FUT-FEAT-019 : Crédits, avoirs et trop-perçus

Gestion d'un solde créditeur au profit du locataire.

Conséquence de DEC-023 : le MVP refuse tout paiement supérieur au montant dû.

---

# FUT-FEAT-020 : Répartition personnalisée et selon consommation

Méthodes `CUSTOM` et `CONSUMPTION`.

Conséquence de DEC-029 : le MVP implémente uniquement `EQUAL`.

---

# FUT-FEAT-021 : Remboursement de paiement

Statut `REFUNDED` et parcours associé.

Conséquence de DEC-016 : au MVP, une correction utilise `CANCELLED` avec trace d'audit.

---

# FUT-FEAT-022 : Envoi automatique des notifications externes

Activation des canaux `SMS`, `WHATSAPP` et `EMAIL` derrière `NotificationProvider`.

Conséquence de DEC-008 et DEC-027 : le MVP n'utilise que `IN_APP`.

---

# 35. Architecture Constraints

Les éléments suivants ne sont pas des fonctionnalités visibles obligatoires du MVP mais doivent être anticipés.

## ARCH-FEAT-001 : API provider-neutral

Le domaine de paiement ne doit pas dépendre d'un fournisseur concret.

---

## ARCH-FEAT-002 : User / Role separation

Conserver :

```text
User
≠
Role
≠
Relationship
```

---

## ARCH-FEAT-003 : Historique

Les changements de relation ne doivent pas détruire l'historique.

---

## ARCH-FEAT-004 : Multi-device

Le backend doit rester utilisable plus tard par :

- PWA ;
- application native ;
- API partenaire.

---

## ARCH-FEAT-005 : Internationalisation potentielle

Le code ne doit pas rendre impossible une future traduction de l'interface.

Le MVP peut toutefois rester entièrement en français.

---

## ARCH-FEAT-006 : Multi-devise potentielle

Les données monétaires possèdent une devise explicite.

---

## ARCH-FEAT-007 : Storage abstraction

Le produit n'est pas enfermé dans un fournisseur spécifique.

---

## ARCH-FEAT-008 : Notification abstraction

Les notifications ne sont pas liées à un seul canal.

---

## ARCH-FEAT-009 : Jobs abstraction

Les tâches différées restent indépendantes de l'interface utilisateur.

---

# 36. Out of Scope

Les éléments suivants sont exclus du MVP et ne doivent pas être développés sans nouvelle décision.

## OUT-FEAT-001 : ERP complet

---

## OUT-FEAT-002 : Microservices

---

## OUT-FEAT-003 : Kubernetes

---

## OUT-FEAT-004 : Application native obligatoire

---

## OUT-FEAT-005 : Comptabilité complète

---

## OUT-FEAT-006 : Fiscalité automatisée

---

## OUT-FEAT-007 : Blockchain

---

## OUT-FEAT-008 : Marketplace complète

---

## OUT-FEAT-009 : IA indispensable au fonctionnement

---

## OUT-FEAT-010 : Système de copropriété complet

---

# 37. Matrice globale

| Domaine | MVP | Future | Architecture | Out of Scope |
|---|---|---|---|---|
| Authentification | Oui | Auth avancée | Provider abstraction | Auth custom complexe |
| Organisation | Oui | Multi-organisation avancée | Isolation | ERP organisationnel |
| Immeubles | Oui | Portefeuille avancé | Modèle extensible | Gestion immobilière générale |
| Appartements | Oui | Modèles avancés | Relations historiques | Modélisation 3D |
| Gestionnaires | Oui | Workflow avancé | RBAC + Scope | Organisation RH complète |
| Locataires | Oui | Portail avancé | User ≠ Profile | Réseau social |
| Contrats | Oui | Signature avancée | Historique | Juridique automatisé |
| Loyers | Oui | Règles avancées | Modèle financier | Comptabilité complète |
| Paiements | Oui | Multi-provider | Adapter | Banque propriétaire |
| Quittances | Oui | Documents avancés | Storage abstraction | Gestion documentaire complète |
| Charges | Oui | Répartition avancée | Allocation engine extensible | Copropriété complète |
| Incidents | Oui | Workflow avancé | Event compatibility | Facility management complet |
| Interventions | Oui | Prestataires avancés | Status engine | Marketplace |
| Dépenses | Oui | Budgets avancés | Historical data | ERP |
| Notifications | Oui | Omnicanal avancé | Provider abstraction | Messagerie interne |
| Dashboards | Oui | Analytics avancés | Event tracking | BI complète |
| Recherche | Oui | Recherche avancée | Permission-first | Search platform dédiée |
| Documents | Oui | GED avancée | Private storage | DMS complet |
| Analytics | Basique | Avancé | Event taxonomy | Data warehouse |
| Monitoring | Oui | Observabilité avancée | Structured logs | SRE complexe |
| Mobile | PWA Mobile First | Native apps | API reusable | Native obligatoire |
| Sécurité | Oui | Sécurité avancée | Security by design | Certification externe obligatoire |
| IA | Non | Oui | Architecture compatible | IA centrale au MVP |

---

# 38. Priorités fonctionnelles du MVP

Toutes les fonctionnalités MVP ne sont pas identiques en priorité.

## P0 : Absolument critique

```text
Auth
Organization
RBAC / Scope
Properties
Apartments
Tenants
Leases
Rents
Payments
Isolation
```

Sans ces éléments, le produit ne remplit pas son rôle principal.

---

## P1 : Critique au fonctionnement complet

```text
Receipts
Charges
Incidents
Interventions
Expenses
Notifications
Dashboards
```

---

## P2 : Important pour l'expérience et l'exploitation

```text
Search
Documents
Analytics
Activity
Advanced filters
```

---

## P3 : À repousser même s'il est intéressant

Tout ce qui :

- enrichit fortement l'analyse ;
- ajoute une nouvelle plateforme ;
- complexifie l'infrastructure ;
- automatise une capacité encore gérable manuellement.

---

# 39. MVP Minimal Absolu

Une version très réduite mais fonctionnelle devrait pouvoir accomplir :

```text
Owner
↓
Create Organization
↓
Create Property
↓
Create Apartments
↓
Invite Manager
↓
Manager accepts
↓
Create Tenant
↓
Tenant accepts
↓
Create Lease
↓
Generate Rent
↓
Record Payment
↓
Generate Receipt
```

Puis :

```text
Tenant
↓
Report Incident
↓
Manager
↓
Intervention
↓
Expense
↓
Close Incident
```

Puis :

```text
Manager
↓
Create Charge
↓
Allocate
↓
Tenant sees amount
```

---

# 40. MVP recommandé pour le premier pilote

Le premier pilote réel devrait se concentrer sur :

### Patrimoine

- immeubles ;
- appartements.

### Utilisateurs

- propriétaire ;
- gestionnaire ;
- locataire.

### Finance

- contrats ;
- loyers ;
- paiements ;
- quittances ;
- charges.

### Opérations

- incidents ;
- interventions ;
- dépenses.

### Fondations

- invitations ;
- permissions ;
- notifications ;
- historique ;
- sécurité.

---

# 41. Fonctionnalités pouvant être désactivées temporairement

Certaines fonctions du MVP peuvent être techniquement présentes mais activées progressivement.

Exemple :

```text
Paiement digital
Notifications WhatsApp
Analytics avancés
```

Cette approche permet de tester progressivement certaines intégrations sans remettre en cause le cœur du produit.

---

# 42. Règle de décision pour toute nouvelle fonctionnalité

Avant d'ajouter une fonctionnalité, poser quatre questions :

```text
1. Est-elle nécessaire au parcours principal ?
2. Est-elle nécessaire à la sécurité ou à l'intégrité ?
3. Peut-on lancer sans elle ?
4. Son absence bloque-t-elle un utilisateur réel ?
```

Si les réponses indiquent qu'elle n'est pas nécessaire :

```text
→ FUT
```

et non :

```text
→ MVP automatiquement
```

---

# 43. Règle anti-scope-creep

Une fonctionnalité ne rejoint pas le MVP simplement parce qu'elle est :

- intéressante ;
- facile à coder ;
- demandée par une seule personne ;
- techniquement possible ;
- visible chez un concurrent ;
- prévue dans une idée future.

Elle rejoint le MVP uniquement si elle est nécessaire au périmètre validé.

---

# 44. Definition of MVP Complete

Le MVP est considéré comme fonctionnel lorsque les utilisateurs peuvent accomplir les parcours suivants de bout en bout.

## Owner

```text
Créer compte
→ Créer organisation
→ Créer immeuble
→ Créer appartements
→ Inviter gestionnaire
```

---

## Manager

```text
Accepter invitation
→ Voir immeuble
→ Créer locataire
→ Inviter locataire
→ Créer contrat
→ Voir loyers
→ Enregistrer paiement
→ Créer charge
→ Gérer incident
```

---

## Tenant

```text
Activer compte
→ Voir logement
→ Voir contrat
→ Voir montant dû
→ Voir paiement
→ Voir quittance
→ Voir charge
→ Déclarer incident
```

---

# 45. Definition of MVP Quality

Au-delà des fonctionnalités, le MVP doit satisfaire :

```text
Sécurité
+
Intégrité financière
+
Isolation des organisations
+
Responsive Mobile First
+
Tests critiques
+
Monitoring
+
Backup
```

Une fonctionnalité présente mais non sécurisée ne doit pas être considérée comme faisant réellement partie du MVP.

---

# 46. Règle de référence pour Claude Code

Avant toute nouvelle implémentation, Claude Code doit vérifier :

```text
Cette fonctionnalité est-elle :
MVP
FUT
ARCH
OUT
?
```

Si elle est `FUT` ou `OUT`, elle ne doit pas être implémentée dans le MVP.

Si elle est `ARCH`, seule la contrainte architecturale nécessaire doit être prise en compte.

---

# 47. Règle de référence pour le produit

Les documents précédents peuvent contenir davantage de possibilités que le MVP.

Le présent document **détaille** le périmètre défini par le Master Product Specification. Il lui est **subordonné** et ne peut pas le contredire.

Ordre d'autorité complet :

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

Le présent document occupe le **rang 3**. Il ne peut jamais être présenté comme supérieur au Master Product Specification.

Face au Development Backlog ou à une demande isolée, il reste la référence pour déterminer **si une capacité appartient au MVP**.

Au sein de ce périmètre, le présent document reste la référence prioritaire pour déterminer **si une capacité appartient au MVP**, face au backlog ou à une demande isolée.

Une demande isolée ne doit pas automatiquement modifier le périmètre.

---

# 48. Principe final

Le MVP n'est pas une version miniature de tout ce que le produit pourrait devenir.

C'est une version suffisamment complète pour résoudre le problème principal avec une architecture capable d'évoluer ensuite.

La logique est :

```text
MVP
=
Cœur fonctionnel
+
Sécurité
+
Fiabilité
+
Simplicité
```

et non :

```text
MVP
=
Toutes les idées disponibles
```

Le principe directeur est :

> **Construire assez pour créer une vraie valeur opérationnelle, mais pas au point de diluer le produit dans des fonctionnalités qui ne sont pas nécessaires au lancement.**