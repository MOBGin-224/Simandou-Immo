# Accessibility Specification

## 1. Objet du document

Ce document définit les exigences d'accessibilité du SaaS de gestion d'immeubles.

L'objectif est que les fonctionnalités essentielles puissent être utilisées par des personnes ayant des capacités, appareils ou conditions d'utilisation différentes.

L'accessibilité concerne notamment :

- smartphone ;
- tablette ;
- desktop ;
- clavier ;
- lecteur d'écran ;
- taille de texte ;
- contraste ;
- formulaires ;
- navigation ;
- notifications ;
- messages d'erreur ;
- états de chargement ;
- documents ;
- interactions tactiles.

L'accessibilité est une exigence de qualité du produit et non une fonctionnalité ajoutée à la fin.

---

# 2. Principes fondamentaux

## A11Y-001 : Accessible par défaut

Les nouveaux composants doivent être construits accessibles dès leur création.

---

## A11Y-002 : Mobile First

L'accessibilité doit être vérifiée d'abord sur smartphone.

```text id="6h3dc4"
Smartphone
↓
Tablet
↓
Desktop
```

---

## A11Y-003 : Compréhensible sans couleur seule

Une information ne doit jamais dépendre uniquement de la couleur.

Exemple incorrect :

```text id="d6y5m7"
Vert = payé
Rouge = impayé
```

Préférer :

```text id="a0nq6t"
✓ Payé
! En retard
```

avec couleur en complément.

---

## A11Y-004 : Les erreurs doivent être compréhensibles

Un utilisateur doit comprendre :

- ce qui est incorrect ;
- où se trouve le problème ;
- comment le corriger lorsque possible.

---

## A11Y-005 : Toute action critique doit avoir un retour

Lorsqu'un utilisateur :

- paie ;
- enregistre ;
- publie ;
- supprime ;
- révoque ;
- envoie ;

le système doit fournir un feedback clair.

---

# 3. MVP

# 3.1 Standards de référence

Le produit doit viser une conformité raisonnable avec les bonnes pratiques modernes d'accessibilité web, notamment les principes WCAG.

Le niveau exact de conformité formel n'est pas considéré comme une certification du produit pour le MVP.

---

# 4. Structure sémantique

## MVP-A11Y-001

Utiliser les éléments HTML sémantiques appropriés :

- `header` ;
- `nav` ;
- `main` ;
- `section` ;
- `article` ;
- `button` ;
- `form` ;
- `label`.

Éviter de transformer arbitrairement des `div` en contrôles interactifs.

---

# 5. Boutons

## MVP-A11Y-002

Tout bouton doit :

- avoir un nom compréhensible ;
- être identifiable ;
- indiquer son état lorsque nécessaire ;
- être utilisable au clavier sur desktop ;
- être utilisable au toucher sur mobile.

---

# 6. Liens

## MVP-A11Y-003

Les liens doivent décrire leur destination.

Éviter :

> Cliquez ici

lorsque la destination peut être explicitée.

Préférer :

> Voir la quittance

---

# 7. Icônes

## MVP-A11Y-004

Une icône seule ne doit pas être utilisée comme seule indication lorsqu'elle est ambiguë.

Exemple :

```text id="h6x1n8"
[icône]
```

doit avoir un nom accessible lorsque nécessaire.

---

# 8. Boutons iconiques

Les boutons contenant uniquement une icône doivent posséder :

- `aria-label` adapté lorsque nécessaire ;
- état accessible ;
- feedback visuel.

Exemples :

```text id="g2d2vp"
Modifier
Supprimer
Fermer
Rechercher
Filtrer
```

---

# 9. Navigation

## MVP-A11Y-005

L'utilisateur doit pouvoir comprendre :

- où il se trouve ;
- comment revenir ;
- quel espace il utilise ;
- quel contexte immobilier est sélectionné.

---

# 10. Navigation mobile

La navigation mobile doit :

- rester identifiable ;
- fournir une indication de l'élément actif ;
- conserver les actions principales accessibles ;
- éviter une dépendance exclusive aux gestes.

---

# 11. Navigation clavier

## MVP-A11Y-006

Sur desktop, les parcours principaux doivent pouvoir être accomplis au clavier.

Tester notamment :

- login ;
- création d'immeuble ;
- création de locataire ;
- paiement ;
- déclaration d'incident ;
- recherche.

---

# 12. Focus

## MVP-A11Y-007

Le focus clavier doit être :

- visible ;
- suffisamment contrasté ;
- cohérent.

Ne pas supprimer le focus sans alternative accessible.

---

# 13. Ordre du focus

## MVP-A11Y-008

L'ordre de navigation au clavier doit suivre l'ordre logique de lecture et d'interaction.

Éviter les parcours de type :

```text id="ch8vjp"
Champ 1
↓
Champ 5
↓
Bouton
↓
Champ 2
```

---

# 14. Formulaires

## MVP-A11Y-009

Chaque champ important doit avoir un label.

Exemple :

```text id="0nbfxv"
Nom du locataire
[________________]
```

et non uniquement :

```text id="w9q6z7"
[Nom]
```

---

# 15. Placeholder

## MVP-A11Y-010

Le placeholder ne doit pas remplacer le label.

Le placeholder sert éventuellement de guide supplémentaire.

---

# 16. Champs obligatoires

## MVP-A11Y-011

L'interface doit indiquer clairement les champs obligatoires.

La validation serveur reste obligatoire.

---

# 17. Messages d'erreur

## MVP-A11Y-012

Lorsqu'un formulaire échoue :

- identifier le champ ;
- fournir une explication ;
- conserver les autres valeurs correctement saisies lorsque possible.

Exemple :

> Le montant doit être supérieur à 0.

---

# 18. Erreur globale

## MVP-A11Y-013

Lorsqu'une erreur concerne le formulaire entier, l'interface doit fournir un message clairement visible et compréhensible.

---

# 19. Focus après erreur

Après une erreur critique de formulaire, le focus peut être déplacé vers :

- le premier champ invalide ;
- ou le message principal d'erreur ;

selon le contexte.

---

# 20. Formulaires financiers

Les formulaires de :

- paiement ;
- charge ;
- dépense ;

doivent être particulièrement explicites.

Exemple :

```text id="e0bkl3"
Montant
2 500 000 GNF
```

L'utilisateur ne doit pas devoir deviner l'unité monétaire.

---

# 21. Montants

## MVP-A11Y-014

Les montants doivent être présentés de façon lisible.

Exemple :

```text id="8u9s50"
2 500 000 GNF
```

Éviter un affichage ambigu comme :

```text id="gq6d8n"
2500000
```

lorsque le contexte monétaire n'est pas évident.

---

# 22. Statuts

## MVP-A11Y-015

Les statuts importants doivent être exprimés avec :

- texte ;
- éventuellement icône ;
- éventuellement couleur.

Exemples :

```text id="wqtg2y"
✓ Payé
◷ En attente
! En retard
```

---

# 23. Contraste

## MVP-A11Y-016

Le texte et les contrôles importants doivent présenter un contraste suffisant avec leur arrière-plan.

Les couleurs finales sont définies par le Design System et la charte graphique.

---

# 24. Taille du texte

## MVP-A11Y-017

Le système doit permettre une lecture confortable sur smartphone.

Éviter le recours généralisé à des tailles de texte trop petites.

---

# 25. Agrandissement

## MVP-A11Y-018

L'interface ne doit pas devenir inutilisable lorsqu'un utilisateur augmente la taille du texte ou utilise le zoom du navigateur lorsque ce comportement est applicable.

---

# 26. Responsive

## MVP-A11Y-019

L'accessibilité doit être conservée lors du passage :

```text id="9nz0vp"
Mobile
→
Tablet
→
Desktop
```

Un composant accessible sur desktop mais inutilisable sur smartphone n'est pas considéré comme correctement implémenté.

---

# 27. Touch Targets

## MVP-A11Y-020

Les éléments tactiles doivent disposer d'une zone d'interaction suffisamment grande et espacée.

Éviter :

```text id="xgzmjq"
petites icônes côte à côte
```

lorsqu'elles créent un risque d'erreur.

---

# 28. Gestes

## MVP-A11Y-021

Une action essentielle ne doit pas dépendre uniquement :

- d'un swipe ;
- d'un geste complexe ;
- d'une interaction multi-doigts.

Une alternative explicite doit être disponible.

---

# 29. Modales

## MVP-A11Y-022

Une modal doit :

- avoir un titre ou un nom accessible ;
- déplacer le focus de façon appropriée ;
- permettre la fermeture ;
- rendre le retour au contexte logique après fermeture.

---

# 30. Bottom Sheets

## MVP-A11Y-023

Les Bottom Sheets mobile doivent être utilisables comme de vrais contrôles d'interface et non comme de simples éléments visuels.

---

# 31. Confirmation dangereuse

Les actions telles que :

- révoquer un gestionnaire ;
- archiver un immeuble ;
- annuler une opération ;

doivent demander une confirmation compréhensible lorsque le risque le justifie.

---

# 32. Confirmation de paiement

## MVP-A11Y-024

Avant une opération financière importante, présenter clairement :

```text id="zc2g5l"
Ce que vous payez
Montant
Moyen de paiement
Action à confirmer
```

---

# 33. États de chargement

## MVP-A11Y-025

Un chargement doit être identifiable.

Éviter un écran qui semble simplement bloqué.

---

# 34. Loading State

Un état de chargement doit pouvoir être compris sans dépendre uniquement d'une animation.

Exemple :

> Chargement des paiements...

---

# 35. États vides

## MVP-A11Y-026

Un écran vide doit expliquer :

- pourquoi il est vide ;
- ce que l'utilisateur peut faire ensuite.

Exemple :

> Aucun locataire pour cet immeuble. Ajoutez votre premier locataire.

---

# 36. États d'erreur

## MVP-A11Y-027

Un message d'erreur doit être :

- visible ;
- compréhensible ;
- utile ;
- non technique.

Éviter :

> Error 500

comme seul message visible.

---

# 37. Toasts

## MVP-A11Y-028

Les notifications temporaires ne doivent pas être le seul moyen de transmettre une information critique.

Exemple :

Après un paiement, le statut doit également apparaître dans le contexte du paiement.

---

# 38. Notifications critiques

Les changements importants doivent pouvoir être retrouvés après disparition d'une notification temporaire.

---

# 39. Lecteurs d'écran

## MVP-A11Y-029

Tester les principaux parcours avec au moins une technologie de lecture d'écran prise en charge par les environnements ciblés.

L'objectif du MVP est de vérifier notamment :

- lecture des titres ;
- labels ;
- boutons ;
- statuts ;
- formulaires ;
- erreurs.

---

# 40. Titres

## MVP-A11Y-030

Les pages doivent avoir une hiérarchie de titres cohérente.

Exemple :

```text id="4wlq8u"
Page
├── Section
│   ├── Sous-section
│   └── Sous-section
```

---

# 41. Titre de page

Chaque écran principal doit avoir un titre identifiable.

Exemples :

```text id="6d0mso"
Tableau de bord
Mes locataires
Paiements
Maintenance
```

---

# 42. Textes masqués

Les informations masquées visuellement mais nécessaires à l'accessibilité doivent utiliser les mécanismes appropriés.

Éviter les hacks CSS incohérents.

---

# 43. Images

## MVP-A11Y-031

Les images importantes doivent avoir une alternative textuelle lorsque nécessaire.

Les images purement décoratives doivent être traitées comme telles.

---

# 44. Photos d'incident

Une photo ajoutée à un incident doit disposer d'un contexte accessible.

Exemple :

```text id="1p1u4n"
Photo de la fuite d'eau dans la salle de bain
```

lorsque la description est connue.

---

# 45. Icônes décoratives

Les icônes purement décoratives ne doivent pas être annoncées inutilement par les lecteurs d'écran.

---

# 46. Tableaux

## MVP-A11Y-032

Les tableaux financiers ou de gestion doivent être correctement structurés.

Sur mobile, lorsqu'un tableau devient trop large, il peut être transformé en :

- cartes ;
- listes ;
- fiches ;
- sections.

---

# 47. Tableau de paiements

L'utilisateur doit pouvoir comprendre les colonnes ou attributs importants :

- période ;
- montant ;
- statut ;
- date.

---

# 48. Liste mobile

Une liste mobile doit conserver suffisamment de contexte pour identifier chaque élément.

---

# 49. Search

## MVP-A11Y-033

La recherche doit avoir :

- un label ;
- un bouton clair lorsque nécessaire ;
- un état de chargement ;
- un message si aucun résultat.

---

# 50. Filtres

## MVP-A11Y-034

Les filtres doivent être compréhensibles et pouvoir être :

- ouverts ;
- sélectionnés ;
- supprimés ;
- réinitialisés.

---

# 51. Date Picker

## MVP-A11Y-035

Les sélecteurs de date doivent offrir un moyen clair de choisir une date sans dépendre uniquement d'un calendrier visuel complexe.

---

# 52. File Upload

## MVP-A11Y-036

L'upload doit pouvoir être effectué via :

- sélection de fichier ;
- appareil photo sur mobile lorsque disponible.

L'utilisateur doit comprendre :

- ce qui peut être envoyé ;
- les limites ;
- le résultat de l'upload ;
- les erreurs.

---

# 53. Upload photo mobile

## MVP-A11Y-037

Lorsqu'une photo est prise :

- l'utilisateur doit comprendre qu'elle a été ajoutée ;
- le système doit indiquer les erreurs ;
- il doit pouvoir retirer ou remplacer la photo lorsque prévu.

---

# 54. Vidéo et contenu animé

Le MVP n'a pas besoin de contenus vidéo ou animations complexes pour les opérations essentielles.

Lorsqu'une animation est utilisée :

- elle ne doit pas être indispensable à la compréhension ;
- elle ne doit pas bloquer l'interaction.

---

# 55. Mouvement réduit

## MVP-A11Y-038

Les animations non essentielles doivent pouvoir respecter les préférences système de réduction des mouvements lorsque cela est pertinent.

---

# 56. PWA Accessibility

## MVP-A11Y-039

L'installation en PWA ne doit pas modifier négativement :

- la navigation ;
- le focus ;
- les intitulés ;
- les interactions ;
- la lecture par lecteur d'écran.

---

# 57. Offline et accessibilité

Si certaines interfaces restent consultables temporairement hors connexion :

- l'état hors ligne doit être explicite ;
- les actions non disponibles doivent être signalées ;
- l'utilisateur ne doit pas croire qu'une opération financière a été confirmée alors qu'elle ne l'est pas.

---

# 58. Accessibilité des permissions

## MVP-A11Y-040

Lorsqu'une action est impossible en raison des permissions, l'interface doit fournir un message compréhensible.

Exemple :

> Vous n'avez pas les droits nécessaires pour modifier cet immeuble.

Ne pas exposer les mécanismes internes de sécurité.

---

# 59. Accessibilité des rôles

Le produit doit utiliser des termes compréhensibles :

```text id="j5h8wq"
Propriétaire
Gestionnaire
Locataire
```

Éviter de montrer au public des termes techniques comme :

```text id="1t9g1t"
RBAC
Scope
Permission
```

sauf dans une interface d'administration prévue pour cela.

---

# 60. Accessibilité des erreurs de paiement

## MVP-A11Y-041

Une erreur de paiement doit clairement indiquer :

- que le paiement n'est pas confirmé ;
- ce que l'utilisateur peut faire ;
- si une vérification est en cours.

Éviter les messages vagues tels que :

> Une erreur est survenue.

---

# 61. Accessibilité des statuts financiers

Les statuts doivent être immédiatement compréhensibles, avec le **libellé UI officiel** (DEC-015, DEC-016) :

Créance — loyer et charge :

```text id="l3b9as"
À payer
Partiellement payé
Payé
En retard
Annulé
```

Paiement :

```text
En attente
Confirmé
Échoué
Annulé
```

Le statut ne doit jamais être porté uniquement par la couleur : un libellé textuel est toujours présent.

Les couleurs de statut validées (DEC-012) doivent respecter les exigences de contraste de la section 23.

---

# 62. Accessibilité des charges

> **DEC-005** — la part de charge est une créance payable, au même titre que le loyer.

Une charge doit afficher séparément :

```text id="kb9dss"
Montant total de la facture
Votre part
Montant déjà payé
Reste à payer
Statut
```

## Total dû composé

Lorsque le locataire consulte son **total à payer**, l'interface doit permettre de comprendre sa composition sans dépendre d'un calcul mental :

```text
Total à payer        2 800 000 GNF
  Loyer septembre    2 500 000 GNF   À payer
  Eau septembre        300 000 GNF   À payer
```

Le total et ses composantes doivent être annoncés de manière cohérente par un lecteur d'écran : le total d'abord, puis le détail comme liste structurée.

---

# 63. Accessibilité des incidents

Le formulaire d'incident doit distinguer clairement :

- description ;
- priorité ;
- photo ;
- logement ;
- envoi.

---

# 64. Accessibilité des dashboards

Les dashboards doivent fournir une hiérarchie claire.

Éviter de présenter uniquement une mosaïque de chiffres sans contexte.

Exemple :

```text id="48s5eq"
12 logements
10 occupés
2 disponibles
3 loyers en retard
```

Les chiffres importants doivent être associés à leur libellé.

---

# 65. Accessibilité des graphiques

Les graphiques ne doivent pas être la seule représentation d'une donnée importante.

Si un graphique est introduit dans le MVP, fournir une alternative textuelle ou tabulaire lorsque nécessaire.

---

# 66. Tests automatisés

## MVP-A11Y-042

Automatiser les contrôles accessibles lorsque les outils retenus le permettent.

Exemples de catégories :

- éléments sans label ;
- contraste problématique ;
- structure ;
- attributs ARIA invalides ;
- boutons inaccessibles.

Les outils automatiques ne remplacent pas les tests humains.

---

# 67. Tests manuels

## MVP-A11Y-043

Tester manuellement :

- clavier ;
- smartphone ;
- zoom ;
- lecteur d'écran ;
- formulaires ;
- erreurs.

---

# 68. Matrice minimale de test

| Surface | Smartphone | Clavier | Lecteur d'écran | Zoom | UAT |
|---|---:|---:|---:|---:|---:|
| Auth | Oui | Oui | Oui | Oui | Oui |
| Dashboard | Oui | Oui | Oui | Oui | Oui |
| Property | Oui | Oui | Oui | Oui | Oui |
| Apartment | Oui | Oui | Oui | Oui | Oui |
| Tenant | Oui | Oui | Oui | Oui | Oui |
| Lease | Oui | Oui | Oui | Oui | Oui |
| Rent | Oui | Oui | Oui | Oui | Oui |
| Payment | Oui | Oui | Oui | Oui | Oui |
| Receipt | Oui | Oui | Oui | Oui | Oui |
| Charge | Oui | Oui | Oui | Oui | Oui |
| Incident | Oui | Oui | Oui | Oui | Oui |
| Intervention | Oui | Oui | Oui | Oui | Oui |

---

# 69. Critères de criticité

## P0

Un problème d'accessibilité qui empêche l'accomplissement d'une fonction métier critique.

Exemples :

- impossible de remplir un formulaire ;
- bouton de paiement inutilisable ;
- navigation impossible ;
- information critique absente.

---

## P1

Forte dégradation mais contournement possible.

---

## P2

Friction importante mais non bloquante.

---

## P3

Amélioration mineure.

---

# 70. UAT Accessibility

Pendant les tests utilisateurs, observer notamment :

- compréhension ;
- lisibilité ;
- facilité de toucher les contrôles ;
- difficulté à lire ;
- difficulté à identifier les statuts ;
- difficulté à comprendre les erreurs.

---

# 71. Future Evolutions

## FUT-A11Y-001 : Audit externe complet

Réaliser un audit d'accessibilité spécialisé.

---

## FUT-A11Y-002 : Support avancé des technologies d'assistance

Étendre les tests à davantage :

- lecteurs d'écran ;
- navigateurs ;
- systèmes d'exploitation ;
- périphériques.

---

## FUT-A11Y-003 : Support vocal avancé

Explorer des interactions vocales ou des fonctions d'assistance supplémentaires.

---

## FUT-A11Y-004 : Accessibilité documentaire avancée

Améliorer l'accessibilité des :

- PDF ;
- documents exportés ;
- rapports ;
- quittances générées.

---

# 72. Architecture Constraints Related to Future Evolutions

## ARCH-A11Y-001

Les composants UI doivent utiliser les composants accessibles du Design System lorsque disponibles.

---

## ARCH-A11Y-002

Les composants doivent pouvoir recevoir des labels et descriptions accessibles sans hacks.

---

## ARCH-A11Y-003

Les états UI doivent être exposables aux technologies d'assistance.

---

## ARCH-A11Y-004

Les composants de formulaire doivent conserver une association stable entre :

```text id="pc5s2v"
Label
+
Input
+
Error
+
Description
```

---

## ARCH-A11Y-005

Les composants interactifs doivent pouvoir supporter les adaptations mobiles et desktop sans perdre leur accessibilité.

---

# 73. Out of Scope

## OUT-A11Y-001

Obtenir une certification externe d'accessibilité avant le lancement du MVP.

---

## OUT-A11Y-002

Supporter toutes les technologies d'assistance existantes.

---

## OUT-A11Y-003

Construire un système vocal complet.

---

## OUT-A11Y-004

Créer des composants accessibles différents pour chaque plateforme avant qu'un besoin réel apparaisse.

---

# 74. Definition of Done Accessibility

Une fonctionnalité frontend critique est considérée comme correctement accessible lorsque :

```text id="47bqgr"
[ ] Mobile first
[ ] Contraste vérifié
[ ] Labels présents
[ ] Focus correct
[ ] Navigation clavier
[ ] États UI accessibles
[ ] Erreurs compréhensibles
[ ] Statuts non dépendants de la couleur
[ ] Touch targets adaptés
[ ] Tests manuels
[ ] Tests automatiques lorsque pertinents
```

---

# 75. Checklist avant production

```text id="sjjhup"
## Structure
[ ] Titres
[ ] Landmarks
[ ] Navigation

## Forms
[ ] Labels
[ ] Required fields
[ ] Error messages
[ ] Focus

## Interaction
[ ] Buttons
[ ] Links
[ ] Modals
[ ] Bottom sheets
[ ] Touch targets

## Content
[ ] Images
[ ] Status
[ ] Financial data
[ ] Tables
[ ] Empty states

## Responsive
[ ] Smartphone
[ ] Tablet
[ ] Desktop

## Assistive Technology
[ ] Keyboard
[ ] Screen reader
[ ] Zoom

## Testing
[ ] Automated checks
[ ] Manual checks
```

---

# 76. Principe final

L'accessibilité du produit repose sur une idée simple :

```text id="v7qtxv"
Comprendre
+
Voir
+
Naviguer
+
Interagir
+
Corriger
```

Un utilisateur doit pouvoir comprendre ce que le système attend de lui et ce que le système vient de faire.

Le principe directeur est :

> **Une interface n'est pas réellement simple si elle n'est simple que pour les utilisateurs qui peuvent l'utiliser exactement comme prévu.**