# Product UX Specification / UX Structure

## 1. Objet du document

Ce document définit la structure d'expérience utilisateur du produit de gestion d'immeubles.

Il transforme les éléments définis dans :

- la Product Vision ;
- le PRD ;
- les User Flows ;
- l'Information Architecture ;
- les Roles & Permissions ;
- le Data Model ;
- les Business Rules ;

en principes UX cohérents.

Il ne constitue pas encore un document de design UI.

Il ne définit pas encore les couleurs, typographies, composants visuels ou maquettes finales.

Il définit plutôt :

- comment l'utilisateur comprend le produit ;
- comment il navigue ;
- comment il trouve une information ;
- comment il réalise une action ;
- comment le système lui répond ;
- comment les différents rôles vivent le même produit ;
- comment la complexité du système est rendue invisible.

---

# 2. Vision UX

L'expérience cible repose sur une idée simple :

> **Le produit doit faire sentir que la gestion est simple, même lorsque le système qui la supporte est complexe.**

L'utilisateur ne doit pas avoir à comprendre :

- la structure de la base de données ;
- les permissions ;
- les relations entre les entités ;
- les règles financières ;
- les mécanismes d'automatisation.

Il doit simplement comprendre :

> **où je suis, ce que je vois, ce qui nécessite mon attention et quelle action je peux effectuer.**

---

# 3. Principe UX directeur

## Complexité invisible

Le produit peut gérer :

- plusieurs immeubles ;
- plusieurs gestionnaires ;
- plusieurs centaines de locataires ;
- des contrats successifs ;
- des charges ;
- des paiements multiples ;
- des historiques ;
- des permissions complexes.

Mais l'interface doit présenter cette complexité sous une forme simple.

Exemple :

Le système peut calculer automatiquement plusieurs règles financières.

L'utilisateur voit simplement :

> **À payer : 2 800 000 GNF**

avec la possibilité d'ouvrir le détail.

---

# 4. Les trois expériences

Le produit n'est pas une seule interface identique pour tous.

Il doit proposer trois expériences adaptées.

## Propriétaire

Mental model :

> **Mon patrimoine**

Il cherche principalement :

- une vision globale ;
- du contrôle ;
- des chiffres ;
- des alertes ;
- un historique ;
- la supervision.

---

## Gestionnaire

Mental model :

> **Ce que j'ai à gérer**

Il cherche principalement :

- des tâches ;
- des impayés ;
- des locataires ;
- des incidents ;
- des paiements ;
- des opérations rapides.

---

## Locataire

Mental model :

> **Mon logement et ce que j'ai à faire**

Il cherche principalement :

- ce qu'il doit ;
- quand il doit le payer ;
- ses paiements ;
- ses reçus ;
- ses incidents.

---

# 5. Règle UX numéro 1 : le contexte doit toujours être visible

À chaque instant, l'utilisateur doit comprendre :

1. dans quel espace il se trouve ;
2. quel immeuble il consulte ;
3. quel appartement il consulte ;
4. quel utilisateur est concerné ;
5. quelle période est concernée lorsque nécessaire.

Exemple :

```text id="6fzi5q"
Résidence Camayenne
→ Appartement A04
→ Mamadou Diallo
→ Loyer septembre 2026
```

Cela évite les erreurs de manipulation.

---

# 6. Règle UX numéro 2 : une action principale par contexte

Chaque écran ou vue doit avoir une action principale.

Exemples :

Dans un immeuble :

> **Ajouter un appartement**

Dans un appartement :

> **Ajouter un locataire**

Dans les impayés :

> **Relancer**

Dans un incident :

> **Traiter l'incident**

Dans une charge :

> **Publier la répartition**

Les actions secondaires restent accessibles mais visuellement moins dominantes.

---

# 7. Règle UX numéro 3 : progressive disclosure

Le produit ne doit pas tout montrer immédiatement.

Il doit montrer :

### Niveau 1

L'information essentielle.

### Niveau 2

Le détail utile.

### Niveau 3

Les informations avancées.

Exemple :

Le dashboard affiche :

> **2 500 000 GNF à payer**

L'utilisateur ouvre :

> Loyer : 2 500 000 GNF

Puis :

> Contrat  
> Échéance  
> Historique  
> Détails du calcul

Cette méthode permet de conserver une interface simple sans sacrifier la puissance du système.

---

# 8. Règle UX numéro 4 : les listes doivent être orientées action

Une liste ne doit pas seulement afficher des données.

Elle doit permettre d'agir rapidement.

Exemple :

### Loyers en retard

| Appartement | Locataire | Montant | Retard |
|---|---|---:|---:|
| A03 | Camara | 2 500 000 | 4 jours |
| B06 | Diallo | 3 000 000 | 2 jours |

Depuis cette vue :

**Relancer**

doit être immédiatement accessible.

---

# 9. Règle UX numéro 5 : ne pas demander deux fois une information

Lorsqu'une information existe déjà, le produit doit la récupérer automatiquement.

Exemple :

Le gestionnaire sélectionne :

> Appartement A04

Le système connaît déjà :

- l'immeuble ;
- le locataire ;
- le contrat ;
- le montant du loyer.

Il ne doit pas demander à nouveau ces informations.

---

# 10. Règle UX numéro 6 : privilégier les actions contextuelles

Une même action peut être accessible depuis plusieurs endroits.

Exemple :

**Ajouter un locataire**

peut être disponible depuis :

- l'immeuble ;
- l'appartement ;
- la liste des locataires.

Le système doit toujours utiliser la même entité sous-jacente.

---

# 11. Navigation UX

## 11.1 Propriétaire

La navigation doit privilégier :

```text id="j9t3dr"
Accueil
Patrimoine
Finance
Maintenance
Gestionnaires
Rapports
Paramètres
```

Le propriétaire doit pouvoir accéder très rapidement à son patrimoine.

---

## 11.2 Gestionnaire

La navigation doit privilégier :

```text id="fpnqj9"
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

Le gestionnaire doit pouvoir commencer sa journée depuis une liste d'actions.

---

## 11.3 Locataire

Navigation minimale :

```text id="rqk9n0"
Accueil
À payer
Paiements
Quittances
Incidents
Profil
```

Le locataire n'a pas besoin d'une navigation riche.

---

# 12. Dashboard UX

Le dashboard doit répondre à la question :

> **Que dois-je savoir ou faire maintenant ?**

Il ne doit pas seulement répondre :

> Combien d'appartements existe-t-il ?

---

# 13. Dashboard propriétaire

Ordre de priorité recommandé :

### 1. Résumé du patrimoine

Nombre d'immeubles

Nombre de logements

Taux d'occupation

### 2. Situation financière

Loyers attendus

Loyers encaissés

Impayés

Dépenses

### 3. Alertes

Impayés

Incidents importants

Gestionnaires

### 4. Activité récente

Paiements

Dépenses

Interventions

---

# 14. Dashboard gestionnaire

Le dashboard doit être orienté tâches.

### À traiter

3 loyers en retard

2 invitations en attente

1 incident urgent

1 charge à publier

### Aujourd'hui

Paiements

Échéances

Interventions

### Situation

Encaissements

Impayés

Incidents ouverts

---

# 15. Dashboard locataire

Le dashboard doit être extrêmement simple.

Ordre de priorité :

### Montant à payer

**2 800 000 GNF**

Il s'agit du **total dû**, somme des créances ouvertes : loyer et charges (DEC-005).

Le détail est accessible en un geste, jamais imposé.

### Date

**Échéance : 5 septembre**

La date affichée est la **plus proche échéance** parmi les créances ouvertes.

### Action

**Payer**

Puis :

- dernier paiement ;
- prochaine échéance ;
- incidents actifs.

---

# 16. UX de l'ajout d'une donnée

Le produit doit privilégier des formulaires courts.

## Exemple : ajouter un locataire

Au lieu d'un long formulaire :

### Étape 1

Nom

Téléphone

Appartement

### Étape 2

Loyer / contrat

### Étape 3

Invitation

La configuration avancée peut rester optionnelle.

---

# 17. UX des formulaires

Les formulaires doivent :

- utiliser des valeurs par défaut ;
- préremplir les informations connues ;
- valider au fur et à mesure ;
- indiquer clairement les champs obligatoires ;
- éviter les champs inutiles ;
- conserver les données saisies en cas d'erreur.

---

# 18. UX de l'invitation

L'invitation est une fonctionnalité stratégique.

Elle doit paraître presque instantanée.

### Gestionnaire

> Ajouter un locataire

Nom

Téléphone

Appartement

**Envoyer l'accès**

Fin.

Le système prend ensuite en charge :

- génération du lien ;
- personnalisation du message ;
- canal ;
- expiration ;
- état de l'invitation.

---

# 19. UX d'activation

Le destinataire d'une invitation doit arriver directement dans son contexte.

Il ne doit pas passer par :

Accueil générique

→ inscription

→ recherche d'organisation

→ recherche d'immeuble

→ recherche d'appartement.

Il doit arriver directement sur :

> **Votre espace**

Puis définir son accès.

---

# 20. UX de paiement

Le paiement doit avoir le moins d'étapes possible.

### Locataire

Accueil

↓

Montant à payer

↓

Payer

↓

Choix du moyen

↓

Confirmation

↓

Reçu

Le système doit éviter les écrans intermédiaires inutiles.

---

# 21. UX du paiement partiel

Lorsque le locataire paie partiellement, le système doit rendre le solde évident.

Exemple :

> **2 800 000 GNF dus**

> 1 500 000 GNF payé

> **1 300 000 GNF restant**

L'utilisateur ne doit jamais devoir faire lui-même le calcul.

## Ventilation par composante

> **DEC-005** : le total dû se compose de créances distinctes.

Le locataire doit pouvoir ouvrir le détail :

```text
Total à payer            2 800 000 GNF

  Loyer septembre        2 500 000 GNF
    payé 1 500 000  reste 1 000 000   Partiellement payé

  Eau septembre            300 000 GNF
    payé         0  reste   300 000   À payer
```

Le **total** reste l'information principale.

La ventilation est secondaire mais toujours accessible, et provient des allocations réelles, jamais d'un calcul d'affichage.

## Paiement supérieur au montant dû

> **DEC-023** : refusé.

Le montant proposé est plafonné au total dû. L'interface ne doit pas laisser saisir un montant supérieur puis afficher une erreur tardive.

---

# 22. UX des charges communes

La charge commune doit être présentée avec une logique en deux niveaux.

### Niveau gestionnaire

Il voit :

> Facture d'eau : 3 600 000 GNF

Puis :

> Répartition

Puis :

| Appartement | Part |
|---|---:|
| A01 | 300 000 |
| A02 | 300 000 |
| A03 | 300 000 |

Il peut vérifier avant publication.

### Niveau locataire

Il voit sa part comme une **créance payable**, au même titre que son loyer :

> Eau septembre : **300 000 GNF** (À payer)

avec un accès au détail du calcul :

> Facture totale : 3 600 000 GNF
> 12 appartements concernés
> Répartition égale

Il ne voit **jamais** les montants dus par les autres logements.

Sa part apparaît dans son total dû, aux côtés de son loyer (DEC-005).

---

# 23. UX des incidents

Le locataire doit pouvoir signaler un problème très rapidement.

Le parcours cible :

> **Signaler un problème**

↓

Choisir le type

↓

Photo facultative

↓

Description

↓

**Envoyer**

Le système connaît déjà l'appartement.

---

# 24. UX du suivi d'incident

Le gestionnaire doit pouvoir comprendre l'état d'un incident en un coup d'œil.

Exemple :

> **Fuite d'eau, A04**
>
> Nouveau
>
> Signalé aujourd'hui
>
> Priorité : urgente

Puis :

> **Assigné à Mohamed Plomberie**

Puis :

> **Intervention en cours**

Puis :

> **Résolu**

---

# 25. UX des confirmations

Les confirmations doivent être utilisées pour les actions irréversibles ou sensibles.

Exemple :

### Révocation gestionnaire

> **Révoquer l'accès de Mamadou ?**
>
> Mamadou ne pourra plus accéder aux immeubles concernés.
>
> Son historique d'activité sera conservé.

**Annuler**

**Révoquer l'accès**

Le système explique toujours la conséquence.

---

# 26. UX de suppression

Le terme "Supprimer" doit être utilisé avec prudence.

Le produit doit préférer :

- Archiver ;
- Désactiver ;
- Révoquer ;
- Annuler ;
- Clôturer.

Ces termes reflètent mieux le comportement réel du système.

---

# 27. UX des statuts

Les statuts doivent être visuellement cohérents dans tout le produit.

Exemple :

### Paiement

**En attente**

**Confirmé**

**Échoué**

### Loyer

**À payer**

**Partiellement payé**

**Payé**

**En retard**

### Incident

**Nouveau**

**En cours**

**Résolu**

L'utilisateur doit reconnaître rapidement les situations sans devoir lire de longs textes.

---

# 28. UX des états vides

Un état vide doit expliquer ce qu'il représente et proposer l'action suivante.

Mauvais :

> Aucun résultat

Meilleur :

> **Aucun locataire pour le moment**
>
> Ajoutez votre premier locataire pour commencer à suivre les loyers.
>
> **Ajouter un locataire**

---

# 29. UX des erreurs

Chaque erreur doit répondre à trois questions :

1. Que s'est-il passé ?
2. Pourquoi ?
3. Que faire maintenant ?

Exemple :

> **L'invitation n'a pas pu être envoyée**
>
> Vérifiez le numéro de téléphone.
>
> **Modifier le numéro**

---

# 30. UX des données financières

Les informations financières doivent être lisibles immédiatement.

Toujours privilégier :

**2 800 000 GNF**

plutôt que :

**2800000**

Les éléments monétaires doivent être alignés et hiérarchisés.

---

# 31. UX du contexte temporel

Les dates doivent toujours être compréhensibles.

Éviter de n'afficher que :

> 05/09

Préférer selon le contexte :

> **5 septembre 2026**

Pour les données récentes :

> Il y a 2 heures

peut compléter une date précise.

---

# 32. UX de la recherche

La recherche doit être tolérante.

Le gestionnaire doit pouvoir retrouver un locataire avec :

- nom ;
- prénom ;
- numéro ;
- appartement.

La recherche doit fonctionner sans exiger le format exact.

---

# 33. UX des filtres

Les filtres doivent être :

- faciles à comprendre ;
- faciles à retirer ;
- visibles lorsqu'ils sont actifs ;
- conservés pendant une navigation courte lorsque cela a du sens.

Exemple :

> **En retard ×**

Le filtre actif doit toujours être visible.

---

# 34. UX des listes

Les listes doivent afficher les informations essentielles uniquement.

Le reste apparaît dans la fiche détail.

Exemple pour les loyers :

```text
Appartement
Locataire
Montant
Statut
Date
```

Les informations supplémentaires restent accessibles au clic.

---

# 35. UX des détails

Chaque fiche détail doit avoir une structure cohérente.

### En-tête

Identité de l'objet

### Résumé

Situation actuelle

### Actions principales

Actions disponibles

### Informations

Données détaillées

### Historique

Évolution dans le temps

Cette structure peut être adaptée à chaque objet sans être abandonnée.

---

# 36. UX de la navigation dans le patrimoine

Pour un gestionnaire :

> Immeubles

↓

> Résidence Camayenne

↓

> A04

↓

> Mamadou Diallo

Cette navigation hiérarchique doit être naturelle.

Une possibilité de retour rapide vers chaque niveau doit être conservée.

---

# 37. UX mobile

Le mobile ne doit pas être une version réduite du desktop.

Les priorités doivent être réorganisées.

### Mobile

Actions rapides

Informations essentielles

Listes courtes

Actions contextuelles

### Desktop

Vue d'ensemble

Multi-colonnes

Analyse

Gestion de volumes importants

---

# 38. UX responsive

Le même produit doit fonctionner sur :

- smartphone ;
- tablette ;
- ordinateur.

Mais la structure peut s'adapter.

Exemple :

Une table complexe sur desktop peut devenir des cartes compactes sur mobile.

---

# 39. UX des actions répétitives

Le produit doit prévoir des actions groupées.

Exemples :

Sélectionner plusieurs impayés

→ Envoyer les relances

Sélectionner plusieurs locataires

→ Renvoyer les invitations

Sélectionner plusieurs appartements

→ Modifier certains paramètres selon les permissions.

---

# 40. UX des automatismes

Une automatisation doit rester visible.

Exemple :

> **Relance automatique activée**

ou :

> **Échéance générée automatiquement**

L'utilisateur doit comprendre qu'une action a été effectuée par le système.

---

# 41. UX des événements système

Le système doit distinguer :

### Action humaine

> Mamadou a enregistré un paiement.

### Action automatique

> L'échéance de septembre a été générée automatiquement.

Cette distinction améliore la compréhension de l'historique.

---

# 42. UX des notifications

Chaque notification doit être :

- courte ;
- claire ;
- contextualisée ;
- actionnable lorsque nécessaire.

Exemple :

> **Nouveau paiement**
>
> A04 a payé 2 500 000 GNF.
>
> **Voir le paiement**

---

# 43. UX de la confiance

Puisque le produit traite des loyers et des dépenses, l'expérience doit inspirer confiance.

Cela passe par :

- statuts clairs ;
- références ;
- confirmations ;
- historiques ;
- justificatifs ;
- informations temporelles ;
- journalisation ;
- absence de modifications invisibles.

---

# 44. UX de la transparence

Lorsqu'un montant est calculé automatiquement, l'utilisateur doit pouvoir comprendre pourquoi.

Exemple :

> **Votre part d'eau : 300 000 GNF**
>
> Facture totale : 3 600 000 GNF  
> 12 appartements concernés  
> Répartition égale

La transparence est particulièrement importante pour les charges.

---

# 45. UX des permissions

Le propriétaire doit pouvoir comprendre les accès sans langage technique.

Exemple :

> **Mamadou**
>
> Gestionnaire
>
> Accès :
> Camayenne
> Kipé
>
> Peut gérer :
> ✓ Locataires
> ✓ Loyers
> ✓ Paiements
> ✓ Maintenance
>
> Ne peut pas :
> ✕ Gérer les gestionnaires

---

# 46. UX de la révocation

La révocation doit être immédiate du point de vue du propriétaire.

Après confirmation :

> **Accès révoqué**

Le système peut indiquer :

> Mamadou n'a plus accès aux immeubles concernés.

Cela doit créer une forte impression de contrôle.

---

# 47. UX des historiques

L'historique doit être lisible comme une chronologie humaine.

Mauvais :

> `UPDATE payment status=confirmed`

Meilleur :

> **Paiement confirmé**
>
> 2 500 000 GNF  
> Mamadou  
> 5 septembre 2026 à 10:23

---

# 48. UX de la cohérence des termes

Le produit doit utiliser un vocabulaire stable.

Exemple :

Utiliser partout :

**Locataire**

et non parfois :

**Client**

ou :

**Occupant**

De même :

**Appartement**

et non :

**Unité**, **logement**, **lot** simultanément sans raison.

Un glossaire produit devra être maintenu.

---

# 49. UX de l'apprentissage

Le produit doit nécessiter le moins possible de formation.

Cependant, un onboarding court peut être utilisé.

### Propriétaire

1. Créer l'immeuble
2. Inviter le gestionnaire
3. Commencer

### Gestionnaire

1. Vérifier les appartements
2. Ajouter les locataires
3. Commencer le suivi

### Locataire

1. Activer l'accès
2. Voir ce qu'il doit
3. Payer ou signaler un problème

L'onboarding doit se terminer rapidement.

---

# 50. UX des raccourcis

Les actions fréquentes peuvent disposer de raccourcis globaux.

Exemple :

**+**

Puis :

- Ajouter un immeuble
- Ajouter un locataire
- Enregistrer un paiement
- Créer une charge
- Signaler un incident

Le contenu du menu dépend du rôle.

---

# 51. UX des actions récentes

Les utilisateurs opérationnels doivent pouvoir retrouver rapidement ce qu'ils viennent de faire.

Exemple :

> Activité récente

Paiement A04

Incident B07

Invitation envoyée à C02

Cela réduit la nécessité de rechercher une donnée immédiatement après l'avoir créée.

---

# 52. UX de la continuité

Lorsqu'un utilisateur quitte une tâche puis revient, le système doit préserver autant que possible son contexte.

Exemple :

Le gestionnaire commence à créer une charge.

Il consulte une facture.

À son retour, il doit pouvoir reprendre sans tout recommencer lorsque cela est possible.

---

# 53. UX des opérations sensibles

Pour les actions sensibles, le système doit utiliser :

- confirmation ;
- résumé ;
- conséquence ;
- action principale ;
- possibilité d'annulation lorsque possible.

Exemple :

Avant de publier une charge :

> **Publier les charges ?**
>
> 12 appartements  
> Total : 3 600 000 GNF  
> Chaque montant sera visible par le locataire concerné.

**Annuler**

**Publier**

---

# 54. UX de la performance perçue

Même lorsque le traitement prend quelques secondes, l'utilisateur doit comprendre que son action est en cours.

Le système doit éviter :

> bouton appuyé → rien ne semble se passer.

Préférer :

> **Envoi en cours...**

puis :

> **Invitation envoyée**

---

# 55. UX des opérations asynchrones

Pour les opérations plus longues :

- montrer l'état ;
- éviter les doubles clics ;
- indiquer le résultat ;
- permettre de continuer à travailler lorsqu'il n'est pas nécessaire de bloquer l'interface.

---

# 56. UX des problèmes de connexion

Lorsque la connexion est faible :

> **Connexion instable**
>
> Votre dernière action est en cours de synchronisation.

Le système ne doit pas afficher une opération comme terminée avant confirmation.

---

# 57. UX des notifications WhatsApp et SMS

> **Périmètre MVP** : voir DEC-027.
>
> Les canaux WhatsApp, SMS et email sont **définis mais inactifs au MVP**. Le seul canal de notification actif est `IN_APP`.
>
> Cette section décrit la règle applicable lorsque ces canaux seront activés. Elle ne décrit pas une fonctionnalité du MVP.

Les communications externes doivent conserver le langage et la simplicité de la plateforme.

Exemple :

> **SIMANDOU IMMO**
>
> Votre loyer de septembre est de 2 500 000 GNF.
>
> Échéance : 5 septembre.
>
> **Voir mon espace**

Le lien doit conduire directement au contexte utile.

---

# 58. Principe "zéro recherche inutile"

Lorsque le système sait où l'utilisateur doit aller, il doit le conduire directement.

Exemple :

Un locataire reçoit une notification de charge.

Le lien doit ouvrir :

> **Votre charge d'eau de septembre**

et non simplement :

> Accueil.

---

# 59. Architecture UX des pages

Sans encore définir les écrans, chaque grande vue devra respecter une structure générale :

```text id="7xt0qk"
CONTEXTE
    ↓
RÉSUMÉ
    ↓
ACTION PRINCIPALE
    ↓
INFORMATIONS ESSENTIELLES
    ↓
DÉTAILS
    ↓
HISTORIQUE / ACTIVITÉ
```

Cette structure pourra être adaptée selon le type d'objet.

---

# 60. Système de feedback

Toute action importante doit produire un feedback.

### Succès

> Paiement enregistré.

### Échec

> Le paiement n'a pas pu être confirmé.

### En cours

> Vérification du paiement...

### Information

> Cette facture a déjà été publiée.

Le feedback doit être visible sans être intrusif.

---

# 61. Prévention des doubles actions

Le système doit empêcher les doubles actions accidentelles.

Exemple :

L'utilisateur clique deux fois sur :

> Publier

Le système ne doit pas publier deux fois la même charge.

Même principe pour :

- paiement ;
- invitation ;
- dépense ;
- incident.

---

# 62. UX des données volumineuses

Un gestionnaire peut avoir :

- 20 locataires ;
- 100 locataires ;
- 500 locataires ;
- davantage.

La structure UX doit donc supporter la croissance.

Cela implique :

- recherche ;
- filtres ;
- pagination ou chargement progressif ;
- actions groupées ;
- tri.

Mais ces fonctions ne doivent apparaître que lorsqu'elles sont utiles.

---

# 63. UX de la personnalisation

La personnalisation doit rester secondaire au MVP.

Le système peut proposer :

- préférences de notification ;
- langue ;
- format d'affichage ;
- profil.

Il ne faut pas permettre trop tôt une personnalisation qui complexifie l'expérience.

---

# 64. Critères UX du MVP

Le MVP doit respecter les critères suivants :

### Compréhension

Un nouvel utilisateur doit comprendre l'objectif principal de son espace rapidement.

### Rapidité

Une action fréquente doit être réalisée avec peu d'étapes.

### Cohérence

Une même action doit fonctionner de façon similaire dans toute la plateforme.

### Visibilité

Les informations importantes doivent être immédiatement accessibles.

### Contrôle

L'utilisateur doit comprendre les conséquences des actions sensibles.

### Tolérance aux erreurs

Les erreurs doivent être récupérables.

### Confiance

Les opérations financières et administratives doivent laisser des preuves visibles.

---

# 65. Test UX de référence

Le produit pourra être considéré comme UX-compatible avec le MVP si un gestionnaire novice peut accomplir les actions suivantes sans formation approfondie :

1. Trouver un appartement.
2. Voir son locataire.
3. Voir son loyer.
4. Enregistrer un paiement manuel.
5. Relancer un retardataire.
6. Ajouter un locataire.
7. Envoyer une invitation.
8. Créer une facture d'eau.
9. Vérifier la répartition.
10. Publier la charge.
11. Voir un incident.
12. Enregistrer une intervention.
13. Voir la dépense correspondante.

Et si un locataire novice peut :

1. Activer son compte.
2. Comprendre ce qu'il doit.
3. Voir le détail.
4. Effectuer un paiement.
5. Retrouver son reçu.
6. Signaler un problème.

---

# 66. Philosophie UX finale

L'expérience doit donner l'impression que :

> **Le système sait déjà beaucoup de choses.**

L'utilisateur n'est pas là pour alimenter une base de données.

Il est là pour gérer son immeuble.

Le produit doit donc :

- mémoriser le contexte ;
- réutiliser les informations ;
- automatiser les tâches répétitives ;
- proposer la prochaine action logique ;
- cacher la complexité ;
- exposer les détails uniquement lorsque nécessaire.

---

# 67. Conclusion

La direction UX du produit peut être résumée par cinq principes :

**1. Contextuel**

L'utilisateur sait toujours où il agit.

**2. Simple**

Les actions courantes sont courtes et naturelles.

**3. Automatique**

Le système fait le travail répétitif.

**4. Transparent**

Les calculs et opérations importantes restent explicables.

**5. Contrôlé**

Les actions sensibles sont protégées et traçables.

Le produit doit donc rester fidèle à son principe fondateur :

> **Une plateforme techniquement sophistiquée qui donne à chacun l'impression qu'elle est simple.**