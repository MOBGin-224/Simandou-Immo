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

> **VALIDÉE : DEC-012. COMPLÉTÉE par la charte officielle : DEC-052.**
>
> La direction visuelle **« Property Infrastructure »** est arrêtée. Elle ne constitue plus une décision ouverte.
>
> **La source de vérité visuelle est désormais la charte graphique officielle**, version 2.0 d'octobre 2026 : `Identité visuelle/SIMANDOU IMMO - Charte complète.pdf`. Cette section n'en est qu'un résumé d'orientation ; en cas d'écart, **la charte fait foi**.
>
> Rien n'est rouvert : ce document laissait explicitement les rayons, les ombres, l'échelle d'espacement et les tailles typographiques à l'état d'« exemple conceptuel », et annonçait le logo, le monogramme et le favicon comme « restant à produire ». La charte fournit ces valeurs et ces fichiers.

## 2.1 Palette validée

Quatre couleurs de marque et un blanc. **Le Bright Blue et le Structural Blue sont des ACCENTS**, pas la base de l'interface.

| Charte | Token du code | Valeur | Usage |
|---|---|---|---|
| Deep Navy | `brand` | `#123B4A` | Identité, navigation, titres forts, structure |
| Digital Teal | `action` | `#138A8A` | Interaction : actions, liens importants |
| Teal profond | `action-strong` | `#0F7373` | Le même rôle, pour le PETIT texte |
| Bright Blue | `accent` | `#3B8DFF` | Symbole, anneau de focus, CTA de marque |
| Structural Blue | `accent-deep` | `#2A67B1` | États informatifs, 3e série de données |
| Teal secondaire | `teal-secondary` | `#2B9A8F` | **Réservé** aux états et aux visualisations à deux teals |
| White | `surface` | `#FFFFFF` | Surfaces, fonds, texte sur navy |

**Hiérarchie, et c'est une règle** : navy, puis les neutres, puis le teal, puis le bleu, puis les fonctionnelles.

**Pourquoi deux teals.** La charte mesure le teal `#138A8A` à 4,2:1 sur blanc, ce qui ne passe le seuil AA que pour le grand texte, et le dit : « le Bright Blue et le teal ne servent pas de texte courant sur fond clair ». Le Teal profond `#0F7373`, à 5,6:1, porte donc tout le petit texte interactif et le fond des boutons primaires.

**Le dégradé officiel** `#3B8DFF → #138A8A`, de haut gauche vers bas droite, est **réservé aux éléments de marque** : symbole, icône d'application, couvertures. Jamais un composant d'interface.

## 2.2 Neutres

| Charte | Token | Valeur |
|---|---|---|
| Background | `canvas` | `#F7F9F8` |
| Surface subtle | `surface-subtle` | `#EEF2F1` |
| Border | `line` | `#DCE4E5` |
| Border strong | `line-strong` | `#CBD5D7` |
| Gray 400 | `gray-400` | `#9AA9AE` |
| Muted | `muted` | `#66747A` |
| Gray 700 / 800 / 900 | `gray-700` / `gray-800` / `gray-900` | `#4A5A60` / `#34444A` / `#243238` |
| Ink | `ink` | `#172126` |

## 2.3 États fonctionnels validés

Chaque couleur va avec **son fond**, qui est une valeur du document et non une opacité : c'est sur ces couples que les contrastes sont mesurés.

| Token | Couleur | Fond | Contraste | Signification métier |
|---|---|---|---|---|
| `success` | `#18794E` | `#E8F5EE` | 4,8:1 | Payé, résolu, confirmé |
| `warning` | `#A15C00` | `#FFF4DE` | 4,8:1 | En attente, à traiter |
| `danger` | `#B42318` | `#FDECEA` | 5,7:1 | En retard, échec, critique |
| `info` | `#1769AA` | `#E8F2FA` | 5,1:1 | Information neutre |

## 2.4 Typographie validée

| Famille | Usage |
|---|---|
| **Manrope** | Identité, logotype, titres, **grands nombres**, hero |
| **Inter** | Corps, formulaires, boutons, **tableaux**, **données**, navigation |

**Correction par rapport à la version antérieure de ce document**, qui plaçait tous les montants en Manrope : la charte répartit les deux familles sur la TAILLE et le RÔLE, non sur la nature financière de la donnée. Un chiffre clé de tableau de bord est un grand nombre, donc Manrope ; un loyer dans une colonne est une donnée, donc Inter. Le composant `Amount` porte ce choix, par son `scale`.

Neuf niveaux, taille sur interligne :

```text
Manrope   Display 48/56   H1 36/44   H2 30/38   H3 24/32   H4 20/28
Inter     Body large 18/28   Body 16/24   Small 14/20   Caption 12/16
```

Règles d'usage : longueur de ligne de 60 à 75 caractères, alignement à gauche jamais justifié, **chiffres tabulaires pour les données et les montants**, surtitres en capitales avec un interlettrage de **+16 %**, corps à 16 px et jamais sous 12 px.

## 2.5 Grille, formes et mouvement

```text
Module         4 px. Echelle 4 8 12 16 20 24 28 32 40 48 64 80
Mobile         360 / 390 : 4 colonnes, marge 16 px, gouttiere 16 px
Tablette       768 : 8 colonnes, marge 32 px
Desktop        1280 : 12 colonnes, contenu 1200 px au maximum

Rayons         8 px controles, 12 px cartes, 16 px feuilles, pill badges
Bordures       1 px par defaut, 2 px au focus, toujours visible
Elevation      surface, bordure, ombre discrete, superposition

Mouvement      120 ms micro, 180 ms standard, 250 ms important
Courbes        entree cubic-bezier(.2 0 0 1), sortie cubic-bezier(.4 0 1 1)
Limites        opacite, translation <= 8 px, echelle <= 1,02
```

Le mouvement est **réduit ou supprimé** si l'utilisateur le demande.

## 2.6 Autres décisions validées

```text
Icônes                 style Lucide, grille 24, trait 2 px, couleur heritee du texte
Touch target minimum   44 px de hauteur pour tout element interactif
Focus                  anneau de 2 px en Bright Blue, avec 2 px de vide
Mobile first           obligatoire, conception d'abord a 360 et 390 px
Action principale      une seule par ecran
```

## 2.7 Marque

Le nom du produit est **SIMANDOU IMMO** (DEC-031, VERROUILLÉE). Le logotype s'écrit **toujours en capitales**.

SIMANDOU IMMO est un produit **distinct de SIMANDOU SEJOUR**.

Les fichiers officiels vivent dans `Identité visuelle/` et ne se redessinent pas :

```text
symbole           trois volumes, une inclinaison proche de 25 degres
boite             127,5 x 130,8, environ 1 : 1
zone de protection  un quart de la hauteur du symbole, sur les quatre cotes
minimum           120 px logo complet, 24 px symbole seul
fond clair        volumes navy et Bright Blue, IMMO en Structural Blue
fond navy         volumes blancs et Bright Blue, IMMO en Bright Blue
```

Dix usages sont interdits : déformer, étirer, changer les couleurs, ombre lourde, contour, rotation, fond insuffisamment contrasté, autre typographie, dégradés concurrents, effets 3D ou métalliques.

**Le symbole est porté par le composant `BrandMark`**, qui recopie la géométrie du fichier officiel. Les couleurs du logo y sont écrites en dur, et c'est la seule exception à la règle 2.8 : la charte interdit d'en changer les couleurs, donc elles ne doivent pas suivre un token qu'un thème pourrait redéfinir.

## 2.8 Règle d'implémentation

Toute valeur visuelle ci-dessus doit être exposée comme **design token** et jamais recopiée en dur dans un composant.

La couleur ne doit jamais être le seul porteur d'une information. Un statut associe **toujours** une couleur, un point et un libellé.

`tests/ui/charter.test.ts` confronte les tokens du code aux valeurs de la charte, et la géométrie du symbole au fichier officiel : une dérive échoue en test plutôt que de passer inaperçue.

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

## Déjà arrêté, ne plus rouvrir

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