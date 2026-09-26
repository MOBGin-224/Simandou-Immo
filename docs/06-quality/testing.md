# Testing Strategy & QA Specification

## 1. Objet du document

Ce document définit la stratégie de tests et d'assurance qualité du SaaS de gestion d'immeubles.

Il précise :

- ce qui doit être testé ;
- à quel niveau ;
- quand les tests doivent être exécutés ;
- quels parcours sont critiques ;
- comment tester les permissions ;
- comment tester les opérations financières ;
- comment valider l'interface mobile first ;
- comment traiter les régressions ;
- quels critères doivent être satisfaits avant staging et production.

L'objectif est de garantir que le produit soit :

- fonctionnel ;
- sécurisé ;
- cohérent ;
- prévisible ;
- maintenable ;
- utilisable sur smartphone ;
- résistant aux erreurs courantes ;
- fiable sur les données financières et historiques.

---

# 2. Principes fondamentaux

## QA-001 : Tester selon le risque

Toutes les fonctionnalités n'ont pas le même niveau de criticité.

Priorité :

```text
P0
Sécurité
+
Permissions
+
Intégrité des données
+
Paiements
+
Données financières
```

puis :

```text
P1
Cœur métier
+
Parcours utilisateurs
```

puis :

```text
P2
UX
+
Notifications
+
Fonctionnalités secondaires
```

---

## QA-002 : Tester le comportement réel

Un test doit vérifier le comportement attendu du système, pas seulement l'exécution technique du code.

---

## QA-003 : Tester le refus autant que l'autorisation

Il faut vérifier :

```text
Utilisateur autorisé
→ accès accepté

Utilisateur non autorisé
→ accès refusé
```

Les scénarios négatifs sont obligatoires pour les fonctionnalités sensibles.

---

## QA-004 : Les tests backend sont prioritaires pour la sécurité

Une interface qui masque une action ne constitue pas un test de sécurité.

Les permissions doivent être testées directement au niveau backend.

---

## QA-005 : Le mobile est le format de référence

Chaque fonctionnalité frontend du MVP doit être testée d'abord sur smartphone.

Le test couvre ensuite :

- tablette ;
- desktop.

---

# 3. Classification des tests

La stratégie repose sur plusieurs niveaux.

```text
Unit Tests
↓
Integration Tests
↓
API / Backend Tests
↓
Component Tests
↓
End-to-End Tests
↓
Security Tests
↓
Responsive / Mobile Tests
↓
Regression Tests
↓
Release Tests
```

Tous les niveaux ne sont pas nécessaires pour chaque fonctionnalité.

---

# 4. MVP

## 4.1 Tests unitaires

Les tests unitaires couvrent les règles et fonctions déterministes.

Priorités :

- calculs de loyers ;
- calculs de restant dû ;
- calculs de charges ;
- allocation des paiements ;
- statuts ;
- permissions ;
- validation ;
- transitions d'état ;
- fonctions utilitaires critiques.

---

## MVP-QA-001 : Calcul du restant dû

Cas nominal :

```text id="q1k7xy"
Montant dû = 2 800 000
Paiement = 1 500 000
Reste = 1 300 000
```

Le système doit retourner exactement le montant attendu.

---

## MVP-QA-002 : Paiement intégral

```text id="0pj6x4"
Montant dû = 2 500 000
Paiement = 2 500 000
Reste = 0
Statut = PAID
```

---

## MVP-QA-003 : Paiement partiel

Le statut doit passer à :

```text
PARTIALLY_PAID
```

---

## MVP-QA-004 : Charge répartie

Exemple :

```text id="g84fwu"
3 600 000 / 12
=
300 000
```

Le calcul doit être exact.

---

## MVP-QA-005 : Gestion des arrondis

Les cas où la division ne produit pas une valeur entière doivent être testés.

Exemple :

```text id="w7zkgt"
1 000 / 3
```

Le système doit appliquer une règle d'allocation déterministe.

La somme des allocations doit rester cohérente avec le montant original.

---

# 5. Tests d'intégration

Les tests d'intégration vérifient les interactions entre :

- application ;
- base de données ;
- services métier ;
- API ;
- autorisation ;
- jobs ;
- stockage lorsque nécessaire.

---

## MVP-QA-006 : Création d'immeuble

Tester :

```text id="2h4sqp"
Utilisateur autorisé
→ API
→ validation
→ database
→ réponse
```

---

## MVP-QA-007 : Création interdite

Tester qu'un utilisateur ne disposant pas de la permission ne peut pas créer ou modifier une ressource protégée.

---

## MVP-QA-008 : Persistance

Après création :

- la ressource existe ;
- les relations sont correctes ;
- l'organisation est correcte ;
- les timestamps sont présents.

---

# 6. Tests d'API

Chaque endpoint critique doit être testé sur plusieurs dimensions.

### Cas nominal

La requête correcte réussit.

### Validation

Les données invalides sont rejetées.

### Authentification

Un utilisateur non connecté est refusé.

### Autorisation

Un utilisateur connecté mais non autorisé est refusé.

### Isolation

Une ressource d'une autre organisation est inaccessible.

### Erreurs

Les erreurs retournées sont cohérentes.

---

# 7. MVP : tests d'authentification

## MVP-QA-009 : Connexion valide

Vérifier :

- identifiants corrects ;
- session créée ;
- accès autorisé.

---

## MVP-QA-010 : Identifiants invalides

La connexion est refusée sans révéler d'information sensible.

---

## MVP-QA-011 : Déconnexion

Après déconnexion :

- la session ne permet plus d'accéder aux ressources protégées.

---

## MVP-QA-012 : Session expirée

Une session expirée doit être refusée.

---

## MVP-QA-013 : Réinitialisation du mot de passe

Tester :

- demande ;
- token ;
- expiration ;
- validation ;
- nouveau mot de passe ;
- invalidation des anciennes sessions lorsque nécessaire.

---

# 8. MVP : tests d'invitation

## MVP-QA-014 : Invitation valide

```text
Invitation
→ ouverture
→ acceptation
→ création / activation
→ accès
```

---

## MVP-QA-015 : Invitation expirée

L'activation doit être refusée.

---

## MVP-QA-016 : Invitation révoquée

Une invitation révoquée doit être inutilisable.

---

## MVP-QA-017 : Réutilisation

Une invitation déjà consommée ne doit plus fonctionner.

---

## MVP-QA-018 : Mauvais contexte

Une invitation destinée à un appartement ou à une organisation donnée ne doit jamais permettre de modifier son contexte.

---

# 9. MVP : tests multi-tenant

Ces tests sont critiques.

Créer au minimum :

```text id="v7a2hj"
Organisation A
Organisation B

User A
User B

Property A
Property B
```

Puis tester systématiquement :

```text id="6v4x19"
User A → Property A = OK
User A → Property B = DENY

User B → Property B = OK
User B → Property A = DENY
```

Même principe pour :

- appartements ;
- locataires ;
- contrats ;
- loyers ;
- paiements ;
- charges ;
- incidents ;
- dépenses ;
- documents.

---

# 10. MVP : tests RBAC + Scope

Créer des comptes de test :

```text
OWNER_A
MANAGER_A
MANAGER_B
TENANT_A
TENANT_B
```

Tester chaque permission importante.

Exemple :

```text
OWNER
→ modifier immeuble = OK

MANAGER
→ modifier immeuble autorisé = OK

MANAGER
→ modifier immeuble hors scope = DENY

TENANT
→ modifier immeuble = DENY
```

---

# 11. MVP : tests de révocation

## MVP-QA-019 : Révocation gestionnaire

Scénario :

```text
Manager actif
↓
Owner révoque
↓
Manager tente une nouvelle action
↓
Refus
```

L'historique doit rester visible aux utilisateurs autorisés.

---

## MVP-QA-020 : Révocation locataire

Après fin de relation locative :

- accès au logement retiré ;
- historique conservé ;
- nouveau contexte possible ultérieurement selon le modèle.

---

# 12. MVP : tests contrats

Tester :

- création ;
- modification lorsqu'elle est autorisée ;
- activation ;
- fin ;
- annulation ;
- historique ;
- changement de locataire ;
- contrat simultané interdit lorsque les règles métier l'interdisent.

---

# 13. MVP : tests loyers

Tester :

- génération ;
- échéance ;
- montant ;
- période ;
- statut ;
- retard ;
- paiement partiel ;
- paiement complet.

---

## MVP-QA-021 : Génération répétée

Une opération de génération relancée ne doit pas créer plusieurs échéances pour la même combinaison métier lorsque celle-ci doit être unique.

---

# 14. MVP : tests paiements

Les paiements constituent l'une des zones de test les plus critiques.

## MVP-QA-022 : Paiement manuel

Tester :

```text
Paiement
→ validation
→ persistence
→ allocation
→ recalcul du restant
```

## MVP-QA-022-bis : Allocation multi-créances

> **Test obligatoire — DEC-005 / DEC-022.**

Scénario de référence :

```text
Créance loyer    2 500 000   UNPAID
Créance charge     300 000   UNPAID
Total dû         2 800 000

Paiement         1 500 000

Résultat attendu :
  Loyer    payé 1 500 000  reste 1 000 000  PARTIALLY_PAID
  Charge   payé         0  reste   300 000  UNPAID
  Total dû restant                1 300 000
```

Vérifier également :

- l'ordre d'allocation automatique est déterministe et reproductible ;
- une allocation explicite sur deux créances fonctionne ;
- la somme des allocations ne dépasse jamais le montant du paiement ;
- aucune allocation ne dépasse le solde de sa créance.

## MVP-QA-022-ter : Paiement supérieur au montant dû

> **Test obligatoire — DEC-023.**

```text
Total dû   2 800 000
Paiement   3 000 000
Attendu    REFUSÉ avec AMOUNT_EXCEEDS_OUTSTANDING
```

Vérifier qu'aucune créance n'est modifiée et qu'aucun crédit n'est créé.

---

## MVP-QA-023 : Paiement partiel

```text id="5izfk4"
Dû = 2 800 000
Payé = 1 500 000
Reste = 1 300 000
```

---

## MVP-QA-024 : Paiement complet

Le solde doit être nul.

---

## MVP-QA-025 : Transaction externe répétée

Une même référence fournisseur reçue plusieurs fois ne doit créer qu'un seul paiement métier.

---

## MVP-QA-026 : Webhook non authentifié

Le webhook doit être rejeté.

---

## MVP-QA-027 : État de paiement incertain

Tester le comportement lorsque :

```text
Paiement initié
+
Confirmation absente ou retardée
```

Le système ne doit pas considérer automatiquement le paiement comme reçu sans confirmation valide.

---

# 15. MVP : tests des quittances

Vérifier :

- association au bon paiement ;
- bon locataire ;
- bon logement ;
- bon montant ;
- bonne période ;
- accès sécurisé ;
- historique conservé.

---

# 16. MVP : tests des charges

> **DEC-005** — la publication crée des **créances payables**. Les tests doivent le vérifier explicitement.

Tester :

- création en statut `DRAFT`, sans créance ni visibilité locataire ;
- montant, immeuble, période, date d'échéance ;
- logements concernés ;
- répartition uniforme et arrondi déterministe ;
- publication atomique créant une créance par appartement ;
- statut initial `UNPAID`, solde égal au montant dû ;
- republication refusée avec `CONFLICT` ;
- annulation passant charge et créances en `CANCELLED` sans suppression ;
- appartement vacant : créance créée sans locataire redevable, invisible de tout espace locataire ;
- visibilité locataire limitée à sa propre part.

## MVP-QA-028-bis : La créance de charge est payable

Vérifier qu'une créance de charge peut recevoir une allocation de paiement, exactement comme une créance de loyer.

Un test qui ne vérifie que l'affichage de la part **ne couvre pas** DEC-005.

---

## MVP-QA-028 : Somme des allocations

Après répartition :

```text
Somme des parts
=
Montant de la charge
```

La règle doit être respectée même avec les arrondis.

---

# 17. MVP : tests incidents

Tester :

- création par locataire ;
- création par gestionnaire ;
- photos ;
- statut ;
- attribution ;
- visibilité ;
- historique.

---

# 18. MVP : tests incidents et interventions

Les deux cycles sont **distincts** et doivent être testés séparément.

## Incident — DEC-017

```text
OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
```

avec `ON_HOLD` intercalable.

## Intervention — DEC-018

```text
PLANNED -> IN_PROGRESS -> COMPLETED
PLANNED | IN_PROGRESS -> CANCELLED
```

## Tests obligatoires

- chaque transition autorisée aboutit ;
- toute transition non listée est rejetée avec `INVALID_STATE` ;
- la clôture d'une intervention **ne clôture pas** l'incident ;
- un incident portant plusieurs interventions reste cohérent.

---

# 19. MVP : tests dépenses

Tester :

- création ;
- montant ;
- catégorie ;
- immeuble ;
- intervention ;
- justificatif ;
- permission ;
- historique.

---

# 20. MVP : tests notifications

Vérifier :

- déclenchement ;
- destinataire ;
- contenu ;
- statut lu/non lu ;
- absence de fuite de données ;
- absence de répétition abusive.

---

# 21. MVP : tests des jobs

Les tâches asynchrones doivent être testées pour :

- succès ;
- échec ;
- retry ;
- doublon ;
- interruption ;
- idempotence.

Exemple :

```text id="c2l6l5"
Job reminder
↓
échec
↓
retry
↓
succès
```

Le retry ne doit pas provoquer plusieurs notifications indésirables.

---

# 22. MVP : tests des fichiers

Tester :

- type autorisé ;
- taille maximale ;
- fichier invalide ;
- accès autorisé ;
- accès refusé ;
- suppression ou archivage si applicable ;
- URL temporaire.

---

# 23. MVP : tests frontend

Les composants critiques doivent être testés sur :

- affichage ;
- interaction ;
- états ;
- validation ;
- erreurs ;
- permissions visibles.

---

# 24. MVP : états UI obligatoires

Chaque écran important doit prévoir au minimum :

```text
Loading
Empty
Success
Error
Unauthorized
Not Found
```

---

# 25. MVP : tests Responsive Mobile First

Le test frontend doit suivre cet ordre :

```text
Smartphone
↓
Tablet
↓
Desktop
```

---

## MVP-QA-029 : Smartphone

Tester notamment :

- largeur réduite ;
- navigation ;
- formulaires ;
- clavier ;
- boutons ;
- tableaux transformés en listes lorsque nécessaire ;
- bottom sheets ;
- upload photo ;
- paiements ;
- notifications.

---

## MVP-QA-030 : Rotation

Tester :

- portrait ;
- paysage lorsque pertinent.

---

## MVP-QA-031 : Tablette

Vérifier l'adaptation de :

- grilles ;
- navigation ;
- cartes ;
- formulaires ;
- tableaux.

---

## MVP-QA-032 : Desktop

Vérifier :

- largeur ;
- navigation ;
- densité ;
- tableaux ;
- espaces ;
- absence de régression par rapport au mobile.

---

# 26. MVP : tests d'accessibilité

Tester au minimum :

- navigation clavier sur desktop ;
- focus visible ;
- labels ;
- contraste conforme aux objectifs définis par le Design System ;
- boutons compréhensibles ;
- messages d'erreur accessibles ;
- zones tactiles suffisantes sur mobile ;
- alternatives textuelles pour les éléments importants.

---

# 27. MVP : tests de performance

Mesurer les parcours essentiels.

Priorités :

- chargement initial ;
- dashboard ;
- liste des immeubles ;
- liste des locataires ;
- détail appartement ;
- paiement ;
- consultation locataire.

Éviter :

- requêtes inutiles ;
- chargement massif ;
- images non optimisées ;
- JavaScript inutile.

---

# 28. MVP : tests de concurrence

Tester les actions simultanées.

Exemple :

```text id="x03fgy"
Utilisateur A
↓
enregistre paiement

Utilisateur B
↓
enregistre paiement au même moment
```

Le système doit préserver l'intégrité des données.

Même principe pour :

- modification d'un contrat ;
- publication d'une charge ;
- changement d'état d'un incident ;
- génération d'échéances.

---

# 29. MVP : tests d'idempotence

Les opérations suivantes doivent être analysées :

- webhook paiement ;
- génération d'échéance ;
- création d'invitation ;
- envoi de notification ;
- jobs ;
- allocation.

Une même opération exécutée plusieurs fois dans le même contexte ne doit pas produire plusieurs effets métier lorsque la règle exige l'unicité.

---

# 30. MVP : tests de sécurité

## MVP-QA-033 : IDOR

Modifier un identifiant dans :

- URL ;
- paramètre ;
- body ;
- query ;

ne doit pas permettre d'accéder à une ressource non autorisée.

---

## MVP-QA-034 : Escalade de privilèges

Tester notamment :

```text
TENANT → MANAGER
MANAGER → OWNER
```

Aucune modification côté client ne doit permettre cette élévation.

---

## MVP-QA-035 : Accès inter-organisation

Tester systématiquement l'isolation.

---

## MVP-QA-036 : Injection

Tester les entrées utilisateur contre :

- SQL injection ;
- XSS ;
- payloads invalides ;
- données inattendues.

---

## MVP-QA-037 : Rate limiting

Tester les endpoints sensibles.

---

# 31. MVP : tests de recherche

La recherche doit respecter les permissions.

Exemple :

```text
Manager A recherche "Camayenne"
```

Il ne doit voir que les résultats de son périmètre.

---

# 32. MVP : tests des exports

Pour chaque export :

- vérifier l'autorisation ;
- vérifier le périmètre ;
- vérifier le contenu ;
- vérifier l'absence de données hors scope.

---

# 33. MVP : tests de données historiques

Tester particulièrement :

- départ d'un locataire ;
- nouveau locataire ;
- fin d'un contrat ;
- révocation d'un gestionnaire ;
- modification d'un loyer ;
- correction d'un paiement.

Aucune opération ne doit détruire involontairement l'historique métier.

---

# 34. MVP : tests de migration

Chaque migration doit être testée.

Vérifier :

- création ;
- modification ;
- rollback lorsque applicable ;
- compatibilité avec les données existantes ;
- contraintes ;
- indexes.

---

# 35. MVP : tests de sauvegarde et restauration

Avant production :

1. générer une sauvegarde ;
2. restaurer dans un environnement de test ;
3. vérifier les données critiques ;
4. vérifier les relations ;
5. vérifier l'intégrité.

---

# 36. Tests End-to-End critiques

Les scénarios suivants doivent être automatisés lorsque possible.

## MVP-QA-E2E-001 : Onboarding propriétaire

```text id="9z4x71"
Créer compte
→ Organisation
→ Immeuble
→ Appartement
```

---

## MVP-QA-E2E-002 : Invitation gestionnaire

```text id="pl8ix7"
Owner
→ invite Manager
→ Manager ouvre invitation
→ active compte
→ voit son immeuble
```

---

## MVP-QA-E2E-003 : Invitation locataire

```text id="p4c2hf"
Manager
→ crée locataire
→ invite
→ Tenant active
→ voit son logement
```

---

## MVP-QA-E2E-004 : Cycle du loyer

```text id="jrw1vb"
Contrat actif
→ échéance
→ affichage
→ paiement
→ allocation
→ quittance
```

---

## MVP-QA-E2E-005 : Paiement partiel

```text id="1v3w6z"
Dû
→ paiement partiel
→ solde restant
→ statut PARTIALLY_PAID
```

---

## MVP-QA-E2E-006 : Charges

```text id="7m7fz4"
Charge
→ répartition
→ publication
→ locataire voit sa part
```

---

## MVP-QA-E2E-007 : Maintenance

```text id="g2p9w6"
Incident
→ attribution
→ intervention
→ dépense
→ résolution
```

---

## MVP-QA-E2E-008 : Révocation

```text id="v6k5f3"
Manager actif
→ Owner révoque
→ nouvelle action
→ refus
```

---

# 37. Test Data Strategy

Les tests doivent disposer de jeux de données contrôlés.

Prévoir :

```text id="s2gvr2"
Organisation A
Organisation B

Owner A
Owner B

Manager A1
Manager A2

Tenant A1
Tenant A2
Tenant B1

Property A1
Property A2
Property B1
```

Avec plusieurs :

- appartements ;
- contrats ;
- échéances ;
- paiements ;
- charges ;
- incidents.

---

# 38. Données de test financières

Prévoir des cas :

```text
0 GNF
1 GNF
999 GNF
1 000 GNF
2 500 000 GNF
10 000 000 GNF
Très grand montant valide
```

Tester les montants négatifs ou invalides.

---

# 39. Test des dates

Tester :

- début de mois ;
- fin de mois ;
- février ;
- année bissextile ;
- changement de mois ;
- changement d'année ;
- dates futures ;
- dates passées ;
- dates invalides.

---

# 40. Future Evolutions

Les éléments suivants ne doivent pas être nécessaires au lancement du MVP.

## FUT-QA-001 : Tests applications natives

Ajouter des suites spécifiques :

- iOS ;
- Android ;
- notifications natives ;
- stockage local natif.

---

## FUT-QA-002 : Tests multi-pays

Ajouter des cas par :

- devise ;
- timezone ;
- formats ;
- règles locales ;
- moyens de paiement.

---

## FUT-QA-003 : Tests comptables avancés

Créer une stratégie QA spécifique pour :

- rapprochement ;
- fiscalité ;
- reporting comptable ;
- écritures.

---

## FUT-QA-004 : Tests copropriété

Ajouter des scénarios pour :

- assemblées ;
- votes ;
- tantièmes ;
- copropriétaires ;
- appels de fonds.

---

## FUT-QA-005 : Tests analytics avancés

Tester :

- agrégations importantes ;
- cohérence statistique ;
- dashboards analytiques ;
- exports avancés.

---

# 41. Architecture Constraints Related to Future Evolutions

## ARCH-QA-001 : Automatisation des tests

Les tests critiques doivent être automatisables afin de permettre l'évolution du produit sans dépendre uniquement de tests manuels.

---

## ARCH-QA-002 : Fixtures réutilisables

Construire des helpers permettant de générer :

- utilisateurs ;
- organisations ;
- propriétés ;
- appartements ;
- contrats ;
- paiements.

---

## ARCH-QA-003 : Environnement de test isolé

Les tests ne doivent jamais dépendre des données de production.

---

## ARCH-QA-004 : Abstraction des fournisseurs externes

Les tests doivent pouvoir simuler :

- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage.

Les tests unitaires ne doivent pas appeler directement les fournisseurs réels.

---

## ARCH-QA-005 : Testabilité des règles métier

Les règles métier doivent rester suffisamment découplées de l'interface et de l'infrastructure pour être testées directement.

---

# 42. Out of Scope

## OUT-QA-001 : Certification de sécurité externe

Aucune certification formelle de type audit de conformité externe n'est requise pour le MVP.

---

## OUT-QA-002 : Pentest externe complet

Un test d'intrusion externe complet peut être prévu ultérieurement.

Des tests de sécurité applicatifs internes restent toutefois obligatoires pour le MVP.

---

## OUT-QA-003 : Tests de charge massifs

Le MVP ne nécessite pas immédiatement une simulation de trafic à très grande échelle.

Des tests de performance réalistes sur les parcours critiques restent nécessaires.

---

## OUT-QA-004 : Matrice exhaustive de navigateurs

Le MVP doit supporter les navigateurs modernes prioritaires.

Il n'est pas nécessaire de couvrir toutes les anciennes versions de navigateurs.

---

# 43. Niveau de criticité des bugs

## P0 : Bloquant

Exemples :

- fuite inter-organisation ;
- paiement dupliqué ;
- élévation de privilèges ;
- corruption de données ;
- impossibilité générale de connexion.

Un bug P0 bloque la release.

---

## P1 : Critique

Exemples :

- fonctionnalité métier majeure inutilisable ;
- erreur financière importante ;
- perte d'historique ;
- fonctionnalité principale d'un rôle indisponible.

Une release ne doit normalement pas partir avec un P1 non résolu.

---

## P2 : Majeur

Exemples :

- problème UX important ;
- fonctionnalité secondaire dégradée ;
- erreur dans un parcours non critique.

---

## P3 : Mineur

Exemples :

- détail visuel ;
- wording ;
- comportement non bloquant.

---

# 44. Gestion d'un bug

Chaque bug doit contenir :

```text
Bug ID
Titre
Environnement
Version
Utilisateur / rôle
Étapes pour reproduire
Résultat attendu
Résultat obtenu
Criticité
Capture / logs si nécessaire
Statut
```

Cycle :

```text
Open
↓
Triaged
↓
In Progress
↓
Fixed
↓
Retest
↓
Verified
↓
Closed
```

---

# 45. Régression

Toute correction d'un bug critique doit déclencher :

- test du cas corrigé ;
- test des fonctionnalités liées ;
- tests de régression pertinents.

Les fonctionnalités financières et de permissions nécessitent une vigilance particulière.

---

# 46. CI Quality Gate

Une Pull Request ne doit pas être fusionnée si les contrôles obligatoires échouent.

Exemple :

```text
Typecheck
↓
Lint
↓
Unit Tests
↓
Integration Tests
↓
Build
```

Les tests E2E critiques peuvent être exécutés dans la CI selon les contraintes d'infrastructure.

---

# 47. Staging Quality Gate

Avant une release staging :

- CI verte ;
- migrations testées ;
- tests critiques verts ;
- fonctionnalités principales validées ;
- absence de P0 ;
- absence de P1 bloquant ;
- permissions vérifiées ;
- parcours financiers vérifiés ;
- responsive vérifié.

---

# 48. Production Release Gate

Une release production doit satisfaire au minimum :

### Sécurité

- authentification ;
- RBAC ;
- scope ;
- isolation ;
- IDOR ;
- secrets ;
- rate limiting.

### Finance

- paiements ;
- idempotence ;
- allocations ;
- quittances ;
- charges.

### Produit

- onboarding ;
- gestionnaire ;
- locataire ;
- contrat ;
- loyer ;
- maintenance.

### UX

- smartphone ;
- tablette ;
- desktop ;
- loading ;
- empty ;
- error ;
- success.

### Infrastructure

- build ;
- migrations ;
- sauvegardes ;
- monitoring ;
- logs.

---

# 49. Checklist QA avant chaque release

```text
[ ] Typecheck OK
[ ] Lint OK
[ ] Unit tests OK
[ ] Integration tests OK
[ ] Build OK
[ ] E2E critiques OK
[ ] Auth OK
[ ] Permissions OK
[ ] Multi-tenant isolation OK
[ ] Paiements OK
[ ] Idempotence OK
[ ] Audit OK
[ ] Uploads OK
[ ] Mobile OK
[ ] Tablet OK
[ ] Desktop OK
[ ] Backup vérifié
[ ] Monitoring OK
[ ] Aucun P0
[ ] Aucun P1 bloquant
```

---

# 50. Definition of Done QA

Une fonctionnalité n'est pas considérée comme validée simplement parce qu'elle fonctionne une première fois.

Elle est validée lorsque :

- le comportement nominal fonctionne ;
- les erreurs sont gérées ;
- les permissions sont testées ;
- les cas limites importants sont testés ;
- le mobile first est vérifié ;
- les données sont cohérentes ;
- les tests automatisés pertinents existent ;
- aucune régression critique n'est détectée.

---

# 51. Critères de qualité du MVP

Le MVP doit privilégier :

```text
Fiabilité
>
Sécurité
>
Intégrité des données
>
Simplicité d'utilisation
>
Performance
>
Richesse fonctionnelle
```

Une fonctionnalité supplémentaire ne justifie jamais une régression sur l'un des quatre premiers critères.

---

# 52. Stratégie finale

La qualité du produit doit être construite pendant le développement et non vérifiée uniquement à la fin.

Le cycle recommandé est :

```text
Construire
↓
Tester
↓
Corriger
↓
Retester
↓
Valider
↓
Livrer
```

Pour chaque fonctionnalité critique :

```text
Code
+
Test
+
Security Check
+
Responsive Check
+
Acceptance Criteria
```

Le principe directeur est :

> **Chaque fonctionnalité doit être prouvée fonctionnelle, sécurisée et utilisable avant d'être considérée comme terminée.**