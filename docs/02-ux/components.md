# Component Specification / Component Library

## 1. Objet du document

Ce document définit la bibliothèque de composants fonctionnels et d'interface du SaaS de gestion d'immeubles.

Il constitue le lien entre le Design System et l'implémentation frontend.

Il précise pour chaque composant :

- son objectif ;
- son usage ;
- ses variantes ;
- ses états ;
- ses propriétés ;
- ses comportements ;
- son comportement responsive ;
- ses règles d'accessibilité ;
- ses usages recommandés ;
- ses usages interdits.

Le document est conçu pour être directement exploitable lors du développement avec Claude Code.

---

# 2. Principes de la bibliothèque

## 2.1 Réutilisation

Un même besoin d'interface doit utiliser un même composant.

Il ne faut pas créer plusieurs composants différents pour la même fonction simplement parce qu'ils apparaissent sur plusieurs écrans.

---

## 2.2 Composition

Les composants complexes doivent être construits à partir de composants plus simples.

Exemple :

```text
TenantCard
├── Avatar
├── Text
├── StatusBadge
├── CurrencyDisplay
└── Button
```

---

## 2.3 Mobile First

Chaque composant doit être spécifié d'abord pour smartphone.

Puis son comportement est défini pour :

- tablette ;
- desktop.

---

## 2.4 États complets

Un composant interactif ne doit pas être considéré comme terminé tant que ses états pertinents ne sont pas définis.

---

# 3. Classification des composants

La bibliothèque est organisée en quatre niveaux.

```text id="p8t9q4"
FOUNDATIONS
    ↓
PRIMITIVES
    ↓
COMPOSANTS
    ↓
COMPOSANTS MÉTIER
```

---

# 4. Foundations

Les foundations comprennent :

- couleurs ;
- typographie ;
- espacements ;
- rayons ;
- ombres ;
- icônes ;
- breakpoints ;
- tokens.

Ils sont définis dans le Design System et utilisés par tous les composants.

---

# 5. Primitives

Les primitives sont les éléments de base :

- Button ;
- Input ;
- Select ;
- Checkbox ;
- Radio ;
- Switch ;
- Label ;
- Badge ;
- Avatar ;
- Icon ;
- Text ;
- Divider.

---

# 6. Composants génériques

Les composants génériques combinent plusieurs primitives :

- Card ;
- Modal ;
- BottomSheet ;
- Tabs ;
- Table ;
- List ;
- SearchBar ;
- FilterPanel ;
- EmptyState ;
- ErrorState ;
- LoadingState ;
- Toast ;
- Alert ;
- Pagination ;
- FileUploader ;
- DatePicker ;
- CurrencyDisplay.

---

# 7. Composants métier

Les composants métier sont spécifiques à la plateforme :

- PropertyCard ;
- ApartmentCard ;
- TenantCard ;
- ManagerCard ;
- LeaseCard ;
- RentStatus ;
- PaymentCard ;
- PaymentSummary ;
- ChargeCard ;
- ChargeDistribution ;
- IncidentCard ;
- IncidentTimeline ;
- InterventionCard ;
- ExpenseCard ;
- ActivityItem ;
- NotificationItem ;
- PropertySelector ;
- TenantSelector ;
- ApartmentSelector.

---

# 8. Button

## Objectif

Déclencher une action.

## Variantes

- Primary ;
- Secondary ;
- Tertiary ;
- Destructive ;
- Link.

## États

- default ;
- hover ;
- pressed ;
- focus ;
- disabled ;
- loading.

## Mobile

Le bouton doit être facilement utilisable au toucher.

Les boutons principaux peuvent occuper une largeur importante.

Les actions critiques ne doivent pas être réduites à une icône seule sans raison.

---

# 9. Button Group

Utilisé lorsque plusieurs actions sont liées.

Exemple :

**Annuler** + **Confirmer**

Sur mobile, les actions peuvent être empilées lorsque l'espace est insuffisant.

---

# 10. Input

## Types

- text ;
- number ;
- phone ;
- email ;
- password ;
- search.

## Propriétés

- label ;
- placeholder ;
- value ;
- required ;
- disabled ;
- error ;
- helper text.

## États

- default ;
- focus ;
- filled ;
- error ;
- disabled ;
- success lorsque pertinent.

---

# 11. CurrencyInput

Composant spécialisé pour les montants.

## Objectifs

Faciliter la saisie :

> 2 500 000 GNF

## Fonctionnalités

- formatage ;
- séparateurs ;
- devise explicite ;
- validation numérique ;
- gestion des montants invalides.

Le format exact sera défini selon la localisation et les règles monétaires du produit.

---

# 12. CurrencyDisplay

Affichage standardisé des montants.

Exemple :

**2 500 000 GNF**

Variantes :

- normal ;
- emphasized ;
- positive ;
- negative ;
- compact.

---

# 13. SearchBar

## Mobile

Le champ peut occuper une grande partie de l'écran lorsqu'il est activé.

Il peut également s'ouvrir en vue dédiée pour les recherches complexes.

## Fonctionnalités

- recherche ;
- effacement ;
- état loading ;
- résultats ;
- aucun résultat.

---

# 14. Select

Utilisé pour les choix simples.

Exemples :

- type d'incident ;
- type de charge ;
- moyen de paiement.

## Mobile

Utiliser de préférence un sélecteur tactile ou une bottom sheet pour les listes longues.

---

# 15. Searchable Select

Utilisé lorsqu'un grand nombre d'éléments doivent être sélectionnés.

Exemples :

- locataire ;
- appartement ;
- immeuble.

Le composant doit intégrer :

- recherche ;
- résultats ;
- sélection ;
- état vide ;
- erreur ;
- chargement.

---

# 16. PropertySelector

Composant métier permettant de sélectionner un immeuble.

## Utilisation

Principalement pour les gestionnaires multi-immeubles.

## Mobile

Doit pouvoir s'ouvrir sous forme de bottom sheet.

## Contenu

- nom ;
- localisation ;
- statut ;
- éventuellement nombre d'appartements.

---

# 17. ApartmentSelector

Permet de sélectionner un appartement.

Le composant doit afficher suffisamment d'informations pour éviter les erreurs.

Exemple :

> A04  
> Mamadou Diallo  
> Résidence Camayenne

Lorsque le logement est occupé, le locataire peut être affiché comme contexte.

---

# 18. TenantSelector

Permet de sélectionner un locataire.

Les résultats doivent afficher :

- nom ;
- appartement ;
- immeuble ;
- statut.

Cela réduit les risques de sélectionner le mauvais locataire.

---

# 19. Badge

Utilisé pour :

- statuts ;
- compteurs ;
- petits indicateurs.

Exemples :

**PAYÉ**

**EN RETARD**

**URGENT**

**ACTIF**

---

# 20. StatusBadge

Composant spécialisé dans les statuts métier.

Les états doivent être cohérents dans tout le produit.

Exemples :

> Valeurs canoniques : **Decision Register DEC-015 à DEC-021**.
>
> Le composant reçoit la **valeur d'enum** et affiche le **libellé UI**. Il ne doit jamais recevoir un libellé déjà traduit.

```text id="2x1u03"
ReceivableStatus       loyer ET charge
  UNPAID           À payer
  PARTIALLY_PAID   Partiellement payé
  PAID             Payé
  OVERDUE          En retard
  CANCELLED        Annulé

PaymentStatus
  PENDING          En attente
  CONFIRMED        Confirmé
  FAILED           Échoué
  CANCELLED        Annulé

IncidentStatus
  OPEN             Nouveau
  ASSIGNED         Affecté
  IN_PROGRESS      En cours
  ON_HOLD          En attente
  RESOLVED         Résolu
  CLOSED           Clôturé

InterventionStatus
  PLANNED          Planifiée
  IN_PROGRESS      En cours
  COMPLETED        Terminée
  CANCELLED        Annulée

ApartmentOccupancy   DERIVEE du bail, jamais saisie (DEC-050)
  VACANT           Vacant
  OCCUPIED         Occupé

ApartmentMaintenance   SAISIE, et independante de l'occupation
  under_maintenance   En travaux
```

**Un logement porte les DEUX badges**, l'occupation puis les travaux s'ils sont déclarés. Ce n'est pas un détail d'affichage : DEC-050 point 2 dit qu'un logement peut être en travaux qu'il soit loué ou vide, donc un badge unique ferait disparaître « Occupé » dès qu'un chantier est déclaré, et cacherait le bail qui court.

Couleurs de statut, DEC-012 :

```text
Success  #18794E   PAID, RESOLVED, CONFIRMED, COMPLETED
Warning  #A15C00   PARTIALLY_PAID, PENDING, ON_HOLD
Danger   #B42318   OVERDUE, FAILED
Info     #1769AA   OPEN, ASSIGNED, PLANNED
Neutral  muted     CANCELLED, CLOSED
```

Le composant ne doit pas dépendre uniquement de la couleur : un libellé textuel est toujours présent, et une icône peut le compléter.

---

# 21. Avatar

Utilisé pour représenter un utilisateur.

Fallback :

- initiales.

L'avatar reste secondaire à l'identité textuelle.

---

# 22. Card

Composant de regroupement de contenu.

Variantes :

- standard ;
- interactive ;
- clickable ;
- highlighted ;
- alert.

---

# 23. PropertyCard

## Contenu

- nom ;
- localisation ;
- logements ;
- occupation ;
- indicateur financier éventuel ;
- alertes.

## Mobile

Carte verticale compacte.

## Desktop

Peut devenir plus dense.

---

# 24. ApartmentCard

## Contenu

- numéro ;
- statut ;
- locataire ;
- loyer ;
- état du paiement.

## Action principale

Ouvrir l'appartement.

---

# 25. TenantCard

## Contenu au Lot 7 (DEC-046)

- nom ;
- téléphone ;
- logement ;
- statut d'accès.

Le **statut d'accès** est dérivé, jamais saisi, et prend l'une de ces cinq valeurs : « Invité », « Invitation expirée », « Actif », « Suspendu », « Accès révoqué ».

> **Ni montant ni statut financier au Lot 7.** Ces deux informations naissent du bail : la carte ne les affiche pas, et ne réserve pas un emplacement vide à leur place.

## Contenu ajouté au Lot 8

- montant du loyer ;
- état du paiement.

## Actions au Lot 7

- ouvrir la fiche ;
- copier à nouveau le lien d'invitation, tant qu'elle est en attente ;
- suspendre et réactiver, par `tenant.update` ;
- révoquer l'accès, par `tenant.revoke`.

Suspension et révocation sont portées par le propriétaire comme par le gestionnaire, chacun sur son périmètre (DEC-047). Une action indisponible n'est pas affichée. Révoquer un accès ne clôt aucun bail.

---

# 26. ManagerCard

## Contenu

- nom ;
- rôle ;
- statut ;
- nombre d'immeubles ;
- dernier accès.

## Actions

- gérer les droits ;
- suspendre ;
- révoquer.

---

# 27. LeaseCard

## Contenu

- locataire ;
- appartement ;
- date de début ;
- échéance ;
- montant ;
- statut.

Le contrat doit être facilement identifiable comme une relation locative, et non comme un simple document.

---

# 28. PaymentCard

## Contenu

- montant ;
- locataire ;
- appartement ;
- période ;
- moyen ;
- statut ;
- date.

---

# 29. PaymentSummary

Utilisé pour présenter un paiement ou une dette.

Exemple :

```text id="g2z8fd"
Montant
2 800 000 GNF

Payé
1 500 000 GNF

Restant
1 300 000 GNF
```

---

# 30. RentSummary

Utilisé pour présenter la situation d'**une créance de loyer**.

Informations :

- attendu ;
- payé ;
- restant ;
- statut ;
- échéance.

Le composant doit être facilement lisible sur mobile.

---

# 30-bis. OutstandingSummary

> **Composant requis par DEC-005.**

Présente le **total dû** d'un locataire et ses composantes.

```text id="outsum1"
Total à payer
2 800 000 GNF

  Loyer septembre      2 500 000 GNF   À payer
  Eau septembre          300 000 GNF   À payer
```

Règles :

- le **total** est l'information principale, en Manrope ;
- les composantes sont secondaires mais toujours accessibles ;
- chaque composante affiche son propre statut et son propre reste à payer ;
- le total provient du serveur, jamais d'une addition faite dans le composant.

### Responsive

```text
Mobile    total proéminent + liste repliable des composantes
Tablet    total + liste dépliée
Desktop   total + tableau des composantes
```

Ce composant est utilisé dans le dashboard locataire, l'écran « À payer » et le parcours de paiement.

---

# 31. ChargeCard

## Contenu

- type ;
- période ;
- montant ;
- méthode ;
- statut ;
- nombre d'appartements concernés.

---

# 32. ChargeDistribution

Composant permettant de présenter une répartition.

## Mobile

Liste :

```text id="xvxyrz"
A01
300 000 GNF

A02
300 000 GNF
```

## Desktop

Peut devenir un tableau.

---

# 33. IncidentCard

## Contenu

- catégorie ;
- appartement ;
- priorité ;
- statut ;
- date ;
- dernière activité.

---

# 34. IncidentTimeline

Timeline chronologique.

Exemple :

```text id="mm42lw"
08 sept.
Incident signalé

09 sept.
Pris en charge

09 sept.
Intervention terminée
```

---

# 35. InterventionCard

Contenu :

- incident ;
- prestataire ;
- coût prévu ;
- coût réel ;
- statut ;
- dates.

---

# 36. ExpenseCard

Contenu :

- catégorie ;
- montant ;
- date ;
- immeuble ;
- intervention éventuelle ;
- justificatif.

---

# 37. ActivityItem

Représente une action dans l'historique.

Exemple :

> Mamadou a enregistré un paiement de 2 500 000 GNF.

Informations :

- utilisateur ;
- action ;
- objet ;
- date ;
- heure.

---

# 38. NotificationItem

Contenu :

- titre ;
- résumé ;
- date ;
- état lu / non lu ;
- destination.

---

# 39. EmptyState

Structure :

```text id="grhn4y"
Illustration éventuelle
Titre
Description
Action
```

L'action doit être présente lorsqu'une action pertinente existe.

---

# 40. ErrorState

Structure :

```text id="q0k24y"
Titre
Description
Action de récupération
```

Exemple :

> Impossible de charger les paiements.

**Réessayer**

---

# 41. LoadingState

Le système doit proposer plusieurs niveaux de loading.

### Page

Skeleton global.

### Section

Skeleton local.

### Action

Bouton loading.

### Liste

Skeleton rows / cards.

---

# 42. Modal

Utilisé pour :

- confirmations ;
- petits formulaires ;
- informations ciblées.

Sur mobile, une modale complexe doit devenir une autre structure adaptée.

---

# 43. BottomSheet

Composant prioritaire sur mobile.

Utilisations :

- sélectionner un immeuble ;
- filtrer ;
- choisir un moyen de paiement ;
- afficher des actions ;
- confirmer certaines opérations courtes.

---

# 44. FullScreenSheet

Pour les workflows mobiles complexes.

Exemples :

- formulaire de création ;
- recherche avancée ;
- configuration d'une charge.

---

# 45. ConfirmationDialog

Structure standard :

```text id="ozsach"
Titre
Conséquence
Action secondaire
Action principale
```

Utilisé notamment pour :

- révoquer ;
- publier ;
- annuler ;
- clôturer.

---

# 46. Tabs

Utilisées lorsque plusieurs sous-contextes appartiennent au même objet.

Exemple appartement :

```text id="t93vcr"
Vue
Contrat
Loyers
Paiements
Charges
Incidents
```

### Mobile

Les tabs peuvent devenir scrollables horizontalement lorsque nécessaire.

Il faut éviter un nombre excessif d'onglets.

---

# 47. Segmented Control

Utilisé pour des choix courts et mutuellement exclusifs.

Exemple :

**Tous | Payés | En retard**

Sur mobile, le composant doit rester facilement manipulable.

---

# 48. FilterBar

Desktop :

Filtres visibles.

Mobile :

Bouton **Filtrer** avec bottom sheet.

Les filtres actifs restent visibles sous forme de chips ou d'indicateurs.

---

# 49. FilterChip

Représente un filtre actif.

Exemple :

> En retard ×

L'utilisateur peut supprimer le filtre directement.

---

# 50. Table

La table est un composant principalement desktop.

Elle doit définir :

- colonnes ;
- tri ;
- pagination ;
- sélection ;
- actions.

Sur mobile, la table doit avoir une représentation adaptée.

---

# 51. Responsive List

La liste constitue l'équivalent mobile de nombreuses tables.

Elle doit permettre :

- consultation rapide ;
- sélection ;
- navigation ;
- actions contextuelles.

---

# 52. Pagination

Pour les données volumineuses.

Sur mobile, privilégier :

- pagination simple ;
- infinite scroll lorsque pertinent ;
- chargement progressif.

La décision dépendra du cas d'utilisation et des performances.

---

# 53. DatePicker

Utilisé pour :

- date de début ;
- date d'intervention ;
- date de paiement.

Sur mobile, il doit utiliser une interface adaptée au tactile.

---

# 54. MonthPicker

Utilisé pour :

- périodes de loyer ;
- charges ;
- rapports.

Le choix d'un mois doit être rapide.

---

# 55. FileUploader

Permet :

- sélectionner un fichier ;
- prendre une photo ;
- afficher une miniature ;
- retirer ;
- réessayer.

---

# 56. CameraUpload

Composant particulièrement important pour les incidents.

Mobile :

**Prendre une photo**

doit pouvoir ouvrir directement la caméra.

---

# 57. DocumentItem

Affiche :

- nom ;
- type ;
- date ;
- taille éventuellement ;
- action.

---

# 58. BottomNavigation

Navigation principale mobile.

Elle doit être adaptée au rôle.

Exemple gestionnaire :

```text id="xm6xwj"
Accueil
Immeubles
Loyers
Maintenance
Profil
```

---

# 59. SideNavigation

Navigation desktop.

Elle peut contenir davantage de modules.

---

# 60. Header

Le header doit adapter son contenu au contexte.

### Global

Logo / contexte / notifications / profil.

### Immeuble

Retour / nom de l'immeuble / actions.

### Appartement

Retour / appartement / statut.

### Mobile

Le header doit rester compact.

---

# 61. ContextHeader

Composant permettant d'afficher le contexte courant.

Exemple :

```text id="z1j6l2"
Résidence Camayenne
A04
```

Il peut afficher le niveau hiérarchique sous forme de breadcrumb compact.

---

# 62. Breadcrumb

Principalement desktop.

Sur mobile, une version simplifiée doit être utilisée.

Exemple :

```text id="rksbtr"
← A04
```

plutôt qu'un breadcrumb trop long.

---

# 63. QuickActionMenu

Menu des actions fréquentes.

### Gestionnaire

- Ajouter locataire ;
- Enregistrer paiement ;
- Créer charge ;
- Créer incident ;
- Ajouter dépense.

### Propriétaire

- Ajouter immeuble ;
- Ajouter gestionnaire.

### Locataire

- Payer ;
- Signaler incident.

---

# 64. ProgressStepper

Utilisé pour :

- ajout locataire ;
- configuration d'immeuble ;
- invitation ;
- workflows complexes.

Exemple :

```text id="5m5rji"
1 Identité
2 Logement
3 Contrat
4 Invitation
```

Sur mobile, il peut devenir un indicateur compact :

> Étape 2 sur 4

---

# 65. ConfirmationSummary

Utilisé juste avant les actions critiques.

Exemple :

> Publier les charges ?

12 appartements

3 600 000 GNF

Répartition égale

**Annuler**

**Publier**

---

# 66. Toast

Utilisé pour les confirmations rapides.

Exemples :

> Invitation envoyée.

> Paiement enregistré.

Le toast ne doit pas contenir toute l'information critique.

---

# 67. AlertBanner

Utilisé pour les situations importantes persistantes.

Exemples :

> Votre paiement est encore en vérification.

> Connexion instable.

> Invitation expirée.

---

# 68. PermissionGuard

Composant logique plutôt que visuel.

Il doit permettre de :

- afficher ;
- masquer ;
- désactiver ;
- refuser ;

selon les permissions.

La sécurité réelle reste côté serveur.

---

# 69. RoleBasedNavigation

La navigation doit être construite selon le rôle.

Le propriétaire, le gestionnaire et le locataire ne doivent pas recevoir exactement le même menu.

---

# 70. ContextActionBar

Une barre d'actions contextuelles peut apparaître lorsqu'un utilisateur sélectionne plusieurs éléments.

Exemple :

```text id="t66h2t"
3 sélectionnés
[Relancer] [Exporter]
```

---

# 71. Responsive rules des composants métier

Chaque composant métier doit définir une représentation par largeur.

Exemple :

### TenantCard

Mobile :

Card verticale.

Tablet :

Card compacte.

Desktop :

Row dense.

### PaymentList

Mobile :

Cards.

Tablet :

List.

Desktop :

Table.

---

# 72. Composants à ne pas créer trop tôt

Le produit doit éviter une sur-abstraction.

Ne pas créer un composant dédié simplement parce que deux éléments se ressemblent légèrement.

Un composant doit être créé lorsqu'il existe :

- une répétition réelle ;
- une logique commune ;
- des états communs ;
- une valeur claire à la réutilisation.

---

# 73. Nommage des composants

La nomenclature doit être stable.

Exemple :

```text id="k4u1xw"
Button
Input
Modal
BottomSheet

PropertyCard
ApartmentCard
TenantCard
PaymentCard
IncidentCard
```

Les noms doivent rester identiques entre :

- documentation ;
- design ;
- code.

---

# 74. Props et données

Chaque composant métier doit recevoir uniquement les données nécessaires.

Exemple conceptuel :

```text id="y8a6j3"
PropertyCard
property
occupation
financialSummary
alerts
```

Le composant ne doit pas récupérer directement des données depuis plusieurs sources globales sans raison.

La récupération de données appartient à la couche applicative.

---

# 75. Composants contrôlés et non contrôlés

Les composants de formulaire doivent suivre une convention cohérente.

Les choix techniques exacts seront définis dans l'architecture frontend.

L'objectif est d'éviter que chaque développeur implémente la gestion des formulaires différemment.

---

# 76. États de données

Un composant métier doit pouvoir représenter :

```text id="q3x9ov"
Loading
Empty
Loaded
Error
Forbidden
```

Lorsque pertinent :

```text id="4j0w6e"
Partial
Pending
Archived
```

---

# 77. Tests des composants

Chaque composant critique doit être testable indépendamment.

Exemples :

- Button ;
- Input ;
- PaymentCard ;
- StatusBadge ;
- ChargeDistribution ;
- IncidentCard.

Les tests doivent vérifier :

- rendu ;
- interaction ;
- états ;
- responsive behavior lorsque pertinent ;
- accessibilité.

---

# 78. Storybook ou équivalent

Il est recommandé d'avoir une bibliothèque de composants visible et testable indépendamment de l'application complète.

Cela permettra de :

- documenter ;
- tester ;
- visualiser ;
- développer ;
- modifier les composants de manière contrôlée.

L'outil exact sera choisi lors de l'architecture technique.

---

# 79. Critères d'acceptation d'un composant

Un composant est considéré comme prêt lorsqu'il possède :

- un objectif clair ;
- une API définie ;
- ses variantes ;
- ses états ;
- ses règles responsive ;
- ses règles d'accessibilité ;
- ses cas limites ;
- ses tests lorsque nécessaires ;
- une utilisation documentée.

---

# 80. Mapping composants / produit

Quelques exemples :

```text id="1l4eqw"
Gestionnaire
├── Dashboard
│   ├── StatCard
│   ├── AlertBanner
│   ├── QuickActionMenu
│   └── ActivityItem
│
├── Immeubles
│   ├── PropertyCard
│   └── ApartmentCard
│
├── Locataires
│   ├── SearchBar
│   ├── FilterBar
│   └── TenantCard
│
├── Loyers
│   ├── RentSummary
│   ├── RentStatus
│   └── PaymentCard
│
├── Charges
│   ├── ChargeCard
│   └── ChargeDistribution
│
└── Maintenance
    ├── IncidentCard
    ├── IncidentTimeline
    └── InterventionCard
```

---

# 81. Mobile First : règle d'implémentation

Lors de la création d'un nouveau composant :

1. définir son comportement mobile ;
2. définir ses contraintes de contenu ;
3. définir son comportement tactile ;
4. définir ses états ;
5. définir sa transformation tablette ;
6. définir sa transformation desktop.

Il est interdit conceptuellement de créer d'abord une version desktop puis d'essayer de la compresser sur mobile.

---

# 82. Responsive : adaptation et non duplication

Le produit ne doit pas maintenir trois composants complètement différents lorsque le comportement peut être partagé.

Préférer :

```text
Composant unique
+
responsive behavior
```

plutôt que :

```text
MobileComponent
DesktopComponent
TabletComponent
```

sauf lorsqu'une différence structurelle majeure le justifie.

---

# 83. Performance des composants

Les composants doivent éviter :

- re-renders inutiles ;
- gros assets ;
- images non optimisées ;
- dépendances inutiles ;
- logique métier dupliquée.

La performance mobile est prioritaire.

---

# 84. Sécurité des composants

Un composant masqué ne constitue pas une protection.

Exemple :

Masquer le bouton "Révoquer" au gestionnaire ne suffit pas.

L'autorisation doit être contrôlée au niveau de la logique applicative et du backend.

---

# 85. Accessibilité des composants

Tous les composants interactifs doivent fournir :

- labels ;
- focus ;
- navigation clavier lorsque pertinente ;
- retour d'état ;
- alternatives textuelles ;
- structure sémantique.

---

# 86. Architecture de fichiers frontend

La structure exacte dépendra du framework retenu.

Une organisation conceptuelle peut être :

```text id="m7p35t"
components/
├── ui/
│   ├── Button
│   ├── Input
│   ├── Modal
│   └── ...
│
├── navigation/
│   ├── Header
│   ├── BottomNavigation
│   └── SideNavigation
│
├── property/
│   ├── PropertyCard
│   └── PropertySelector
│
├── apartment/
│   ├── ApartmentCard
│   └── ApartmentSelector
│
├── tenant/
│   ├── TenantCard
│   └── TenantSelector
│
├── payment/
│   ├── PaymentCard
│   ├── PaymentSummary
│   └── RentStatus
│
├── charge/
│   ├── ChargeCard
│   └── ChargeDistribution
│
└── maintenance/
    ├── IncidentCard
    ├── IncidentTimeline
    └── InterventionCard
```

Cette structure reste indicative jusqu'au choix définitif de la stack.

---

# 87. Workflow recommandé avec Claude Code

Le développement doit se faire progressivement.

Pour chaque composant :

### Étape 1

Lire sa spécification.

### Étape 2

Créer le composant.

### Étape 3

Créer les variantes.

### Étape 4

Créer les états.

### Étape 5

Implémenter mobile.

### Étape 6

Ajouter responsive tablette.

### Étape 7

Ajouter responsive desktop.

### Étape 8

Ajouter les tests.

### Étape 9

Intégrer dans les écrans.

---

# 88. Ne pas développer les écrans avant les primitives essentielles

La première couche d'implémentation devrait commencer par :

```text id="q68z7u"
Tokens
↓
Typography
↓
Buttons
↓
Inputs
↓
Navigation
↓
Cards
↓
Status
↓
Feedback
↓
Form patterns
↓
Business components
↓
Screens
```

Cela réduit fortement les incohérences.

---

# 89. Definition of Done d'un composant

Un composant est considéré terminé lorsque :

- la structure fonctionne ;
- les variantes sont implémentées ;
- les états sont gérés ;
- le responsive mobile first fonctionne ;
- le comportement tablette est correct ;
- le comportement desktop est correct ;
- les permissions nécessaires sont respectées ;
- l'accessibilité minimale est assurée ;
- les tests pertinents sont présents ;
- il peut être réutilisé sans modification ponctuelle.

---

# 90. Composants prioritaires du MVP

## Niveau 1

- Button
- Input
- Select
- SearchBar
- Badge
- StatusBadge
- Card
- Modal
- BottomSheet
- Toast
- Alert
- LoadingState
- EmptyState
- ErrorState

## Niveau 2

- BottomNavigation
- Header
- ContextHeader
- PropertySelector
- FilterBar
- DatePicker
- MonthPicker
- CurrencyDisplay
- CurrencyInput
- FileUploader

## Niveau 3

- PropertyCard
- ApartmentCard
- TenantCard
- ManagerCard
- PaymentCard
- PaymentSummary
- RentSummary
- **OutstandingSummary** (total dû multi-créances, DEC-005)
- ChargeCard
- ChargeDistribution
- IncidentCard
- IncidentTimeline
- InterventionCard
- ExpenseCard

---

# 91. Conclusion

La Component Library doit garantir qu'un même langage d'interface est utilisé partout dans le produit.

Elle permet de passer de :

**Design System**

à :

**Composants réutilisables**

puis à :

**Écrans cohérents**

et enfin à :

**Code maintenable.**

La règle fondamentale reste :

> **Mobile First, responsive par conception, composants réutilisables, logique métier séparée de l'interface.**

Le prochain document est maintenant **Technical Architecture / Architecture technique**, qui définira la stack, l'architecture frontend et backend, la base de données, l'authentification, les permissions, les paiements, les notifications, le stockage et la structure du projet pour Claude Code.