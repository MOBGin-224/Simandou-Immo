# Design System / UI Design Specification

## 1. Objet du document

Ce document définit le système d'interface utilisateur du SaaS de gestion d'immeubles.

Il constitue la référence commune pour :

- la conception UI ;
- les prototypes haute fidélité ;
- l'implémentation frontend ;
- la cohérence entre les écrans ;
- la création de composants réutilisables ;
- le responsive ;
- l'accessibilité ;
- l'évolution future du produit.

Le système est conçu selon le principe :

> **Responsive Mobile First**

Le smartphone est le format de référence.

Les interfaces sont ensuite adaptées à la tablette et au desktop.

---

# 2. Statut de la charte visuelle

> **VALIDÉE — DEC-012.**
>
> La direction visuelle **« Property Infrastructure »** est arrêtée. Elle ne constitue plus une décision ouverte.

## 2.1 Palette validée

| Token | Valeur | Usage |
|---|---|---|
| `color.brand.navy` | `#123B4A` | Identité, navigation, titres forts |
| `color.action.primary` | `#138A8A` | Action principale |
| `color.action.secondary` | `#2B9A8F` | Accent secondaire |
| `color.background` | `#F7F9F8` | Fond d'application |
| `color.surface` | `#FFFFFF` | Cartes, feuilles, panneaux |
| `color.text.primary` | `#172126` | Texte principal |
| `color.text.muted` | `#66747A` | Texte secondaire |
| `color.border.default` | `#DCE4E5` | Bordures et séparateurs |

## 2.2 États fonctionnels validés

| Token | Valeur | Signification métier |
|---|---|---|
| `color.status.success` | `#18794E` | Payé, résolu, confirmé |
| `color.status.warning` | `#A15C00` | En attente, à traiter |
| `color.status.danger` | `#B42318` | En retard, échec, critique |
| `color.status.info` | `#1769AA` | Information neutre |

## 2.3 Typographie validée

| Famille | Usage |
|---|---|
| **Manrope** | Identité, titres, chiffres importants, marque |
| **Inter** | Contenu, formulaires, boutons, tableaux, navigation |

Les montants financiers utilisent **Manrope** afin d'être immédiatement identifiables.

## 2.4 Autres décisions validées

```text
Icônes                 Lucide
Touch target minimum   44 × 44 px
Mobile first           obligatoire
```

## 2.5 Marque

Le nom du produit est **SIMANDOU IMMO** (DEC-031, VERROUILLÉE).

C'est le nom affiché dans l'application, les en-têtes et les notifications.

SIMANDOU IMMO est un produit **distinct de SIMANDOU SEJOUR**.

Restent à produire, sans nouvelle décision produit :

- logo ;
- monogramme ;
- favicon.

Ces éléments graphiques ne bloquent pas l'implémentation des composants.

## 2.6 Règle d'implémentation

Toute valeur visuelle ci-dessus doit être exposée comme **design token** et jamais recopiée en dur dans un composant.

La couleur ne doit jamais être le seul porteur d'une information (DEC-012, Accessibility).

---

# 3. Principes UI

## UI-001 : Mobile First

Tous les composants sont conçus d'abord pour smartphone.

## UI-002 : Touch First

Les interactions doivent être adaptées au tactile.

## UI-003 : Clarté

L'interface doit privilégier la compréhension à la décoration.

## UI-004 : Hiérarchie

Les informations importantes doivent être immédiatement identifiables.

## UI-005 : Cohérence

Un même concept doit être présenté de la même manière partout.

## UI-006 : Feedback

Chaque action doit produire un retour approprié.

## UI-007 : Accessibilité

L'interface doit rester utilisable par des personnes ayant des capacités et des habitudes différentes.

---

# 4. Architecture du Design System

Le système UI sera organisé en plusieurs niveaux.

```text
Design Tokens
    ↓
Foundations
    ↓
Components
    ↓
Patterns
    ↓
Templates
    ↓
Screens
```

---

# 5. Design Tokens

Les Design Tokens représentent les valeurs fondamentales du système.

Ils devront être centralisés afin d'éviter les valeurs arbitraires dans le code.

Les catégories principales sont :

- couleurs ;
- typographie ;
- espacements ;
- dimensions ;
- rayons ;
- ombres ;
- transitions ;
- z-index ;
- breakpoints.

---

# 6. Color System

> Valeurs validées : voir section 2. Cette section définit la **structure** des tokens.

## 6.1 Structure

La palette est organisée par fonction et non uniquement par couleur.

Catégories :

```text
Brand
Primary
Secondary
Neutral
Success
Warning
Danger
Info
Background
Surface
Border
Text
```

---

## 6.2 Principe

Les composants doivent utiliser les tokens fonctionnels.

Exemple :

```text
color.text.primary
color.text.secondary
color.surface.default
color.border.default
color.action.primary
color.status.success
color.status.warning
color.status.danger
```

Le composant ne doit pas utiliser directement une valeur hexadécimale arbitraire.

---

# 7. Typographie

Le système doit définir :

- famille principale ;
- famille secondaire éventuelle ;
- poids ;
- tailles ;
- hauteur de ligne ;
- espacement des lettres.

La hiérarchie minimale doit couvrir :

```text
Display
Heading 1
Heading 2
Heading 3
Body Large
Body
Body Small
Caption
Label
Button
```

---

# 8. Typographie Mobile First

La typographie mobile est prioritaire.

Les tailles doivent être suffisamment grandes pour garantir :

- lisibilité ;
- confort ;
- hiérarchie ;
- lecture rapide.

Les tailles desktop peuvent être augmentées lorsque l'espace disponible le justifie.

---

# 9. Spacing System

Le système d'espacement doit utiliser une échelle cohérente.

Exemple conceptuel :

```text
XS
SM
MD
LG
XL
2XL
3XL
```

L'objectif est d'éviter des valeurs arbitraires comme :

```text
13px ici
17px ailleurs
23px ailleurs
```

Les interfaces doivent utiliser une échelle commune.

---

# 10. Radius System

Les rayons doivent être définis comme tokens.

Exemple :

```text
radius.none
radius.sm
radius.md
radius.lg
radius.full
```

Le choix de leurs valeurs exactes dépendra de la direction artistique finale.

---

# 11. Shadow System

Le système d'ombres doit rester volontairement limité.

Exemple :

```text
shadow.none
shadow.sm
shadow.md
shadow.lg
```

Les composants ne doivent pas multiplier les effets décoratifs sans nécessité fonctionnelle.

---

# 12. Breakpoints

Les breakpoints seront conçus autour de comportements et non de modèles de téléphones précis.

Le système devra notamment gérer :

- petit smartphone ;
- smartphone standard ;
- grand smartphone ;
- tablette ;
- desktop ;
- grand desktop.

Les valeurs définitives seront fixées pendant l'implémentation.

---

# 13. Container System

Les contenus doivent être placés dans des conteneurs adaptés à chaque largeur.

### Mobile

Contenu pleine largeur avec marges latérales.

### Tablette

Largeur limitée lorsque nécessaire pour conserver la lisibilité.

### Desktop

Largeur maximale pour éviter les lignes de contenu excessivement longues.

---

# 14. Grid System

La grille responsive doit permettre :

### Mobile

1 colonne principalement.

### Tablette

2 colonnes lorsque pertinent.

### Desktop

2 à plusieurs colonnes selon le type de contenu.

Le passage d'une grille à l'autre doit être déterminé par le contenu, pas uniquement par la taille de l'écran.

---

# 15. Iconographie

Le système d'icônes devra privilégier :

- cohérence ;
- simplicité ;
- lisibilité ;
- bonne visibilité sur petit écran.

Une seule famille d'icônes principale devra être retenue.

Les icônes ne doivent jamais porter seules une information critique lorsque du texte est nécessaire à la compréhension.

---

# 16. Boutons

## Variantes fonctionnelles

Le système devra prévoir au minimum :

- Primary ;
- Secondary ;
- Tertiary / Ghost ;
- Destructive ;
- Link.

---

## États

Chaque bouton doit gérer :

- default ;
- pressed ;
- hover sur desktop ;
- focus ;
- disabled ;
- loading ;
- success lorsque nécessaire.

---

# 17. Boutons Mobile

Les actions principales doivent être facilement accessibles au toucher.

Les boutons essentiels doivent avoir une surface tactile confortable.

Les actions secondaires doivent rester visuellement moins dominantes.

---

# 18. Inputs

Le système doit prévoir :

- text input ;
- number input ;
- phone input ;
- email input ;
- password input ;
- textarea ;
- search ;
- date ;
- amount / currency.

Chaque champ doit avoir :

- label ;
- placeholder éventuel ;
- aide éventuelle ;
- état de validation ;
- message d'erreur ;
- état disabled ;
- état loading si nécessaire.

---

# 19. Sélecteurs

Composants nécessaires :

- Select ;
- Combobox ;
- Searchable Select ;
- Date Picker ;
- Month Picker ;
- Property Selector ;
- Apartment Selector ;
- Tenant Selector.

Sur mobile, les sélecteurs complexes privilégieront les :

- bottom sheets ;
- vues plein écran ;
- recherches intégrées.

---

# 20. Checkbox / Radio / Switch

Les composants doivent être utilisés selon leur intention.

### Checkbox

Sélections multiples.

### Radio

Choix unique.

### Switch

Activation / désactivation d'une fonctionnalité.

Le produit ne doit pas mélanger ces conventions.

---

# 21. Cards

Les cards doivent principalement servir à regrouper une information.

Composants prévus :

- PropertyCard ;
- ApartmentCard ;
- TenantCard ;
- PaymentCard ;
- IncidentCard ;
- ChargeCard ;
- ExpenseCard.

---

# 22. Status Badges

Les statuts doivent être cohérents dans toute la plateforme.

Exemples :

### Paiement

```text
En attente
Confirmé
Échoué
Annulé
```

### Loyer

```text
À payer
Partiellement payé
Payé
En retard
```

### Incident

```text
Nouveau
À traiter
En cours
En attente
Résolu
Clôturé
```

Les badges doivent être compréhensibles même sans se baser uniquement sur la couleur.

---

# 23. Tables

Les tables sont principalement destinées au desktop.

Sur mobile, elles doivent généralement être transformées en :

- cartes ;
- listes ;
- blocs de données ;
- vues détaillées.

Aucune table critique ne doit imposer un défilement horizontal permanent sur smartphone lorsque son contenu peut être restructuré.

---

# 24. Lists

Les listes sont un composant fondamental du produit.

Une ligne de liste doit généralement contenir :

- identité ;
- information principale ;
- statut ;
- information secondaire ;
- action éventuelle.

Sur mobile, la ligne doit pouvoir devenir une carte compacte.

---

# 25. Bottom Navigation

La navigation principale mobile peut utiliser une bottom navigation.

Elle doit rester limitée à quelques destinations prioritaires.

Le nombre exact dépendra du rôle.

Exemple gestionnaire :

```text
Accueil
Immeubles
Loyers
Maintenance
Profil
```

---

# 26. Side Navigation

La navigation latérale est principalement destinée au desktop.

Elle peut présenter davantage de sections simultanément.

Elle ne doit pas introduire une nouvelle logique métier.

---

# 27. Header

Le header doit pouvoir contenir :

- titre ;
- contexte ;
- retour ;
- notification ;
- profil ;
- sélecteur d'immeuble lorsque nécessaire.

Sur mobile, il doit être compact.

---

# 28. Context Header

Lorsqu'un utilisateur consulte un immeuble ou appartement, le contexte doit être immédiatement identifiable.

Exemple :

```text
Résidence Camayenne
Appartement A04
```

Le contexte peut être accompagné d'une action de retour.

---

# 29. Search

Le composant de recherche doit prévoir :

- état initial ;
- focus ;
- saisie ;
- résultats ;
- aucun résultat ;
- erreur ;
- effacement.

Sur mobile, la recherche peut devenir une vue dédiée lorsque le volume de résultats est important.

---

# 30. Filter System

Le système de filtres doit fonctionner avec :

- FilterButton ;
- FilterChip ;
- FilterPanel ;
- FilterBottomSheet.

Les filtres actifs doivent être visibles.

Une action :

**Réinitialiser**

doit être disponible lorsqu'un filtre est actif.

---

# 31. Modales

Les modales sont destinées principalement aux :

- confirmations ;
- petits formulaires ;
- informations courtes.

Sur mobile, une modale complexe doit généralement devenir une :

**Bottom Sheet**

ou une :

**Full Screen Sheet**

---

# 32. Bottom Sheets

Les bottom sheets seront particulièrement utiles pour :

- sélection d'un immeuble ;
- sélection d'un locataire ;
- choix d'un moyen de paiement ;
- filtres ;
- actions secondaires.

Elles doivent être conçues pour le tactile.

---

# 33. Toasts

Les toasts sont adaptés aux feedbacks simples.

Exemples :

> Paiement enregistré.

> Invitation envoyée.

Ils ne doivent pas être utilisés pour afficher une information critique qui nécessite une lecture prolongée.

---

# 34. Alerts

Les alerts servent aux situations nécessitant une attention particulière.

Exemples :

- paiement échoué ;
- connexion interrompue ;
- invitation expirée ;
- accès révoqué.

---

# 35. Confirmation Dialog

Le système doit disposer d'un composant standard pour les actions sensibles.

Structure :

```text
Titre
Explication
Conséquence
Action secondaire
Action principale
```

---

# 36. Empty States

Chaque module doit disposer d'un état vide adapté.

Un empty state doit comporter :

- titre ;
- explication ;
- action éventuelle.

---

# 37. Loading States

Le Design System doit prévoir :

- skeleton ;
- spinner ;
- button loading ;
- inline loading ;
- page loading.

Le loading doit être adapté à la situation.

---

# 38. Error States

Prévoir :

- validation error ;
- network error ;
- permission error ;
- payment error ;
- server error ;
- expired session.

Le système doit proposer une action de récupération lorsque possible.

---

# 39. Success States

Prévoir des patterns cohérents pour :

- création ;
- paiement ;
- invitation ;
- publication ;
- résolution d'incident.

---

# 40. Form Patterns

Le système doit proposer plusieurs patterns :

### Formulaire simple

Quelques champs.

### Formulaire en étapes

Processus plus long.

### Formulaire contextuel

Ouvert depuis un appartement ou locataire.

### Quick Add

Ajout rapide avec minimum d'informations.

### Full Detail

Configuration complète.

---

# 41. Quick Actions

Composant destiné aux actions fréquentes.

Exemples :

```text
+ Locataire
+ Paiement
+ Charge
+ Incident
+ Dépense
```

Les actions proposées dépendent du rôle et du contexte.

---

# 42. Currency Display

Les montants doivent avoir un composant cohérent.

Exemple :

**2 500 000 GNF**

Le système doit gérer :

- montant ;
- devise ;
- éventuellement variation ;
- éventuel montant restant.

---

# 43. Financial Summary

Composant destiné aux résumés financiers.

Exemple :

```text
Attendu
30 000 000 GNF

Encaissé
27 500 000 GNF

Restant
2 500 000 GNF
```

Il doit rester facilement lisible sur mobile.

---

# 44. Timeline

Composant utilisé pour :

- incidents ;
- interventions ;
- activité ;
- historique.

Exemple :

```text
08 sept.
Incident déclaré

09 sept.
Intervention assignée

09 sept.
Intervention terminée
```

---

# 45. Activity Item

Un élément d'activité doit présenter :

- action ;
- utilisateur ou système ;
- objet ;
- date ;
- éventuellement montant.

---

# 46. Notification Item

Structure :

```text
Titre
Résumé
Date
Objet concerné
```

L'élément doit être cliquable lorsqu'une destination existe.

---

# 47. Avatar et profil

Le système doit pouvoir afficher :

- initiales ;
- image si disponible ;
- statut lorsque pertinent.

Les avatars ne doivent pas être nécessaires à la compréhension de l'interface.

---

# 48. Documents

Composants :

- FileItem ;
- FilePreview ;
- AttachmentPicker ;
- DocumentList.

Sur mobile :

- téléchargement facile ;
- aperçu ;
- capture ou ajout depuis appareil photo lorsque pertinent.

---

# 49. Media Upload

Pour les incidents notamment :

```text
Prendre une photo
Choisir depuis la galerie
```

Le système doit afficher :

- miniature ;
- progression ;
- succès ;
- erreur ;
- possibilité de retirer.

---

# 50. Responsive behavior des composants

Chaque composant doit définir son comportement :

```text
Mobile
↓
Tablet
↓
Desktop
```

Exemple :

### PaymentList

Mobile :

**Card**

Tablet :

**Compact list**

Desktop :

**Table**

---

# 51. Touch Targets

Tous les éléments interactifs doivent être pensés pour une utilisation tactile.

Les contrôles principaux ne doivent pas être trop petits.

Les éléments rapprochés doivent être suffisamment espacés pour éviter les erreurs.

---

# 52. Focus et clavier

Le système doit être utilisable avec :

- écran tactile ;
- clavier ;
- souris ;
- technologies d'assistance lorsque pertinentes.

Les états de focus doivent être clairement visibles.

---

# 53. Accessibility

Le Design System doit respecter au minimum les principes d'accessibilité courants :

- contraste ;
- focus ;
- taille de texte ;
- labels ;
- navigation clavier ;
- alternatives textuelles ;
- distinction des états autrement que par la couleur.

Les exigences précises seront définies pendant l'implémentation.

---

# 54. Dark Mode

Le support du mode sombre est **hors périmètre MVP**.

Si le produit l'intègre plus tard, tous les composants devront utiliser les Design Tokens afin de faciliter cette évolution.

---

# 55. Motion

Les animations doivent servir :

- feedback ;
- transition ;
- compréhension ;
- continuité.

Elles ne doivent pas ralentir les opérations.

Sur mobile, les animations doivent rester légères.

---

# 56. Responsive Patterns

Le système doit prévoir des transformations structurelles.

### Card → List

Sur écran plus large.

### Bottom Sheet → Modal / Panel

Selon la largeur.

### Bottom Navigation → Side Navigation

Lorsque l'espace le permet.

### Stacked Form → Multi-column Form

Sur desktop uniquement lorsque cela améliore réellement la saisie.

---

# 57. Component naming

Les composants devront utiliser une nomenclature cohérente.

Exemple :

```text
Button
Input
Select
Modal
BottomSheet
Badge
Card
Avatar
Tabs
Table
List
Timeline
Toast
Alert
```

Puis des composants métier :

```text
PropertyCard
ApartmentCard
TenantCard
LeaseCard
PaymentCard
ChargeCard
IncidentCard
ExpenseCard
```

---

# 58. Composition

Les composants métier doivent être construits à partir des primitives du Design System autant que possible.

Exemple :

```text
TenantCard
├── Avatar
├── Text
├── StatusBadge
├── Currency
└── Button
```

Cela permet une cohérence forte et facilite les évolutions.

---

# 59. Tokens dans le code

Les valeurs visuelles doivent être centralisées.

Éviter :

```css
margin: 17px;
color: #123456;
border-radius: 13px;
```

dans des composants isolés.

Préférer :

```text
spacing.md
color.text.primary
radius.md
```

ou leur équivalent dans la technologie retenue.

---

# 60. Variants

Les composants doivent utiliser des variants définis.

Exemple :

```text
Button
├── primary
├── secondary
├── tertiary
└── destructive
```

et non des styles spécifiques créés écran par écran.

---

# 61. États composants

Chaque composant interactif doit prévoir :

```text
Default
Hover
Pressed
Focus
Disabled
Loading
Error
Success
```

Les états réellement pertinents dépendront du composant.

---

# 62. Design-to-code

Le système UI doit être conçu de manière à pouvoir être traduit directement en composants frontend.

La conception doit donc favoriser :

- réutilisation ;
- variants ;
- tokens ;
- responsive behavior ;
- états ;
- nomenclature stable.

---

# 63. Relation avec Claude Code

Claude Code ne doit pas avoir à deviner :

- quelles couleurs utiliser ;
- quel espacement utiliser ;
- quel composant choisir ;
- comment un composant se comporte sur mobile ;
- quelle variante correspond à une action.

Le Design System deviendra donc progressivement une spécification directement exploitable pour l'implémentation.

---

# 64. Ce qui reste à définir

> La direction visuelle est **VALIDÉE** (DEC-012). Cette section ne liste plus que les points réellement ouverts.

## Déjà arrêté — ne plus rouvrir

```text
Identité visuelle      « Property Infrastructure »
Palette                voir section 2.1
Couleurs de statut     voir section 2.2
Typographie            Manrope + Inter
Iconographie           Lucide
Touch target           44 × 44 px
Mobile first           obligatoire
```

## Encore à produire

### Éléments graphiques de marque

Le nom est arrêté : **SIMANDOU IMMO** (DEC-031).

Restent à créer, sans nouvelle décision produit :

- logo ;
- monogramme ;
- favicon.

Ces éléments **ne bloquent pas** l'implémentation des composants.

### Valeurs numériques de détail

À fixer lors de l'implémentation des tokens, sans nouvelle décision produit :

- échelle typographique exacte ;
- valeurs de radius par niveau ;
- valeurs d'élévation ;
- durées de transition.

Ces valeurs doivent être choisies une seule fois, exposées comme tokens, puis appliquées partout.

---

# 65. Critères de validation du Design System

Le système devra permettre de construire les interfaces sans créer constamment de nouveaux styles.

Un écran doit pouvoir être assemblé majoritairement à partir de composants existants.

Le système est considéré comme suffisamment mature lorsque :

- les patterns sont réutilisables ;
- les composants ont des états définis ;
- le responsive est documenté ;
- le mobile est le point de départ ;
- les comportements sont cohérents ;
- les tokens sont centralisés ;
- l'implémentation frontend peut reprendre directement les conventions établies.

---

# 66. Résumé

Le Design System doit créer une continuité entre :

```text
UX
↓
UI
↓
Composants
↓
Code
```

Il doit également garantir :

```text
Mobile First
↓
Responsive
↓
Accessible
↓
Cohérent
↓
Réutilisable
```

La charte visuelle finale sera définie conjointement et viendra compléter ce socle.

Le principe directeur reste :

> **Une interface simple à utiliser, cohérente sur tous les écrans et suffisamment structurée pour être implémentée directement dans le produit.**