# Visual Identity & UI Direction Specification

## 1. Objet du document

Ce document définit la direction visuelle du produit.

> **STATUT : VALIDÉE (DEC-012).**
>
> La direction visuelle **« Property Infrastructure »** est arrêtée par le fondateur.
>
> Les valeurs de référence figurent dans le **Design System, section 2**, qui fait autorité. Le présent document en décrit l'intention et les règles d'application.
>
> Le nom du produit est **SIMANDOU IMMO** (DEC-031, VERROUILLÉE). Seuls les éléments graphiques de marque (logo, monogramme, favicon) restent à produire.

Il établit :

- les principes visuels ;
- les objectifs perceptifs ;
- la personnalité de l'interface ;
- les règles de hiérarchie ;
- les principes de couleur ;
- la typographie ;
- les formes ;
- les composants visuels ;
- la densité ;
- l'iconographie ;
- les états ;
- les règles responsive ;
- les critères de cohérence entre design et code.

La charte visuelle finale sera définie à partir de ce cadre.

---

# 2. Principe directeur

Le produit doit donner une impression combinée :

```text
Sérieux
+
Moderne
+
Simple
+
Fiable
+
Accessible
```

Il ne doit pas donner l'impression :

- d'un logiciel comptable ancien ;
- d'un ERP complexe ;
- d'un outil administratif froid ;
- d'une application grand public trop ludique ;
- d'un simple tableau de bord financier.

---

# 3. Positionnement perceptif

L'interface doit transmettre :

## 3.1 Confiance

L'utilisateur manipule :

- loyers ;
- paiements ;
- contrats ;
- documents ;
- charges.

La perception de fiabilité est donc essentielle.

---

## 3.2 Simplicité

Même lorsque le backend est complexe, l'utilisateur doit voir une interface simple.

Principe :

```text
Complexité technique
≠
Complexité visuelle
```

---

## 3.3 Contrôle

Le propriétaire doit sentir qu'il maîtrise son patrimoine.

Le gestionnaire doit sentir qu'il maîtrise ses opérations.

Le locataire doit comprendre immédiatement ce qui concerne son logement.

---

# 4. MVP

# MVP-UI-001 : Mobile First

Le smartphone est le format de référence.

Les décisions visuelles doivent être prises dans cet ordre :

```text
Smartphone
↓
Tablet
↓
Desktop
```

L'interface desktop ne doit pas dicter la structure mobile.

---

# 5. MVP-UI-002 : Hiérarchie visuelle

Chaque écran doit avoir :

```text
1. Information principale
2. Action principale
3. Informations secondaires
4. Actions secondaires
```

Éviter les écrans où toutes les informations semblent avoir la même importance.

---

# 6. MVP-UI-003 : Une action principale

Un écran important doit avoir une action principale clairement identifiable.

Exemples :

```text
Créer un immeuble
Ajouter un locataire
Enregistrer un paiement
Déclarer un incident
Publier une charge
```

Les actions secondaires ne doivent pas concurrencer visuellement l'action principale.

---

# 7. MVP-UI-004 : Densité

Le produit doit être dense en information sans être visuellement chargé.

Principe :

```text
Information utile
+
Espacement suffisant
+
Hiérarchie forte
```

---

# 8. MVP-UI-005 : Cartes

Les cartes doivent être utilisées lorsqu'elles facilitent :

- regroupement ;
- lecture ;
- comparaison ;
- action.

Ne pas transformer chaque section en carte uniquement pour ajouter un contour.

---

# 9. MVP-UI-006 : Listes

Sur mobile, les listes constituent un pattern central.

Une ligne doit présenter rapidement :

```text
Identité / Objet
+
Contexte
+
Statut
+
Action éventuelle
```

---

# 10. MVP-UI-007 : Navigation

La navigation doit être contextuelle.

Le système doit distinguer :

### Navigation principale

Les grands espaces de l'application.

### Navigation contextuelle

Les éléments liés à l'objet consulté.

Exemple :

```text
Immeuble
├── Vue d'ensemble
├── Appartements
├── Locataires
├── Loyers
├── Charges
├── Maintenance
└── Dépenses
```

---

# 11. MVP-UI-008 : Dashboard

Le dashboard ne doit pas être un mur de statistiques.

Il doit répondre à :

```text
Qu'est-ce qui va bien ?
Qu'est-ce qui nécessite mon attention ?
Que dois-je faire maintenant ?
```

---

# 12. Dashboard Owner

Ordre visuel recommandé :

```text
Contexte patrimoine
↓
KPIs essentiels
↓
Alertes / anomalies
↓
Actions rapides
↓
Activité récente
```

---

# 13. Dashboard Manager

Prioriser :

```text
À traiter
↓
Paiements / retards
↓
Incidents
↓
Actions rapides
↓
Activité
```

---

# 14. Dashboard Tenant

Prioriser :

```text
Mon logement
↓
Ce que je dois
↓
Mon dernier paiement
↓
Mes charges
↓
Mes incidents
```

---

# 15. MVP-UI-009 : Couleurs

> **Palette validée : DEC-012.**

| Rôle | Token | Valeur |
|---|---|---|
| Identité | Navy | `#123B4A` |
| Action principale | Teal | `#138A8A` |
| Accent secondaire | Secondary Teal | `#2B9A8F` |
| Fond | Background | `#F7F9F8` |
| Surface | Surface | `#FFFFFF` |
| Texte | Text | `#172126` |
| Texte secondaire | Muted | `#66747A` |
| Bordure | Border | `#DCE4E5` |

États fonctionnels :

| Rôle | Valeur |
|---|---|
| Success | `#18794E` |
| Warning | `#A15C00` |
| Danger | `#B42318` |
| Info | `#1769AA` |

Ces valeurs doivent être exposées comme design tokens et jamais recopiées en dur.

---

# 16. Règle de couleur

La couleur ne doit pas être utilisée uniquement comme décoration.

Elle peut communiquer :

- importance ;
- statut ;
- action ;
- alerte.

Mais elle ne doit jamais constituer le seul moyen de comprendre l'information.

---

# 17. MVP-UI-010 : Couleur principale

La couleur d'action principale est le **Teal `#138A8A`**.

La couleur d'identité est le **Navy `#123B4A`**, utilisée pour la navigation et les titres forts.

Le Teal s'applique à :

- boutons primaires ;
- liens ;
- anneau de focus ;
- éléments sélectionnés.

Le Navy structure la navigation et l'en-tête.

Les deux ne doivent jamais être interchangés : le Navy n'est pas une couleur d'action, le Teal n'est pas une couleur de fond de navigation.

---

# 18. MVP-UI-011 : Couleurs de statut

Les statuts doivent être cohérents dans toute l'application.

Exemple conceptuel :

```text
Success
=
Payé / Résolu / Confirmé

Warning
=
En attente / À traiter

Danger
=
En retard / Échec / Critique

Neutral
=
Archivé / Inactif
```

Les couleurs finales seront définies dans le Design System final.

---

# 19. MVP-UI-012 : Typographie

> **Typographie validée : DEC-012.**

| Famille | Usage |
|---|---|
| **Manrope** | Identité, titres, chiffres importants, marque |
| **Inter** | Contenu, formulaires, boutons, tableaux, navigation |

Les **montants financiers utilisent Manrope**, afin d'être immédiatement identifiables comme information principale.

La typographie doit privilégier :

- lisibilité ;
- simplicité ;
- bonne lecture sur petit écran ;
- distinction claire entre titres et données.

---

# 20. Hiérarchie typographique

Structure indicative :

```text
Display
↓
Page Title
↓
Section Title
↓
Card Title
↓
Body
↓
Secondary Text
↓
Caption
```

---

# 21. Données financières et typographie

Les montants financiers doivent bénéficier d'une forte lisibilité.

Exemple :

```text
2 800 000 GNF
```

doit être visuellement identifiable rapidement comme montant principal.

---

# 22. MVP-UI-013 : Formes

Le langage visuel doit privilégier des formes :

- contemporaines ;
- légèrement arrondies ;
- cohérentes ;
- suffisamment sérieuses.

Éviter :

- interfaces entièrement carrées et rigides ;
- interfaces excessivement arrondies donnant une impression enfantine.

---

# 23. MVP-UI-014 : Radius

Les rayons doivent être définis comme tokens.

Exemple conceptuel :

```text
xs
sm
md
lg
xl
full
```

Chaque niveau doit avoir un usage précis.

---

# 24. MVP-UI-015 : Ombres

Les ombres doivent être discrètes.

Privilégier :

```text
Elevation
=
hiérarchie
```

plutôt que :

```text
Elevation
=
décoration
```

---

# 25. MVP-UI-016 : Borders

Les bordures doivent permettre de structurer l'interface sans produire une sensation de grille excessive.

---

# 26. MVP-UI-017 : Espacement

Le produit doit utiliser une échelle d'espacement cohérente.

Exemple conceptuel :

```text
4
8
12
16
24
32
48
64
```

Les valeurs finales dépendront du Design System.

---

# 27. MVP-UI-018 : Boutons

Le bouton principal doit être immédiatement identifiable.

Catégories :

```text
Primary
Secondary
Tertiary
Destructive
Ghost
Icon
```

---

# 28. Bouton mobile

Les boutons d'action importants doivent être faciles à toucher.

Les actions principales peuvent utiliser une largeur adaptée au contexte plutôt qu'une taille fixe universelle.

---

# 29. Bouton destructif

Une action destructive doit être visuellement identifiable.

Exemples :

- Révoquer ;
- Archiver ;
- Annuler lorsque irréversible.

---

# 30. MVP-UI-019 : Inputs

Les champs doivent être :

- clairement délimités ;
- suffisamment grands ;
- faciles à toucher ;
- lisibles ;
- cohérents.

---

# 31. Inputs financiers

Le champ montant doit communiquer :

```text
Label
+
Valeur
+
Devise
+
Erreur éventuelle
```

---

# 32. MVP-UI-020 : Selects

Les sélecteurs doivent être adaptés au mobile.

Lorsqu'une liste est longue, privilégier :

- recherche ;
- bottom sheet ;
- écran de sélection ;
- sélection filtrable.

---

# 33. MVP-UI-021 : Bottom Sheets

Les Bottom Sheets sont des composants importants du langage mobile.

Ils sont adaptés notamment à :

- sélection ;
- filtres ;
- actions ;
- confirmations simples.

---

# 34. Full Screen Sheets

Pour des parcours complexes sur smartphone, un écran de type feuille plein écran peut être préférable à une petite modal.

---

# 35. MVP-UI-022 : Modales

Les modales doivent être réservées aux interactions nécessitant une interruption du contexte.

Ne pas utiliser une modal pour chaque interaction.

---

# 36. MVP-UI-023 : Toast

Les toasts sont adaptés aux retours courts :

```text
Enregistré
Invitation envoyée
Document ajouté
```

Ils ne doivent pas être le seul endroit où une information critique existe.

---

# 37. MVP-UI-024 : Alertes

Les alertes doivent servir aux situations nécessitant une attention explicite.

Exemple :

> Ce paiement est toujours en cours de vérification.

---

# 38. MVP-UI-025 : Badges

Les badges doivent servir notamment aux statuts.

Exemple :

```text
Payé
En attente
En retard
Résolu
```

---

# 39. MVP-UI-026 : Cards métier

Les cartes principales peuvent inclure :

```text
PropertyCard
ApartmentCard
TenantCard
PaymentCard
ChargeCard
IncidentCard
InterventionCard
ExpenseCard
```

Chaque carte doit avoir une hiérarchie cohérente.

---

# 40. Property Card

Une Property Card doit permettre d'identifier rapidement :

```text
Nom
Adresse
Nombre de logements
Occupation
Éventuel indicateur d'attention
```

---

# 41. Apartment Card

Afficher prioritairement :

```text
Référence
Statut
Occupant
Loyer
```

selon le contexte utilisateur.

---

# 42. Tenant Card

Afficher :

```text
Nom
Appartement
Statut
Information principale utile
```

Éviter d'afficher systématiquement toutes les coordonnées personnelles.

---

# 43. Payment Card

Afficher :

```text
Montant
Période
Statut
Date
```

Le statut doit être immédiatement identifiable.

---

# 44. Charge Card

Afficher :

```text
Type
Période
Montant
Part concernée
Statut
```

---

# 45. Incident Card

Afficher :

```text
Problème
Logement
Priorité
Statut
Date
```

---

# 46. Intervention Card

Afficher :

```text
Incident
Intervenant
Statut
Coût
Date
```

---

# 47. MVP-UI-027 : Iconographie

> **Bibliothèque validée, DEC-012 : Lucide.**

Aucune autre bibliothèque d'icônes ne doit être introduite.

Les icônes doivent être :

- simples ;
- cohérentes ;
- immédiatement compréhensibles ;
- limitées à un langage visuel unique.

Une icône ne doit jamais porter seule une information critique.

---

# 48. Icônes fonctionnelles

Exemples de familles :

```text
Home / Property
Building / Apartments
Users / Tenants
Credit Card / Payments
Receipt / Receipts
Droplets / Charges
Wrench / Maintenance
Wallet / Expenses
Bell / Notifications
Settings
```

Les icônes exactes seront choisies dans la phase Design System finale.

---

# 49. MVP-UI-028 : Illustrations

Les illustrations ne doivent pas être omniprésentes.

Elles sont principalement utiles pour :

- empty states ;
- onboarding ;
- situations particulières.

---

# 50. Empty States

Un Empty State doit comporter :

```text
Illustration ou icône éventuelle
+
Titre
+
Explication
+
Action principale
```

Exemple :

> Aucun appartement

> Cet immeuble ne contient encore aucun appartement.

> Ajouter un appartement

---

# 51. MVP-UI-029 : Loading States

Le produit doit éviter les écrans blancs.

Utiliser :

- skeleton ;
- spinner ;
- progression ;
- message d'état.

Le choix dépend du contexte.

---

# 52. MVP-UI-030 : Error States

Une erreur doit conserver la cohérence visuelle du produit.

Structure :

```text
Icon
+
Titre
+
Explication
+
Action de récupération
```

Exemple :

> Impossible de charger les paiements.

> Vérifiez votre connexion puis réessayez.

---

# 53. MVP-UI-031 : Not Found

Une ressource non trouvée doit fournir une expérience claire.

Exemple :

> Ce logement n'est plus disponible dans votre espace.

---

# 54. MVP-UI-032 : Unauthorized

Une action interdite doit être distinguée d'une ressource inexistante lorsque cela peut être fait sans révéler d'information sensible.

---

# 55. Navigation mobile

La navigation principale doit privilégier un nombre limité de destinations.

Exemple propriétaire :

```text
Accueil
Patrimoine
Finance
Maintenance
Plus
```

La structure exacte pourra évoluer lors de la conception des écrans.

---

# 56. Navigation gestionnaire

Exemple :

```text
Accueil
Immeubles
Locataires
Paiements
Maintenance
Plus
```

---

# 57. Navigation locataire

Exemple :

```text
Accueil
Mon logement
À payer
Paiements
Plus
```

---

# 58. Contexte persistant

Lorsqu'un utilisateur travaille à l'intérieur d'un immeuble, le système doit conserver clairement le contexte.

Exemple :

```text
Résidence Camayenne
↓
Appartements
↓
A04
```

L'utilisateur ne doit pas devoir deviner dans quel immeuble il se trouve.

---

# 59. MVP-UI-033 : Actions rapides

Les actions fréquentes doivent être facilement accessibles.

Owner :

```text
Ajouter immeuble
Inviter gestionnaire
```

Manager :

```text
Ajouter locataire
Enregistrer paiement
Créer charge
Déclarer intervention
```

Tenant :

```text
Payer
Voir quittance
Déclarer incident
```

---

# 60. MVP-UI-034 : Confirmation

Les actions à impact élevé doivent utiliser une confirmation adaptée.

Exemples :

```text
Révoquer un gestionnaire
Publier une charge
Annuler une opération
```

---

# 61. Confirmation financière

Avant confirmation, afficher un résumé :

```text
Objet
Montant
Méthode
Résultat attendu
Action
```

---

# 62. MVP-UI-035 : Feedback immédiat

Après une action :

```text
Action
↓
Feedback
↓
Nouvel état
```

Exemple :

```text
Enregistrer paiement
↓
Paiement enregistré
↓
Solde mis à jour
```

---

# 63. MVP-UI-036 : États de traitement

Pour les opérations asynchrones :

```text
Processing
```

doit être distinct de :

```text
Success
```

et :

```text
Failure
```

---

# 64. Paiement mobile

Le parcours visuel doit être extrêmement explicite :

```text
Montant
↓
Mode de paiement
↓
Confirmation
↓
Traitement
↓
Résultat
```

---

# 65. Charges

La répartition doit être visuellement compréhensible.

Exemple :

```text
Facture totale
3 600 000 GNF

12 appartements

Votre part
300 000 GNF
```

---

# 66. Maintenance

Le statut d'un incident doit être visible sans ouvrir plusieurs écrans.

Exemple :

```text
Fuite d'eau
Appartement A04

En cours
```

---

# 67. Documents

Les documents doivent présenter :

```text
Type
Nom
Date
Taille lorsque pertinente
Action
```

---

# 68. MVP-UI-037 : Responsive tables

Les tableaux desktop ne doivent pas simplement être compressés sur mobile.

Sur smartphone, préférer :

- cartes ;
- listes ;
- lignes structurées ;
- scroll horizontal uniquement lorsque nécessaire.

---

# 69. MVP-UI-038 : Desktop

Le desktop doit permettre davantage de densité sans changer la logique du produit.

Exemple :

```text
Mobile:
1 colonne

Tablet:
2 colonnes

Desktop:
2 à 4 colonnes selon le contenu
```

---

# 70. MVP-UI-039 : Tablet

La tablette doit être considérée comme un format intermédiaire.

Elle peut utiliser :

- navigation compacte ;
- grilles ;
- panneaux ;
- listes plus denses.

---

# 71. MVP-UI-040 : Motion

Les animations doivent être :

- courtes ;
- fonctionnelles ;
- discrètes.

Elles doivent aider à comprendre :

- apparition ;
- transition ;
- validation ;
- changement d'état.

---

# 72. Future Evolutions

Les éléments suivants peuvent être introduits plus tard.

## FUT-UI-001 : Thèmes multiples

- dark mode ;
- thèmes personnalisés ;
- branding client.

---

## FUT-UI-002 : White Label

Personnalisation :

- logo ;
- couleurs ;
- typographie ;
- domaine.

---

## FUT-UI-003 : Design Motion avancé

Créer un langage de motion plus complet.

---

## FUT-UI-004 : Illustrations personnalisées

Créer un univers graphique propriétaire plus riche.

---

## FUT-UI-005 : Native Mobile Design

Créer des règles propres à :

- iOS ;
- Android.

---

## FUT-UI-006 : Data Visualization avancée

Ajouter :

- graphiques ;
- tendances ;
- comparaisons ;
- analytics patrimoniaux.

---

# 73. Architecture Constraints Related to Future Evolutions

## ARCH-UI-001 : Design Tokens

Toutes les décisions visuelles structurantes doivent pouvoir être transformées en tokens.

---

## ARCH-UI-002 : Composants réutilisables

Les éléments récurrents doivent être construits comme composants réutilisables.

---

## ARCH-UI-003 : Responsive by Default

Un composant ne doit pas être conçu comme desktop-only puis réparé plus tard.

---

## ARCH-UI-004 : Accessibility by Default

Les composants doivent permettre :

- labels ;
- focus ;
- états ;
- navigation assistée.

---

## ARCH-UI-005 : Variants

Les différences visuelles doivent être modélisées par des variants lorsque cela est pertinent.

Exemple :

```text
Button
├── primary
├── secondary
├── destructive
└── ghost
```

---

# 74. Out of Scope

## OUT-UI-001

Définir immédiatement les valeurs finales de couleur avant exploration de marque.

---

## OUT-UI-002

Créer plusieurs systèmes visuels concurrents dans le même produit.

---

## OUT-UI-003

Créer des animations complexes sans bénéfice utilisateur.

---

## OUT-UI-004

Construire une interface desktop puis la réduire pour mobile.

---

# 75. Direction visuelle : statut des décisions

> **VALIDÉE : DEC-012.**

## Arrêté

```text
Identité        « Property Infrastructure »
Couleurs        Navy, Teal, Secondary Teal, Background,
                Surface, Text, Muted, Border
Statuts         Success, Warning, Danger, Info
Typographie     Manrope (identité, titres, chiffres)
                Inter (contenu, formulaires, navigation)
Iconographie    Lucide
Touch target    44 × 44 px
Mobile first    obligatoire
```

Ces décisions ne doivent plus être rouvertes ni signalées comme ouvertes.

## Encore à produire

Le nom est arrêté : **SIMANDOU IMMO** (DEC-031).

Restent à créer, sans nouvelle décision produit :

```text
Logo
Monogramme
Favicon
```

Ils ne bloquent pas l'implémentation des composants ni des écrans.

## À fixer à l'implémentation

Sans nouvelle décision produit, lors de la création des tokens :

```text
Échelle typographique exacte
Valeurs de radius par niveau
Valeurs d'élévation
Durées de transition
```

---

# 76. Critères de validation de la direction visuelle

La direction visuelle doit être validée uniquement lorsqu'elle respecte simultanément :

```text
Identité
+
Lisibilité
+
Simplicité
+
Crédibilité
+
Mobile First
+
Accessibilité
+
Cohérence technique
```

---

# 77. Definition of Done Design

Une fonctionnalité UI est considérée comme correctement conçue lorsqu'elle possède :

```text
[ ] Hiérarchie claire
[ ] Mobile layout
[ ] Tablet adaptation
[ ] Desktop adaptation
[ ] States
[ ] Component mapping
[ ] Accessibility
[ ] Design tokens
[ ] Interaction feedback
```

---

# 78. Principe final

Le langage visuel du produit doit traduire le positionnement fondamental :

```text
Technologie complexe
↓
Expérience simple
```

L'utilisateur ne doit pas voir la sophistication technique.

Il doit voir :

```text
Une interface claire
Des informations compréhensibles
Des actions évidentes
Des réponses fiables
```

Le principe directeur est :

> **Le design doit rendre la puissance du produit presque invisible. L'utilisateur doit avoir l'impression que tout est simple, évident et sous contrôle.**