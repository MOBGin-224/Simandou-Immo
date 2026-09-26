# Information Architecture

## 1. Objet du document

Ce document définit la structure de l'information du produit de gestion d'immeubles.

Il précise :

- les principaux espaces du produit ;
- les entités qui composent le système ;
- leur hiérarchie ;
- leurs relations ;
- la manière dont les utilisateurs accèdent à l'information ;
- l'organisation de la navigation ;
- la logique de contextualisation des données.

L'objectif est de disposer d'une structure suffisamment claire pour que la future conception UX/UI ne soit pas construite comme une simple collection d'écrans.

Le principe fondamental est :

> **L'information doit être organisée selon la réalité de l'immeuble, pas selon la structure technique du logiciel.**

---

# 2. Principes d'architecture

## 2.1 Le patrimoine est le centre du système

Le produit doit être organisé autour du patrimoine immobilier.

La hiérarchie principale est :

```text
Organisation
    ↓
Immeuble
    ↓
Appartement
    ↓
Locataire
```

Les autres informations viennent se rattacher à cette structure.

---

## 2.2 L'appartement est l'unité opérationnelle centrale

L'immeuble constitue le contexte général.

L'appartement constitue l'unité de gestion quotidienne.

C'est à l'appartement que sont principalement rattachés :

- le locataire ;
- le contrat ;
- le loyer ;
- les charges ;
- les paiements ;
- les incidents ;
- les interventions ;
- une partie des documents ;
- l'historique d'occupation.

Cette structure permet de suivre l'histoire d'un logement même lorsque les locataires changent.

---

## 2.3 L'utilisateur n'est pas le centre de la structure de données

Un locataire n'est pas simplement un compte.

Il possède une relation avec :

- un appartement ;
- un contrat ;
- un immeuble ;
- des échéances ;
- des paiements ;
- des incidents.

De la même manière, un gestionnaire n'est pas propriétaire des données qu'il manipule.

Il possède des droits d'accès sur un périmètre donné.

---

# 3. Architecture globale

```text
PLATEFORME
│
├── Organisation
│   │
│   ├── Utilisateurs
│   │   ├── Propriétaires
│   │   ├── Gestionnaires
│   │   └── Locataires
│   │
│   └── Permissions
│
├── Immeubles
│   │
│   ├── Informations générales
│   ├── Appartements
│   │   │
│   │   ├── Informations
│   │   ├── Occupation
│   │   ├── Locataire
│   │   ├── Contrat
│   │   ├── Loyers
│   │   ├── Paiements
│   │   ├── Charges
│   │   ├── Incidents
│   │   ├── Interventions
│   │   ├── Dépenses
│   │   └── Documents
│   │
│   ├── Charges
│   ├── Maintenance
│   ├── Dépenses
│   ├── Documents
│   └── Activité
│
├── Finance
│   ├── Loyers
│   ├── Paiements
│   ├── Charges
│   └── Dépenses
│
├── Maintenance
│   ├── Incidents
│   └── Interventions
│
├── Utilisateurs
│   ├── Gestionnaires
│   └── Locataires
│
├── Notifications
│
└── Rapports
```

Cette architecture représente la logique fonctionnelle générale. La navigation finale pourra être différente selon le rôle.

---

# 4. Les niveaux d'information

Le système est organisé en plusieurs niveaux.

## Niveau 1 : Organisation

L'organisation représente l'espace de travail du propriétaire ou de la structure qui exploite le produit.

Elle contient notamment :

- utilisateurs ;
- immeubles ;
- permissions ;
- paramètres généraux.

---

## Niveau 2 : Immeuble

L'immeuble représente un patrimoine ou une résidence gérée.

Il contient :

- informations générales ;
- appartements ;
- gestionnaires autorisés ;
- données financières ;
- charges ;
- maintenance ;
- dépenses ;
- documents ;
- activité.

---

## Niveau 3 : Appartement

L'appartement constitue l'unité opérationnelle.

Il contient :

- identité du logement ;
- statut ;
- locataire actuel ;
- contrat ;
- loyers ;
- paiements ;
- charges ;
- incidents ;
- interventions ;
- historique.

---

## Niveau 4 : Utilisateur associé

L'utilisateur associé à un appartement peut être :

- locataire actuel ;
- ancien locataire.

Le lien avec l'appartement doit conserver l'historique.

---

# 5. Entités principales

## 5.1 Organisation

Une organisation constitue l'espace de gestion principal.

Une organisation peut contenir :

- un ou plusieurs propriétaires selon le modèle retenu ;
- un ou plusieurs gestionnaires ;
- un ou plusieurs immeubles ;
- plusieurs locataires indirectement via les appartements.

---

## 5.2 Utilisateur

L'utilisateur représente l'identité numérique d'une personne.

Attributs conceptuels :

- identité ;
- téléphone ;
- email ;
- statut ;
- authentification ;
- rôle(s) ;
- date de création ;
- dernière activité.

Un utilisateur peut avoir plusieurs relations avec différents objets du système.

---

## 5.3 Immeuble

L'immeuble représente une résidence ou un bien composé d'un ou plusieurs logements.

Informations conceptuelles :

- nom ;
- adresse ;
- localisation ;
- description ;
- statut ;
- propriétaire ;
- gestionnaires ;
- appartements ;
- documents.

---

## 5.4 Appartement

L'appartement représente un logement individuel.

Informations conceptuelles :

- identifiant ;
- numéro ;
- étage ;
- type ;
- statut ;
- loyer de référence éventuel ;
- caractéristiques.

Relations :

```text
Appartement
├── appartient à → Immeuble
├── est occupé par → Locataire
├── possède → Contrat
├── génère → Échéances
├── reçoit → Paiements
├── supporte → Charges
├── possède → Incidents
└── possède → Historique
```

---

## 5.5 Contrat

Le contrat représente la relation locative entre un locataire et un appartement pendant une période donnée.

Il contient notamment :

- locataire ;
- appartement ;
- date de début ;
- date de fin ;
- montant ;
- périodicité ;
- échéance ;
- caution ;
- statut.

Un appartement peut avoir plusieurs contrats successifs dans le temps.

---

## 5.6 Échéance de loyer

L'échéance représente une somme attendue pour une période donnée.

Elle doit être rattachée à :

- un contrat ;
- un appartement ;
- un locataire ;
- une période.

Elle contient :

- montant attendu ;
- montant payé ;
- solde ;
- date d'échéance ;
- statut.

---

## 5.7 Paiement

Le paiement représente une transaction enregistrée.

Il est rattaché à :

- un locataire ;
- un appartement ;
- une ou plusieurs sommes dues selon les règles définies ;
- un immeuble ;
- une période.

Il contient :

- montant ;
- date ;
- moyen ;
- référence ;
- statut ;
- utilisateur ayant créé ou confirmé l'opération.

---

## 5.8 Charge

Une charge représente un coût qui doit être réparti entre plusieurs appartements ou affecté à un logement.

Exemples :

- eau ;
- électricité ;
- entretien commun ;
- gardiennage.

La charge contient :

- montant total ;
- type ;
- période ;
- immeuble ;
- méthode de répartition ;
- justificatif ;
- ventilation.

---

## 5.9 Incident

L'incident représente un problème affectant un appartement ou une partie d'un immeuble.

Il contient :

- catégorie ;
- priorité ;
- description ;
- photos ;
- statut ;
- créateur ;
- date ;
- appartement ou immeuble concerné.

---

## 5.10 Intervention

L'intervention représente l'action réalisée pour traiter un incident.

Elle contient :

- incident ;
- prestataire ;
- date ;
- coût prévu ;
- coût réel ;
- photos ;
- justificatifs ;
- statut.

---

## 5.11 Dépense

La dépense représente une sortie financière liée à l'exploitation d'un immeuble.

Elle peut être liée à :

- un immeuble ;
- un appartement ;
- un incident ;
- une intervention ;
- un fournisseur.

---

## 5.12 Document

Un document ou fichier peut être rattaché à différentes entités.

Exemples :

- contrat ;
- facture ;
- quittance ;
- photo ;
- justificatif ;
- document de propriété.

Le document doit toujours être rattaché à un contexte identifiable.

---

# 6. Relations entre les entités

La structure centrale peut être représentée ainsi :

```text
Organisation
    │
    ├── possède / gère
    │
    ▼
Immeuble
    │
    ├── contient
    ▼
Appartement
    │
    ├── est associé à
    ▼
Contrat
    │
    └── concerne
    ▼
Locataire
```

Les flux financiers s'organisent ensuite autour du contrat et de l'appartement :

```text
Contrat
   ↓
Échéance
   ↓
Paiement
   ↓
Quittance
```

Les charges suivent une logique différente :

```text
Facture
   ↓
Charge
   ↓
Répartition
   ↓
Part par appartement
   ↓
Montant dû par locataire
```

La maintenance suit :

```text
Incident
   ↓
Intervention
   ↓
Dépense
```

---

# 7. Navigation selon les rôles

La même base d'information doit être présentée différemment selon l'utilisateur.

---

# 7.1 Architecture du propriétaire

Le propriétaire doit avoir une navigation orientée patrimoine et contrôle.

```text
Accueil
│
├── Mon patrimoine
│   ├── Immeubles
│   └── Détails immeuble
│
├── Finance
│   ├── Revenus
│   ├── Impayés
│   ├── Charges
│   └── Dépenses
│
├── Maintenance
│   ├── Incidents
│   └── Interventions
│
├── Gestionnaires
│
├── Rapports
│
└── Paramètres
```

Le propriétaire doit pouvoir accéder rapidement à la situation globale puis descendre vers un immeuble précis.

---

# 7.2 Architecture du gestionnaire

Le gestionnaire doit avoir une navigation orientée opérations.

```text
Accueil
│
├── Mes immeubles
│   ├── Immeuble
│   │   ├── Appartements
│   │   ├── Loyers
│   │   ├── Charges
│   │   ├── Maintenance
│   │   ├── Dépenses
│   │   └── Activité
│
├── Locataires
│
├── Loyers
│
├── Paiements
│
├── Charges
│
├── Maintenance
│
├── Dépenses
│
└── Notifications
```

Le gestionnaire doit pouvoir travailler depuis plusieurs points d'entrée.

Exemple :

Il peut retrouver un locataire depuis :

**Locataires**

ou depuis :

**Immeuble → Appartement → Locataire**

Les deux chemins doivent conduire à la même donnée.

---

# 7.3 Architecture du locataire

Le locataire doit avoir une architecture beaucoup plus réduite.

```text
Accueil
│
├── Mon logement
│
├── À payer
│
├── Paiements
│
├── Quittances
│
├── Mes charges
│
├── Mes incidents
│
└── Profil
```

Le locataire ne doit pas voir de menus concernant la gestion interne de l'immeuble.

---

# 8. Architecture contextuelle

Le produit doit privilégier une navigation contextuelle.

Lorsqu'un utilisateur se trouve sur :

> **Résidence Camayenne → Appartement A04**

il doit pouvoir accéder directement aux informations liées à cet appartement.

```text
Appartement A04
│
├── Vue générale
├── Locataire
├── Contrat
├── Loyers
├── Paiements
├── Charges
├── Incidents
├── Interventions
├── Documents
└── Historique
```

Cette logique permet d'éviter une navigation inutile entre plusieurs modules.

---

# 9. Principe du contexte persistant

Lorsqu'un utilisateur entre dans un immeuble, le système doit conserver ce contexte pendant sa navigation.

Exemple :

**Résidence Camayenne**

Puis :

**Appartements**

Puis :

**A04**

Puis :

**Paiements**

L'utilisateur reste dans le contexte de A04.

Il ne devrait pas être obligé de resélectionner l'immeuble à chaque étape.

---

# 10. Vues globales et vues contextuelles

Le produit doit distinguer deux types de vues.

## Vue globale

Permet de comparer plusieurs objets.

Exemples :

- tous les immeubles ;
- tous les locataires ;
- tous les paiements ;
- tous les impayés.

## Vue contextuelle

Permet de comprendre un objet donné.

Exemples :

- un immeuble ;
- un appartement ;
- un locataire ;
- un incident.

Les deux types de vues doivent être facilement accessibles.

---

# 11. Architecture du tableau de bord

Le tableau de bord ne doit pas constituer une simple page contenant des statistiques.

Il doit agir comme une porte d'entrée vers les actions.

La structure conceptuelle est :

```text
Résumé
│
├── Ce qui nécessite une action
│
├── Activité récente
│
├── Situation financière
│
└── Accès rapide
```

Exemple :

### À traiter

3 loyers en retard  
1 incident urgent  
1 facture à répartir

Chaque élément doit être cliquable et conduire directement à l'action correspondante.

---

# 12. Architecture des notifications

Les notifications sont transversales.

Elles ne doivent pas devenir un espace administratif isolé.

Chaque notification doit pointer vers son contexte.

Exemple :

> **Nouveau paiement**
>
> A04 a payé 2 500 000 GNF.

En cliquant :

**Immeuble → A04 → Paiement**

Même logique pour :

- incident ;
- relance ;
- invitation ;
- dépense ;
- charge.

---

# 13. Architecture de recherche

La recherche doit fonctionner à plusieurs niveaux.

## Recherche globale

Le gestionnaire peut rechercher :

- locataire ;
- appartement ;
- immeuble ;
- paiement ;
- référence.

## Recherche contextuelle

Dans un immeuble :

- appartement ;
- locataire ;
- incident ;
- paiement.

La recherche doit privilégier les éléments les plus pertinents avant les résultats secondaires.

---

# 14. Architecture des filtres

Les listes doivent pouvoir être filtrées selon leur nature.

### Loyers

- période ;
- immeuble ;
- statut ;
- locataire.

### Paiements

- période ;
- moyen ;
- statut ;
- immeuble ;
- appartement.

### Incidents

- statut ;
- priorité ;
- catégorie ;
- immeuble.

### Dépenses

- période ;
- catégorie ;
- immeuble ;
- prestataire.

Les filtres doivent être contextuels et ne pas exposer des options inutiles.

---

# 15. Architecture des documents

Les documents ne doivent pas constituer uniquement une bibliothèque séparée.

Ils doivent principalement être accessibles depuis leur contexte.

Exemple :

**Appartement A04**

→ Contrat

→ Quittances

→ Documents

**Incident #024**

→ Photos

→ Facture

→ Justificatif

Une vue globale des documents peut néanmoins être proposée au propriétaire ou au gestionnaire.

---

# 16. Architecture de l'activité

Chaque immeuble doit disposer d'un historique d'activité.

Exemple :

```text
08 septembre
14:42
Mamadou a déclaré une fuite
Appartement A04

09 septembre
09:12
Mohamed a été assigné
Incident #024

09 septembre
15:31
Intervention terminée
450 000 GNF

09 septembre
16:02
Dépense enregistrée
```

Cette chronologie permet de comprendre ce qui s'est passé sans rechercher manuellement plusieurs informations.

---

# 17. Architecture financière

Les informations financières doivent être regroupées logiquement sans mélanger les concepts.

```text
FINANCE
│
├── Loyers
│
├── Paiements
│
├── Charges
│
└── Dépenses
```

Une distinction claire doit exister entre :

**Montant attendu**

**Montant payé**

**Montant restant** — solde d'une créance

**Total dû** — somme des soldes des créances ouvertes d'un locataire

**Dépense** — sortie financière supportée par l'immeuble

**Charge** — montant réparti et refacturé aux locataires

Ces concepts ne doivent jamais être présentés comme des synonymes.

> **DEC-005** — une part de charge est une **créance payable**, au même titre qu'une échéance de loyer.
>
> L'espace locataire présente un **montant global à payer**, tout en conservant les composantes séparées et consultables.

---

# 18. Architecture des statuts

Les statuts doivent être cohérents à travers l'application.

Exemples :

> Valeurs canoniques : **Decision Register DEC-015 à DEC-021**. Les libellés ci-dessous sont les termes UI correspondants.

### Paiement — `payment_status`

| Valeur | Libellé UI |
|---|---|
| `PENDING` | En attente |
| `CONFIRMED` | Confirmé |
| `FAILED` | Échoué |
| `CANCELLED` | Annulé |

### Créance — `receivable_status`

Identique pour le loyer et pour les charges.

| Valeur | Libellé UI |
|---|---|
| `UNPAID` | À payer |
| `PARTIALLY_PAID` | Partiellement payé |
| `PAID` | Payé |
| `OVERDUE` | En retard |
| `CANCELLED` | Annulé |

**« À venir »** est un affichage dérivé lorsque la créance est `UNPAID` et que l'échéance est future. Ce n'est pas un statut.

### Incident — `incident_status`

| Valeur | Libellé UI |
|---|---|
| `OPEN` | Nouveau |
| `ASSIGNED` | Affecté |
| `IN_PROGRESS` | En cours |
| `ON_HOLD` | En attente |
| `RESOLVED` | Résolu |
| `CLOSED` | Clôturé |

**« À traiter »** est un filtre du tableau de bord gestionnaire sur `OPEN` et `ASSIGNED`.

### Intervention — `intervention_status`

| Valeur | Libellé UI |
|---|---|
| `PLANNED` | Planifiée |
| `IN_PROGRESS` | En cours |
| `COMPLETED` | Terminée |
| `CANCELLED` | Annulée |

### Appartement — `apartment_status`

| Valeur | Libellé UI |
|---|---|
| `VACANT` | Vacant |
| `OCCUPIED` | Occupé |
| `MAINTENANCE` | En maintenance |

### Accès utilisateur

L'état du **compte** et celui de l'**accès** sont distincts.

| Compte (`user_status`) | Libellé UI |
|---|---|
| `PENDING_ACTIVATION` | Invitation envoyée |
| `ACTIVE` | Actif |
| `SUSPENDED` | Suspendu |

| Accès (`user_access_status`) | Libellé UI |
|---|---|
| `ACTIVE` | Actif |
| `SUSPENDED` | Suspendu |
| `REVOKED` | Révoqué |

L'archivage n'est jamais un statut : il est porté par `archived_at`.

Les libellés utilisés dans l'interface doivent être exactement ceux de ces tableaux.

---

# 19. Architecture de l'activité utilisateur

Les actions doivent être contextualisées.

Au lieu de conserver uniquement :

> Utilisateur : Mamadou  
> Action : Update

Le système doit conserver :

> Mamadou a modifié le montant du loyer de l'appartement A04 de 2 300 000 à 2 500 000 GNF.

Cette information doit être compréhensible par un utilisateur humain.

---

# 20. Architecture des permissions

La permission doit être déterminée à deux niveaux :

```text
ROLE
+
PÉRIMÈTRE
```

Exemple :

```text
Gestionnaire
    +
Résidence Camayenne
```

Le gestionnaire peut alors effectuer les actions autorisées sur cette résidence.

Un autre gestionnaire peut avoir :

```text
Gestionnaire
    +
Résidence Kipé
```

Les données restent isolées.

---

# 21. Architecture multi-immeubles

Le produit doit pouvoir fonctionner avec :

- un propriétaire ;
- un immeuble ;

mais également :

- un propriétaire ;
- plusieurs immeubles ;
- plusieurs gestionnaires ;
- différents périmètres d'accès.

Exemple :

```text
PROPRIÉTAIRE
│
├── Résidence Camayenne
│   └── Gestionnaire A
│
├── Résidence Kipé
│   ├── Gestionnaire A
│   └── Gestionnaire B
│
└── Résidence Dixinn
    └── Gestionnaire B
```

Cette structure doit être native dans le produit.

---

# 22. Architecture temporelle

Le système doit également gérer la dimension temporelle.

Un logement peut avoir :

```text
2024
Locataire A
    ↓
2025
Locataire B
    ↓
2026
Locataire C
```

Chaque période doit rester consultable.

De même :

- les loyers appartiennent à une période ;
- les charges appartiennent à une période ;
- les dépenses appartiennent à une date ;
- les incidents appartiennent à une période ;
- les contrats ont un début et éventuellement une fin.

Le système doit donc être conçu pour l'historique, pas uniquement pour l'état actuel.

---

# 23. Architecture des états vides

Les espaces sans données doivent avoir un sens.

Exemple :

Un immeuble sans locataire ne doit pas simplement afficher :

> Aucun résultat.

Il doit afficher quelque chose de plus utile :

> **Aucun locataire pour le moment**
>
> Ajoutez votre premier locataire pour commencer à suivre les loyers.

Les états vides doivent guider l'utilisateur vers l'action suivante.

---

# 24. Architecture des erreurs

Les erreurs doivent être contextualisées.

Exemple :

Au lieu de :

> Erreur 400

Le système doit afficher :

> **Impossible d'envoyer l'invitation**
>
> Le numéro indiqué semble incorrect.

L'utilisateur doit savoir :

1. ce qui s'est passé ;
2. pourquoi ;
3. ce qu'il peut faire.

---

# 25. Architecture de navigation principale

L'organisation finale de la navigation pourra varier selon le support, mais la structure conceptuelle doit rester stable.

## Propriétaire

```text
Accueil
Patrimoine
Finance
Maintenance
Gestionnaires
Rapports
Paramètres
```

## Gestionnaire

```text
Accueil
Immeubles
Locataires
Loyers
Paiements
Charges
Maintenance
Dépenses
Notifications
```

## Locataire

```text
Accueil
Mon logement
À payer
Paiements
Quittances
Charges
Incidents
Profil
```

---

# 26. Principe de réduction de la navigation

Un utilisateur ne doit pas avoir à parcourir plusieurs menus pour effectuer une opération courante.

Exemple :

Pour enregistrer un paiement :

**Appartement → Paiement → Enregistrer**

et non :

**Finance → Paiements → Immeuble → Appartement → Locataire → Enregistrer**

La structure interne peut être complexe, mais le chemin utilisateur doit rester court.

---

# 27. Architecture des raccourcis

Les actions fréquentes doivent être accessibles depuis plusieurs contextes lorsque cela apporte un gain de temps.

Exemple :

**+ Ajouter un locataire**

peut être accessible depuis :

- Immeuble ;
- Appartement ;
- Locataires.

Le système doit empêcher les doublons et conserver une seule donnée source.

---

# 28. Principe d'unification

Même lorsqu'une information est accessible depuis plusieurs endroits, elle doit rester une seule entité dans le système.

Exemple :

Le paiement de 2 500 000 GNF pour A04 ne doit pas être créé séparément dans :

- l'espace paiement ;
- l'espace locataire ;
- l'espace appartement.

Il s'agit d'un seul paiement affiché depuis plusieurs contextes.

---

# 29. Carte conceptuelle du produit

```text
                         ORGANISATION
                              │
                ┌─────────────┴─────────────┐
                │                           │
           UTILISATEURS                 IMMEUBLES
                │                           │
       ┌────────┼────────┐                  │
       │        │        │                  ▼
 Propriétaire Gestionnaire Locataire    APPARTEMENTS
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                     CONTRAT             LOYERS             INCIDENTS
                         │                   │                   │
                         ▼                   ▼                   ▼
                     ÉCHÉANCES          PAIEMENTS          INTERVENTIONS
                                             │                   │
                                             └─────────┬─────────┘
                                                       │
                                                   DÉPENSES

                    FACTURES
                        │
                        ▼
                    CHARGES
                        │
                        ▼
                  RÉPARTITION
                        │
                        ▼
                  APPARTEMENTS
```

Cette carte représente le noyau conceptuel du produit.

---

# 30. Principes à préserver lors de la conception UX/UI

La future interface devra conserver les principes suivants :

### 1. Le patrimoine comme contexte principal

L'utilisateur doit toujours savoir :

> Dans quel immeuble suis-je ?

> Sur quel appartement suis-je ?

> Quel locataire est concerné ?

### 2. Navigation contextuelle

Une information doit rester facilement accessible depuis son objet parent.

### 3. Une donnée, une source

Aucune duplication fonctionnelle inutile.

### 4. Global vers détail

L'utilisateur peut partir d'un résumé et descendre jusqu'à la donnée source.

### 5. Action rapide

Les opérations fréquentes doivent nécessiter peu d'étapes.

### 6. Rôles séparés

Chaque utilisateur voit uniquement ce qui lui est utile et autorisé.

### 7. Historique permanent

Le passage d'un état à un autre ne doit pas détruire l'historique.

---

# 31. Préparation à la conception des interfaces

L'architecture est maintenant suffisamment définie pour préparer les prochaines étapes :

**Information Architecture**

→ **Roles & Permissions Matrix**

→ **Data Model**

→ **Business Rules**

→ **UX Structure**

→ **Wireframes**

→ **UI Design**

La prochaine documentation doit donc préciser exactement **qui a le droit de faire quoi, sur quelles données et dans quelles circonstances**.

Il s'agit du document :

> **Roles & Permissions Matrix**