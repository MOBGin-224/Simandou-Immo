# User Acceptance Testing & Pilot Launch Specification

## 1. Objet du document

Ce document définit la méthode de validation du produit auprès d'utilisateurs réels avant et pendant le lancement pilote.

Il complète les documents de développement et de QA.

Il répond à quatre questions :

1. Le produit fonctionne-t-il techniquement ?
2. Le produit permet-il réellement aux utilisateurs d'accomplir leurs tâches ?
3. Les utilisateurs comprennent-ils le produit sans assistance excessive ?
4. Le MVP est-il suffisamment stable pour être utilisé dans un contexte réel ?

Le pilote ne doit pas servir à développer toutes les demandes exprimées par les utilisateurs.

Il sert d'abord à vérifier que le problème principal est correctement adressé par le MVP.

---

# 2. Principes fondamentaux

## UAT-001 : L'utilisateur réel valide le comportement réel

Un test technique réussi ne garantit pas que l'utilisateur comprend le parcours.

Le UAT doit donc vérifier :

```text
Fonctionne techniquement
+
Compréhensible
+
Utilisable
+
Prévisible
```

---

## UAT-002 : Tester les parcours, pas seulement les écrans

Un écran peut être correct individuellement tout en produisant un mauvais parcours.

Le UAT porte donc principalement sur les workflows complets.

---

## UAT-003 : Smartphone en priorité

Puisque le produit est Responsive Mobile First, les tests terrain doivent commencer sur smartphone.

Ordre :

```text
Smartphone
↓
Tablet
↓
Desktop
```

---

## UAT-004 : Observer avant d'expliquer

Pendant un test utilisateur, éviter d'expliquer immédiatement comment effectuer une action.

L'objectif est d'observer :

- ce que l'utilisateur comprend ;
- où il hésite ;
- ce qu'il cherche ;
- ce qu'il interprète mal.

---

## UAT-005 : Le feedback ne devient pas automatiquement une fonctionnalité

Une demande utilisateur doit être classée :

```text
MVP Bug
UX Problem
Missing MVP Requirement
Future Evolution
Out of Scope
Training / Documentation
```

---

# 3. Distinction QA et UAT

## QA

Vérifie principalement :

- fonctionnement ;
- sécurité ;
- intégrité ;
- performance ;
- régression.

## UAT

Vérifie principalement :

- compréhension ;
- facilité d'utilisation ;
- cohérence des parcours ;
- adéquation au besoin ;
- capacité à accomplir une tâche réelle.

---

# 4. MVP

# 4.1 Objectifs du UAT

Le UAT MVP doit vérifier que les trois profils peuvent accomplir leurs tâches principales.

## OWNER

```text
Créer patrimoine
+
Organiser les accès
+
Suivre l'activité
```

## MANAGER

```text
Gérer les opérations quotidiennes
```

## TENANT

```text
Comprendre son logement
+
Comprendre ce qu'il doit
+
Suivre ses paiements
+
Signaler un incident
```

---

# 5. Profils de test

## MVP-UAT-001 : Owner

Sélectionner au minimum un propriétaire réellement représentatif du profil cible.

Le participant doit gérer ou avoir l'intention de gérer plusieurs logements.

---

## MVP-UAT-002 : Manager

Le gestionnaire doit être confronté à des tâches quotidiennes réalistes.

---

## MVP-UAT-003 : Tenant

Le locataire doit pouvoir tester le produit sans qu'un membre de l'équipe lui explique chaque étape à l'avance.

---

# 6. Taille minimale du pilote

Le nombre exact de participants dépendra du contexte terrain.

Pour un premier pilote contrôlé, prévoir idéalement :

```text
Owner
+
1 à plusieurs Managers
+
plusieurs Tenants
```

L'objectif n'est pas la représentativité statistique.

L'objectif est d'identifier :

- bugs ;
- blocages ;
- incompréhensions ;
- comportements inattendus ;
- problèmes de confiance.

---

# 7. UAT Environment

## MVP-UAT-004

Le pilote doit être effectué dans un environnement contrôlé correspondant à une configuration proche de la production.

Le staging peut être utilisé pour certains tests de validation.

Le pilote réel doit utiliser un environnement de production distinctement identifié lorsque de vraies données sont utilisées.

---

# 8. Données de pilote

## MVP-UAT-005

Les données du pilote doivent être préparées avant les tests.

Exemple :

```text
1 Owner
2 Managers
1 Building
12 Apartments
Several Tenants
Several Leases
Several Rent Installments
Payments
Charges
Incidents
Expenses
```

---

# 9. Scénario de référence

Le scénario UAT principal reprend un immeuble réel ou représentatif.

Exemple :

```text
Résidence Camayenne
12 appartements
```

Le scénario doit couvrir plusieurs situations :

- logement occupé ;
- logement vacant ;
- paiement complet ;
- paiement partiel ;
- retard ;
- charge commune ;
- incident ;
- intervention.

---

# 10. Parcours UAT Owner

## MVP-UAT-006 : Création de compte

### Action

Le participant crée son compte.

### Observer

- comprend-il les étapes ?
- comprend-il les termes utilisés ?
- sait-il quoi faire ensuite ?

### Acceptation

Le participant termine le parcours sans intervention excessive.

---

# 11. UAT Owner : création de l'organisation

## MVP-UAT-007

Le participant doit :

```text
Créer organisation
↓
Accéder au dashboard
```

Vérifier :

- compréhension du contexte ;
- lisibilité ;
- cohérence des informations.

---

# 12. UAT Owner : création d'un immeuble

## MVP-UAT-008

Le participant doit pouvoir :

```text
Créer immeuble
↓
Enregistrer
↓
Voir immeuble
```

Observer notamment le vocabulaire.

---

# 13. UAT Owner : création des appartements

## MVP-UAT-009

Créer plusieurs appartements.

Vérifier :

- rapidité ;
- facilité ;
- gestion des références ;
- compréhension des statuts.

---

# 14. UAT Owner : invitation gestionnaire

## MVP-UAT-010

Le participant doit :

```text
Sélectionner immeuble
↓
Inviter gestionnaire
↓
Définir scope
↓
Envoyer
```

Vérifier particulièrement :

- compréhension de la différence entre rôle et périmètre ;
- compréhension de la révocation ;
- confiance dans l'action.

---

# 15. UAT Manager : activation

## MVP-UAT-011

Le gestionnaire reçoit une invitation.

Il doit pouvoir :

```text
Ouvrir
↓
Accepter
↓
Créer accès
↓
Accéder au produit
```

Sans intervention technique de l'équipe.

---

# 16. UAT Manager : découverte

## MVP-UAT-012

Donner au gestionnaire une tâche ouverte :

> Vous venez de prendre en charge cet immeuble. Montrez-moi ce que vous regarderiez en premier.

Ne pas lui indiquer immédiatement le chemin.

Observer :

- navigation ;
- compréhension du dashboard ;
- capacité à retrouver un logement.

---

# 17. UAT Manager : création locataire

## MVP-UAT-013

Le gestionnaire doit :

```text
Créer locataire
↓
L'associer au logement
↓
Envoyer invitation
```

---

# 18. UAT Tenant : activation

## MVP-UAT-014

Le locataire doit pouvoir activer son compte depuis le lien reçu.

Observer :

- confiance dans le lien ;
- compréhension ;
- création du mot de passe ;
- première impression.

---

# 19. UAT Tenant : compréhension du logement

## MVP-UAT-015

Demander :

> Quel logement est le vôtre ?

Le locataire doit pouvoir répondre depuis son espace.

---

# 20. UAT Tenant : compréhension du montant dû

## MVP-UAT-016

Demander :

> Combien devez-vous actuellement ?

Le locataire doit identifier :

- loyer ;
- charge éventuelle ;
- total ;
- restant éventuel.

---

# 21. UAT Tenant : consultation d'un paiement

## MVP-UAT-017

Demander :

> Montrez-moi votre dernier paiement.

Observer :

- facilité de recherche ;
- compréhension de l'état ;
- confiance dans le statut.

---

# 22. UAT Tenant : quittance

## MVP-UAT-018

Demander :

> Montrez-moi votre quittance.

Le participant doit trouver la quittance sans explication détaillée.

---

# 23. UAT Tenant : déclaration d'incident

## MVP-UAT-019

Donner un scénario :

> Il y a une fuite d'eau dans votre appartement.

Le locataire doit :

```text
Créer incident
↓
Décrire
↓
Ajouter photo
↓
Envoyer
```

---

# 24. UAT Manager : suivi incident

## MVP-UAT-020

Le gestionnaire doit :

```text
Voir incident
↓
Comprendre le contexte
↓
Assigner intervention
↓
Mettre à jour
```

---

# 25. UAT : charges

## MVP-UAT-021

Le gestionnaire doit créer une charge.

Exemple :

```text
Facture eau :
3 600 000 GNF
12 appartements
```

Le système doit produire :

```text
300 000 GNF / appartement
```

Le gestionnaire doit comprendre le résultat avant publication.

---

# 26. UAT : paiement partiel

## MVP-UAT-022

Créer un scénario :

```text
Dû : 2 800 000 GNF
Payé : 1 500 000 GNF
```

Le participant doit comprendre immédiatement :

```text
Partiellement payé
Reste : 1 300 000 GNF
```

---

# 27. UAT : paiement digital

## MVP-UAT-023

> **DEC-034 OUVERTE** : aucun fournisseur de paiement n'est sélectionné.
>
> **Au MVP, ce scénario n'est pas testable en pilote réel.** Le paiement manuel est le seul moyen opérationnel.

Lorsque la décision sera levée, tester le parcours sandbox :

```text
Création
↓
PENDING
↓
Confirmation par webhook
↓
Allocation aux créances
↓
Mise à jour des soldes
```

Le test devra vérifier que l'interface ne présente jamais comme confirmé un paiement non confirmé (DEC-009).

## MVP-UAT-023-bis : Paiement manuel multi-créances

> **Testable dès le pilote : DEC-005.**

Scénario :

```text
Le locataire doit 2 500 000 GNF de loyer
et 300 000 GNF de charge d'eau.

Il remet 1 500 000 GNF en espèces au gestionnaire.
```

Observer :

- le gestionnaire comprend-il ce qu'il enregistre ?
- comprend-il comment le montant se répartit entre loyer et charge ?
- le locataire comprend-il son reste à payer et sa ventilation ?

---

# 28. UAT : révocation

## MVP-UAT-024

Scénario :

```text
Owner
↓
Révoque Manager
↓
Manager tente d'accéder au périmètre
```

Résultat attendu :

```text
Accès refusé
```

L'historique doit rester intact.

---

# 29. UAT : responsive

Chaque parcours critique doit être testé sur smartphone.

Tester ensuite :

- tablette ;
- desktop.

---

# 30. Tests de contexte réel

Le pilote doit autant que possible être réalisé :

- avec les appareils réellement utilisés ;
- avec les moyens de communication réellement utilisés ;
- avec une connectivité représentative.

---

# 31. Réseau faible

## MVP-UAT-025

Tester des situations de connectivité dégradée :

```text
Chargement lent
Perte temporaire de connexion
Reconnexion
```

Observer :

- messages affichés ;
- risque de double action ;
- persistance ;
- reprise.

---

# 32. Paiement et réseau instable

## MVP-UAT-026

Tester :

```text
Paiement initié
↓
Connexion interrompue
↓
Utilisateur revient
```

Le système doit éviter que l'utilisateur relance aveuglément une deuxième transaction.

---

# 33. Critères d'observation utilisateur

Pour chaque tâche, observer :

### Completion

La tâche est-elle terminée ?

### Time

Combien de temps ?

### Error

Quelles erreurs ?

### Help

Combien d'aide ?

### Confidence

L'utilisateur comprend-il ce qui vient de se passer ?

---

# 34. Score de réussite d'une tâche

Le UAT peut utiliser une classification simple :

```text
PASS
PASS WITH FRICTION
BLOCKED
FAILED
```

Éviter les scores arbitraires ou sur-complexes.

---

# 35. PASS

L'utilisateur accomplit la tâche sans difficulté significative.

---

# 36. PASS WITH FRICTION

L'utilisateur termine mais rencontre :

- hésitation ;
- confusion légère ;
- étape non évidente.

---

# 37. BLOCKED

L'utilisateur ne peut pas terminer sans intervention extérieure.

---

# 38. FAILED

Le produit ne permet pas correctement d'accomplir la tâche ou produit un résultat incorrect.

---

# 39. Criticité UAT

## P0

Empêche un parcours principal.

Exemples :

- impossible d'activer un compte ;
- paiement incorrect ;
- accès à mauvaise organisation.

---

## P1

Parcours fonctionnel mais fortement dégradé.

---

## P2

Friction importante mais contournable.

---

## P3

Amélioration mineure.

---

# 40. Journal de feedback

Chaque observation doit être enregistrée avec :

```text
Feedback ID
Participant Role
Scenario
Task
Expected
Observed
Severity
Frequency
Classification
Decision
```

---

# 41. Classification du feedback

Chaque feedback doit être classé comme :

```text
BUG
UX
MISSING_MVP
FUTURE
OUT_OF_SCOPE
TRAINING
```

---

# 42. Bug

Le comportement ne respecte pas le comportement attendu défini.

Exemple :

> Le paiement confirmé reste affiché comme en attente.

---

# 43. UX Problem

La fonctionnalité existe mais est difficile à comprendre.

Exemple :

> Les utilisateurs ne trouvent pas les quittances.

---

# 44. Missing MVP

Le produit ne permet pas une tâche nécessaire au cœur défini du MVP.

Cette catégorie doit être rare.

---

# 45. Future Evolution

La demande apporte une nouvelle capacité non nécessaire au MVP.

Exemple :

> Ajouter une comptabilité complète.

---

# 46. Out of Scope

La demande ne correspond pas au produit défini.

---

# 47. Training

Le produit fonctionne correctement mais l'utilisateur a besoin d'une explication sur une capacité qui nécessite réellement une formation ou une documentation.

Cette catégorie doit cependant être utilisée avec prudence.

---

# 48. Seuil de décision

Une demande répétée plusieurs fois n'entre pas automatiquement dans le MVP.

Avant de modifier le périmètre, vérifier :

```text id="zrqx2o"
Fréquence
+
Impact
+
Importance
+
Cohérence avec vision
+
Complexité
```

---

# 49. Bug Gate

Avant d'élargir le MVP, corriger d'abord :

- P0 ;
- P1 ;
- bugs financiers ;
- bugs de sécurité ;
- problèmes d'isolation ;
- erreurs de données.

---

# 50. UX Gate

Avant de conclure que le MVP est prêt, les parcours principaux doivent être suffisamment compréhensibles.

Une fonctionnalité ne doit pas être considérée comme réussie uniquement parce qu'elle est techniquement correcte.

---

# 51. Pilot Release

Le premier pilote doit privilégier :

- petit nombre d'organisations ;
- utilisateurs réellement actifs ;
- accompagnement rapproché ;
- observation ;
- feedback structuré.

---

# 52. Taille du pilote

Le pilote peut commencer avec :

```text
Quelques propriétaires
+
Quelques gestionnaires
+
Plusieurs locataires
```

L'objectif est de couvrir différents usages, pas de maximiser le nombre d'utilisateurs immédiatement.

---

# 53. Durée du pilote

La durée doit être suffisamment longue pour observer au moins plusieurs cycles opérationnels significatifs :

- activation ;
- gestion ;
- échéance ;
- paiement ;
- charge ;
- maintenance.

La durée exacte doit être fixée en fonction des utilisateurs et des cycles réels.

---

# 54. Support pendant le pilote

L'équipe doit disposer d'un canal permettant de recevoir rapidement :

- bug ;
- question ;
- incident ;
- feedback.

---

# 55. Ne pas masquer les problèmes

Pendant le pilote, éviter de résoudre systématiquement les problèmes manuellement sans les enregistrer.

Sinon :

```text
Problème réel
↓
Intervention humaine
↓
Produit semble fonctionner
```

et le problème disparaît des métriques.

---

# 56. Assistance contrôlée

L'équipe peut aider l'utilisateur, mais doit noter :

```text
Question posée
+
Réponse donnée
+
Pourquoi l'utilisateur était bloqué
```

Cela permet de distinguer :

- problème produit ;
- problème de compréhension ;
- manque de documentation.

---

# 57. UAT avec données financières

Les scénarios financiers doivent être particulièrement contrôlés.

Tester :

- paiement complet ;
- paiement partiel ;
- retard ;
- charge ;
- quittance ;
- doublon ;
- correction autorisée.

---

# 58. UAT de sécurité

Les scénarios suivants doivent être validés avant pilote réel :

```text
Tenant A
≠ Tenant B

Manager A
≠ Property hors scope

Organization A
≠ Organization B
```

---

# 59. UAT de notifications

Tester :

- invitation ;
- paiement ;
- charge ;
- incident ;
- rappel.

Vérifier :

- destinataire ;
- contenu ;
- timing ;
- répétition ;
- confidentialité.

---

# 60. UAT documents

Tester :

- upload ;
- affichage ;
- téléchargement ;
- accès refusé ;
- expiration d'URL.

---

# 61. Pilot Monitoring

Pendant le pilote, surveiller quotidiennement :

```text
Errors
Payments
Jobs
Notifications
Activation
Critical UX Issues
Security Events
```

---

# 62. Pilot Health Check

Le produit doit pouvoir répondre à :

```text
Combien de comptes actifs ?
Combien d'immeubles actifs ?
Combien de logements ?
Combien de paiements ?
Combien d'incidents ?
Combien d'erreurs critiques ?
```

---

# 63. Release Candidate

Avant le pilote réel, créer une version explicitement identifiée comme candidate :

```text
Release Candidate
```

Elle doit avoir :

- CI verte ;
- tests critiques verts ;
- sécurité validée ;
- staging validé ;
- smoke tests validés.

---

# 64. Go / No-Go

La décision de lancer le pilote doit prendre en compte :

### Go

```text
P0 = 0
Security critical = 0
Payment critical = 0
Core journeys = PASS
```

### No-Go

Tout problème critique non maîtrisé sur :

- sécurité ;
- données ;
- paiements ;
- authentification ;
- isolation.

---

# 65. Critères de réussite du pilote

Le pilote est considéré comme concluant lorsque :

- les parcours principaux fonctionnent réellement ;
- les utilisateurs atteignent leurs objectifs ;
- les erreurs critiques sont sous contrôle ;
- les données restent cohérentes ;
- les utilisateurs comprennent globalement le produit ;
- aucune faille critique n'est identifiée ;
- le support manuel n'est pas nécessaire pour les opérations fondamentales.

---

# 66. Fin du pilote

À la fin du pilote :

```text
Collecter feedback
↓
Classer feedback
↓
Analyser erreurs
↓
Analyser usage
↓
Identifier problèmes récurrents
↓
Décider corrections
↓
Décider évolutions
```

---

# 67. Pilot Review

La revue post-pilote doit contenir :

## Produit

- fonctions les plus utilisées ;
- fonctions peu comprises ;
- fonctions inutilisées.

## UX

- parcours les plus difficiles ;
- points d'abandon ;
- erreurs récurrentes.

## Technique

- bugs ;
- incidents ;
- performance ;
- fournisseurs.

## Sécurité

- tentatives anormales ;
- problèmes d'accès ;
- incidents éventuels.

---

# 68. Décision après pilote

Chaque observation importante doit finir dans une décision :

```text
FIX_NOW
FIX_BEFORE_GROWTH
KEEP
FUTURE
OUT
```

---

# 69. Future Evolutions

## FUT-UAT-001 : Programmes de beta test à grande échelle

Mettre en place plusieurs cohortes d'utilisateurs.

---

## FUT-UAT-002 : Expérimentation produit

Tester différentes variantes UX.

---

## FUT-UAT-003 : Customer Advisory Group

Créer un petit groupe permanent d'utilisateurs avancés.

---

## FUT-UAT-004 : Continuous Discovery

Mettre en place un processus continu d'entretiens utilisateurs et d'observation.

---

# 70. Architecture Constraints Related to Future Evolutions

## ARCH-UAT-001 : Feedback structuré

Les retours doivent pouvoir être associés à :

- fonctionnalité ;
- rôle ;
- scénario ;
- version.

---

## ARCH-UAT-002 : Version identifiable

Chaque feedback doit permettre de savoir quelle version du produit a été testée.

---

## ARCH-UAT-003 : Feature flags lorsque nécessaire

Les fonctionnalités expérimentales futures doivent pouvoir être activées progressivement sans réécriture majeure.

---

## ARCH-UAT-004 : Observabilité

Le produit doit permettre de croiser :

```text
Feedback utilisateur
+
Analytics
+
Logs
+
Erreurs
```

sans exposer inutilement les données personnelles.

---

# 71. Out of Scope

## OUT-UAT-001

Organiser un programme de test statistiquement représentatif de toute la population.

---

## OUT-UAT-002

Créer une infrastructure complexe d'expérimentation avant le MVP.

---

## OUT-UAT-003

Faire dépendre la validation du MVP d'un grand nombre de participants.

---

## OUT-UAT-004

Transformer chaque demande utilisateur en fonctionnalité.

---

# 72. Definition of Done UAT

Une fonctionnalité critique est validée lorsqu'elle :

```text
[ ] Fonctionne techniquement
[ ] Respecte les règles métier
[ ] Respecte la sécurité
[ ] Est comprise par l'utilisateur
[ ] Fonctionne sur smartphone
[ ] Fonctionne dans le parcours complet
[ ] Ne présente pas de bug critique
[ ] Dispose de critères d'acceptation validés
```

---

# 73. Checklist avant pilote

```text
## Produit
[ ] Owner journey
[ ] Manager journey
[ ] Tenant journey

## Finance
[ ] Rent receivable
[ ] Charge receivable
[ ] Total outstanding (loyer + charges)
[ ] Manual payment
[ ] Multi-receivable allocation
[ ] Partial payment
[ ] Overpayment refused
[ ] Receipt with breakdown

## Operations
[ ] Incident
[ ] Intervention
[ ] Expense

## Security
[ ] Isolation
[ ] RBAC
[ ] Scope
[ ] IDOR
[ ] Documents

## UX
[ ] Smartphone
[ ] Tablet
[ ] Desktop

## Technical
[ ] Monitoring
[ ] Backup
[ ] Error tracking
[ ] Jobs
[ ] Providers

## UAT
[ ] Scenarios
[ ] Participants
[ ] Test data
[ ] Feedback process
[ ] Go/No-Go criteria
```

---

# 74. Principe final

Le pilote n'a pas pour objectif de prouver que le produit est parfait.

Il doit permettre de vérifier que le produit est :

```text
Utilisable
+
Fiable
+
Compréhensible
+
Sécurisé
+
Pertinent
```

Le principe directeur est :

> **Un MVP est validé lorsqu'il permet à de vrais utilisateurs d'accomplir leurs tâches réelles sans dépendre constamment de l'équipe qui l'a construit.**