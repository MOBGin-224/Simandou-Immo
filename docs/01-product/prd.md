# Product Requirements Document (PRD)

## 1. Informations générales

**Nom du produit :** SIMANDOU IMMO  
**Type :** SaaS de gestion d'immeubles locatifs  
**Marché initial :** Guinée  
**Version du document :** 1.2  
**Statut :** Document de cadrage fonctionnel  
**Périmètre :** MVP

> **Note de consolidation** — Ce document est subordonné au **Product & Technical Decision Register** et au **Master Product Specification**.
>
> Lorsqu'une valeur de statut, une règle financière ou un périmètre décrit ici diverge d'une décision enregistrée dans le registre, **la décision du registre fait foi**.
>
> SIMANDOU IMMO est un produit **distinct de SIMANDOU SEJOUR**. Les deux ne doivent jamais être confondus.

---

# 2. Objet du document

Ce document définit les exigences fonctionnelles et produit du SaaS de gestion d'immeubles.

Il constitue la référence principale pour comprendre :

- ce que le produit doit permettre de faire ;
- qui peut effectuer chaque action ;
- quelles informations doivent être conservées ;
- comment les différentes entités sont liées ;
- quelles règles doivent être appliquées automatiquement ;
- quels événements doivent déclencher des notifications ;
- quelles fonctionnalités appartiennent au MVP ;
- quelles fonctionnalités sont volontairement exclues de la première version.

Le PRD intervient après la Product Vision / Concept Note et avant la conception détaillée des parcours, de l'architecture de l'information, des interfaces et du développement.

---

# 3. Vision produit

Le produit doit permettre à un propriétaire ou à un gestionnaire de gérer un ou plusieurs immeubles locatifs depuis une seule plateforme.

Le système doit centraliser :

- les immeubles ;
- les appartements ;
- les locataires ;
- les contrats ;
- les loyers ;
- les paiements ;
- les charges ;
- les incidents ;
- les interventions ;
- les dépenses ;
- les documents ;
- les historiques.

Le produit doit être capable de gérer une organisation immobilière complexe en arrière-plan tout en proposant une expérience extrêmement simple.

Principe directeur :

> **Complexe technologiquement. Simple humainement.**

---

# 4. Objectifs produit

## 4.1 Objectif principal

Permettre à un propriétaire ou à un gestionnaire de savoir à tout moment :

- quels logements sont occupés ;
- qui sont les locataires ;
- combien chaque locataire doit ;
- qui a payé ;
- qui est en retard ;
- quelles charges sont dues ;
- quelles dépenses ont été effectuées ;
- quels incidents sont ouverts ;
- quels travaux sont en cours ;
- quelle est la situation globale d'un immeuble.

## 4.2 Objectifs secondaires

Le produit doit également :

- réduire les tâches administratives répétitives ;
- réduire les erreurs de saisie ;
- faciliter les paiements ;
- faciliter les relances ;
- automatiser les quittances ;
- améliorer la communication avec les locataires ;
- conserver un historique fiable ;
- améliorer la visibilité du propriétaire ;
- permettre une gestion à distance.

---

# 5. Non objectifs du MVP

Le MVP ne cherche pas à devenir immédiatement une suite immobilière exhaustive.

Les fonctionnalités suivantes sont hors périmètre initial :

- comptabilité générale complète ;
- fiscalité immobilière avancée ;
- gestion juridique avancée ;
- gestion complète de copropriété ;
- assemblées de copropriété ;
- vote électronique ;
- marketplace complète de prestataires ;
- assurance immobilière ;
- financement immobilier ;
- crédit aux propriétaires ;
- analyse prédictive avancée ;
- intelligence artificielle décisionnelle ;
- gestion de portefeuille financier ;
- outils complexes de gestion d'actifs institutionnels.

Ces sujets pourront être étudiés dans des versions ultérieures.

---

# 6. Utilisateurs et rôles

Le système repose sur trois rôles principaux :

1. Propriétaire
2. Gestionnaire
3. Locataire

Un même utilisateur peut éventuellement cumuler plusieurs rôles selon le contexte.

Par exemple, un propriétaire qui gère lui-même son immeuble peut être à la fois propriétaire et gestionnaire.

---

# 7. Modèle d'accès par invitation

Le produit ne doit pas reposer principalement sur une inscription libre.

Le système doit fonctionner autour d'une logique de rattachement et d'invitation.

## 7.1 Propriétaire

Le propriétaire crée son compte.

Il peut ensuite :

- créer ses immeubles ;
- inviter ses gestionnaires ;
- attribuer des immeubles à un gestionnaire ;
- modifier le périmètre d'immeubles d'un gestionnaire ;
- suspendre un accès ;
- révoquer un accès.

Au MVP, la délégation porte **uniquement sur le périmètre d'immeubles** (DEC-025). Les permissions découlent du rôle et ne sont pas modifiables gestionnaire par gestionnaire.

## 7.2 Gestionnaire

Le gestionnaire reçoit une invitation.

Il crée son accès à partir de cette invitation.

Il peut ensuite :

- gérer les immeubles qui lui ont été attribués ;
- ajouter les appartements ;
- ajouter les locataires ;
- inviter les locataires.

## 7.3 Locataire

Le locataire reçoit une invitation.

**Au MVP, l'invitation est diffusée par lien de partage sécurisé** — voir DEC-026.

```text
Le système génère l'invitation et le lien.
Le gestionnaire copie le lien depuis l'interface.
Le gestionnaire le transmet par son propre moyen (WhatsApp, SMS, en personne).
```

L'envoi automatique par SMS et WhatsApp est reporté (DEC-008) et sera branché derrière `NotificationProvider` sans modifier le modèle d'invitation.

Il active son accès en définissant son mot de passe.

Toutes les informations déjà connues par le système doivent être préremplies.

Le locataire ne doit pas avoir à recréer manuellement :

- son identité ;
- son appartement ;
- son immeuble ;
- son propriétaire ;
- son montant de loyer.

---

# 8. Principes fonctionnels fondamentaux

## 8.1 Une information ne doit être saisie qu'une seule fois

Une donnée déjà connue doit être réutilisée dans tout le système.

Exemple :

Le montant du loyer enregistré dans le contrat doit servir de référence pour :

- la génération de l'échéance ;
- le calcul du montant dû ;
- le tableau de bord ;
- la relance ;
- la quittance ;
- l'historique.

## 8.2 Toute action importante doit être traçable

Le système doit pouvoir enregistrer :

- utilisateur ayant effectué l'action ;
- date ;
- heure ;
- objet concerné ;
- ancienne valeur lorsque nécessaire ;
- nouvelle valeur lorsque nécessaire.

## 8.3 Les historiques ne doivent pas être supprimés de façon destructive

Lorsqu'une relation prend fin, le système doit privilégier :

**désactivation / archivage**

plutôt que suppression définitive.

Exemple :

Un locataire quitte l'appartement.

Son accès est désactivé.

Son historique reste disponible.

## 8.4 Les actions doivent être réversibles lorsque cela est possible

Une erreur de saisie doit pouvoir être corrigée sans casser l'historique.

Exemple :

Un paiement de 2 500 000 GNF enregistré par erreur doit pouvoir être annulé ou corrigé avec une trace de l'opération.

---

# 9. Architecture fonctionnelle du produit

Le produit est organisé autour des entités suivantes :

```text
Organisation
├── Utilisateurs
│   ├── Propriétaires
│   ├── Gestionnaires
│   └── Locataires
│
├── Immeubles
│   ├── Appartements
│   │   ├── Locataire
│   │   ├── Contrat
│   │   ├── Loyers
│   │   ├── Paiements
│   │   ├── Charges
│   │   └── Incidents
│   │
│   ├── Charges
│   ├── Dépenses
│   ├── Maintenance
│   └── Documents
│
└── Rapports / Historiques
```

Cette structure devra être raffinée dans le document de Data Model.

---

# 10. Exigences fonctionnelles

# 10.1 Gestion du compte propriétaire

Le propriétaire doit pouvoir :

- créer son compte ;
- se connecter ;
- se déconnecter ;
- récupérer son mot de passe ;
- modifier ses informations ;
- modifier son mot de passe ;
- consulter ses sessions actives si nécessaire.

## Règles

Un compte propriétaire doit être associé à une organisation ou à un espace de gestion.

Un propriétaire peut posséder un ou plusieurs immeubles.

---

# 10.2 Gestion des gestionnaires

Le propriétaire doit pouvoir :

- ajouter un gestionnaire ;
- consulter ses gestionnaires ;
- inviter un gestionnaire ;
- modifier ses permissions ;
- modifier son périmètre d'accès ;
- suspendre son accès ;
- réactiver son accès ;
- révoquer son accès.

## Informations minimales

- nom ;
- numéro de téléphone ;
- éventuellement email ;
- statut ;
- immeubles accessibles ;
- rôle ;
- date d'invitation ;
- date d'activation.

## États possibles

Un gestionnaire peut avoir les états suivants :

**Invitation envoyée**

**Invitation acceptée**

**Actif**

**Suspendu**

**Révoqué**

---

# 10.3 Gestion des immeubles

Le propriétaire ou un gestionnaire autorisé doit pouvoir créer un immeuble.

## Informations minimales

- nom ;
- adresse ;
- ville ;
- quartier ;
- description éventuelle ;
- nombre d'appartements ;
- propriétaire ;
- gestionnaire(s) associé(s).

## États

Un immeuble peut être :

- actif ;
- archivé.

---

# 10.4 Gestion des appartements

Chaque appartement doit être rattaché à un immeuble.

## Informations

- identifiant ;
- numéro ;
- étage ;
- type ;
- statut ;
- surface éventuelle ;
- loyer ;
- charges éventuelles ;
- locataire ;
- contrat actif.

## Statuts

Valeurs canoniques — voir DEC-019 :

```text
VACANT        Vacant
OCCUPIED      Occupé
MAINTENANCE   En maintenance
```

`RESERVED` est hors périmètre MVP.

L'archivage n'est pas un statut : il est porté par `archived_at` (DEC-020).

Le statut d'un appartement doit être visible depuis la vue de l'immeuble.

---

# 10.5 Gestion des locataires

Le gestionnaire doit pouvoir :

- ajouter un locataire ;
- modifier un locataire ;
- rattacher un locataire à un appartement ;
- inviter un locataire ;
- renvoyer une invitation ;
- suspendre son accès ;
- réactiver son accès ;
- retirer son accès ;
- archiver un ancien locataire.

## Informations minimales

- nom complet ;
- téléphone ;
- email optionnel ;
- appartement ;
- date d'entrée ;
- statut ;
- contrat ;
- coordonnées complémentaires si nécessaires.

## États

- invitation non envoyée ;
- invitation envoyée ;
- compte activé ;
- actif ;
- suspendu ;
- ancien locataire.

---

# 10.6 Invitation d'un locataire

Lorsqu'un gestionnaire ajoute un locataire, le système doit pouvoir générer une invitation.

### Étapes

1. Le gestionnaire saisit les informations minimales.
2. Le système crée le profil du locataire.
3. Le profil est rattaché à l'appartement.
4. Le système génère une invitation sécurisée.
5. Le gestionnaire choisit le canal disponible.
6. Le locataire ouvre le lien.
7. Le locataire définit son mot de passe.
8. Le compte devient actif.

## Contraintes

Le lien d'invitation doit :

- être unique ;
- être sécurisé ;
- avoir une durée de validité ;
- ne pas permettre l'accès à d'autres données ;
- pouvoir être révoqué ;
- pouvoir être régénéré.

---

# 10.7 Gestion des contrats

Chaque locataire actif doit pouvoir être associé à un contrat.

## Informations minimales

- appartement ;
- locataire ;
- date de début ;
- date de fin si applicable ;
- montant du loyer ;
- montant de la caution ;
- jour d'échéance ;
- fréquence ;
- conditions particulières ;
- document associé si disponible.

## Règles

Le système doit pouvoir déterminer automatiquement :

- le montant de l'échéance ;
- sa date ;
- son statut ;
- les éventuelles charges associées.

---

# 10.8 Gestion des loyers

Le système doit créer ou calculer automatiquement les échéances de loyer selon les contrats actifs.

Chaque échéance doit comporter :

- période ;
- date d'échéance ;
- montant attendu ;
- montant payé ;
- montant restant ;
- statut.

## Statuts du loyer

Une échéance de loyer est une **créance**. Elle partage son cycle de statut avec une créance de charge — voir DEC-015.

Valeurs canoniques :

```text
UNPAID           À payer
PARTIALLY_PAID   Partiellement payé
PAID             Payé
OVERDUE          En retard
CANCELLED        Annulé
```

**« À venir » n'est pas un statut stocké.** C'est un affichage dérivé lorsque `status = UNPAID` et `due_date` est postérieure à la date du jour.

## Exemple

Loyer :

2 500 000 GNF

Paiement :

1 500 000 GNF

Le système doit afficher :

**Montant dû : 2 500 000 GNF**

**Montant payé : 1 500 000 GNF**

**Reste à payer : 1 000 000 GNF**

Statut :

**Partiellement payé**

---

# 10.9 Gestion des paiements

Le système doit supporter plusieurs moyens de paiement.

## Moyens de paiement

Valeurs canoniques — voir DEC-016 :

```text
CASH             Espèces
BANK_TRANSFER    Virement
MOBILE_MONEY     Mobile money
OTHER            Autre
```

**Au MVP, seul le paiement manuel est opérationnel.** Le paiement digital dépend de DEC-034, actuellement OUVERTE. L'architecture `PaymentProvider` est en place, aucun fournisseur n'est sélectionné.

## Informations d'un paiement

- montant et devise ;
- date ;
- moyen ;
- locataire ;
- appartement ;
- référence ;
- statut ;
- utilisateur ayant enregistré l'opération lorsqu'elle est manuelle ;
- justificatif si nécessaire.

La **période** n'est pas un attribut du paiement : elle appartient aux créances auxquelles le paiement est alloué.

## Statuts

Valeurs canoniques — voir DEC-016 :

```text
PENDING      En attente
CONFIRMED    Confirmé
FAILED       Échoué
CANCELLED    Annulé
```

`INITIATED` n'existe pas : un paiement créé et non confirmé est `PENDING`.

`REFUNDED` est hors périmètre MVP. Une correction utilise `CANCELLED` avec trace d'audit.

## Règle fondamentale

Un paiement confirmé est rattaché aux créances correspondantes par une ou plusieurs **allocations** — voir DEC-022.

Un même paiement peut couvrir à la fois une créance de loyer et une créance de charge.

Un paiement dont le montant dépasse le total dû restant est **refusé** — voir DEC-023.

---

# 10.10 Gestion des quittances

Lorsqu'un paiement est confirmé, le système doit pouvoir générer automatiquement une quittance.

La quittance doit comporter au minimum :

- numéro ;
- locataire ;
- appartement ;
- immeuble ;
- période ;
- montant ;
- date ;
- moyen de paiement ;
- référence ;
- statut.

La quittance doit pouvoir être consultée et téléchargée.

---

# 10.11 Relances

Le système doit permettre l'envoi de rappels automatiques.

## Types de rappels

### Avant échéance

Informer que l'échéance approche.

### Jour d'échéance

Informer que le paiement est attendu.

### Après échéance

Informer qu'un montant reste dû.

### Relance renforcée

Informer qu'un retard persiste.

## Canaux

Valeurs canoniques — voir DEC-027 :

```text
IN_APP      actif au MVP
SMS         défini, inactif au MVP
WHATSAPP    défini, inactif au MVP
EMAIL       défini, inactif au MVP
```

**Au MVP, les rappels et relances produisent uniquement des notifications in-app.**

Le moteur de rappels, les règles d'éligibilité et la protection anti-répétition font partie du périmètre MVP. Seuls les canaux externes sont reportés (DEC-008).

---

# 10.12 Gestion des charges communes

Le gestionnaire doit pouvoir enregistrer une charge concernant plusieurs appartements.

## Exemple

Facture d'eau :

3 600 000 GNF

12 appartements.

Le gestionnaire choisit :

**Répartition égale**

Le système calcule :

300 000 GNF par appartement.

## Méthodes de répartition

Valeurs canoniques — voir DEC-029 :

```text
EQUAL          Répartition égale        MVP
CUSTOM         Répartition personnalisée   Future Evolution
CONSUMPTION    Selon consommation          Future Evolution
```

**Le MVP implémente uniquement `EQUAL`.**

La règle d'arrondi est déterministe : le reste de la division entière est distribué à raison d'une unité par logement, dans l'ordre croissant de la référence d'appartement.

Invariant obligatoire avant publication :

```text
somme des parts = montant total de la charge
```

## Informations d'une charge

- type ;
- montant ;
- fournisseur ;
- date ;
- période ;
- immeuble ;
- justificatif ;
- méthode de répartition ;
- appartements concernés.

---

# 10.13 Affectation d'une charge au locataire

> **Décision structurante — DEC-005.**
>
> La publication d'une charge crée, pour chaque appartement concerné, une **créance de charge payable**, distincte de l'échéance de loyer.

Après calcul de la répartition, la publication crée une créance par appartement concerné, portant :

- un montant dû ;
- un montant payé ;
- un solde ;
- une date d'échéance ;
- un statut suivant le cycle `receivable_status` (DEC-015).

Exemple :

```text
Créance de loyer    septembre    2 500 000 GNF
Créance de charge   eau            300 000 GNF
------------------------------------------------
Total dû                         2 800 000 GNF
```

Le locataire voit un **montant global à payer**.

Le système conserve les **composantes séparées** :

- le loyer ;
- chaque charge ;
- le total ;
- le reste à payer par composante.

Un paiement unique peut être alloué aux deux créances — voir DEC-022.

---

# 10.14 Gestion des incidents

Un incident doit pouvoir être créé par :

- un locataire ;
- un gestionnaire ;
- éventuellement un propriétaire selon ses droits.

## Informations

- appartement ;
- catégorie ;
- description ;
- photo ;
- date ;
- priorité ;
- statut ;
- créateur.

## Catégories initiales

- plomberie ;
- électricité ;
- climatisation ;
- serrurerie ;
- bâtiment ;
- sécurité ;
- autre.

## Priorités

Valeurs canoniques — voir DEC-017 :

```text
LOW       Faible
NORMAL    Normale
URGENT    Urgente
```

## Statuts

Valeurs canoniques — voir DEC-017 :

```text
OPEN           Nouveau
ASSIGNED       Affecté
IN_PROGRESS    En cours
ON_HOLD        En attente
RESOLVED       Résolu
CLOSED         Clôturé
```

**« À traiter » n'est pas un statut.** C'est un filtre du tableau de bord gestionnaire portant sur `OPEN` et `ASSIGNED`.

L'intervention possède un cycle distinct — voir DEC-018.

---

# 10.15 Gestion des interventions

Un incident peut donner lieu à une intervention.

Le gestionnaire doit pouvoir enregistrer :

- prestataire ;
- date ;
- coût prévu ;
- coût réel ;
- description ;
- pièces justificatives ;
- photos ;
- statut.

Le coût d'une intervention doit pouvoir être automatiquement enregistré comme dépense lorsque l'utilisateur le confirme.

---

# 10.16 Gestion des dépenses

Le système doit permettre de créer des dépenses liées à un immeuble.

## Informations

- catégorie ;
- montant ;
- date ;
- fournisseur ;
- description ;
- justificatif ;
- immeuble ;
- appartement éventuellement ;
- incident ou intervention éventuellement associé.

## Exemples

- plomberie ;
- électricité ;
- gardiennage ;
- nettoyage ;
- entretien ;
- réparation ;
- achat de matériel.

---

# 10.17 Tableau de bord gestionnaire

Le gestionnaire doit pouvoir visualiser rapidement :

### Portefeuille

- nombre d'immeubles ;
- nombre de logements ;
- logements occupés ;
- logements vacants.

### Loyers

- montant attendu ;
- montant encaissé ;
- montant restant ;
- nombre d'impayés ;
- nombre de retards.

### Maintenance

- incidents ouverts ;
- incidents en cours ;
- incidents urgents ;
- incidents résolus.

### Finances

- charges ;
- dépenses ;
- paiements récents.

Le tableau de bord doit privilégier les informations nécessitant une action.

---

# 10.18 Tableau de bord propriétaire

Le propriétaire doit pouvoir consulter :

- nombre d'immeubles ;
- nombre de logements ;
- taux d'occupation ;
- revenus attendus ;
- revenus encaissés ;
- impayés ;
- dépenses ;
- charges ;
- interventions ;
- activité récente.

Le propriétaire ne doit pas être obligé de parcourir les écrans opérationnels du gestionnaire pour comprendre la situation.

---

# 10.19 Espace locataire

Le locataire doit avoir une interface minimale.

## Informations principales

- appartement ;
- prochain montant à payer ;
- date d'échéance ;
- charges ;
- historique des paiements ;
- quittances ;
- incidents.

## Actions principales

- payer ;
- consulter un reçu ;
- signaler un problème ;
- consulter un incident ;
- mettre à jour certaines informations personnelles selon les droits.

L'expérience du locataire doit être volontairement plus simple que celle du gestionnaire.

---

# 11. Gestion des permissions

Le système doit distinguer :

**Rôle**

et

**Périmètre d'accès**

Un gestionnaire peut avoir accès à :

- tous les immeubles de l'organisation ;
- ou certains immeubles uniquement.

> **Périmètre MVP — DEC-025.**
>
> Le MVP évalue les droits à partir de **deux dimensions seulement** : le **rôle** et le **périmètre d'immeubles**.
>
> La restriction par fonctionnalité au sein d'un même rôle est classée **Future Evolution**.

## Exemple MVP

```text
Gestionnaire A
Rôle    : MANAGER
Scope   : Camayenne, Kipé

Gestionnaire B
Rôle    : MANAGER
Scope   : Dixinn
```

Les deux gestionnaires disposent du même ensemble de permissions attaché au rôle `MANAGER`, appliqué uniquement à leur périmètre respectif.

Le catalogue des permissions `resource.action` est défini en code et mappé statiquement par rôle.

Le détail de la matrice figure dans le document **Roles & Permissions Matrix**.

---

# 12. Révocation des accès

## 12.1 Révocation d'un gestionnaire

Lorsqu'un propriétaire révoque un gestionnaire :

- le gestionnaire ne peut plus accéder aux ressources concernées ;
- les données historiques restent conservées ;
- les actions antérieures restent attribuées à son identité ;
- les nouveaux accès sont bloqués.

## 12.2 Révocation d'un locataire

Lorsqu'un gestionnaire désactive un locataire :

- l'accès au compte est bloqué ;
- l'appartement peut être réaffecté à un autre locataire ;
- l'historique des paiements reste disponible ;
- les anciens documents restent accessibles aux utilisateurs autorisés.

La suppression physique des données ne doit pas être utilisée comme mécanisme courant de gestion des départs.

---

# 13. Notifications

Le système doit pouvoir générer des notifications pour les événements importants.

## Propriétaire

Exemples :

- invitation acceptée par un gestionnaire ;
- gestionnaire révoqué ;
- paiement important ;
- impayé ;
- dépense importante ;
- incident urgent ;
- intervention terminée.

## Gestionnaire

Exemples :

- invitation acceptée ;
- paiement reçu ;
- impayé ;
- incident déclaré ;
- incident urgent ;
- charge créée ;
- intervention terminée.

## Locataire

Exemples :

- invitation ;
- échéance proche ;
- loyer dû ;
- retard ;
- paiement confirmé ;
- quittance disponible ;
- charge créée ;
- incident mis à jour.

---

# 14. Recherche et filtres

Le système doit prévoir des recherches simples.

Le gestionnaire doit pouvoir rechercher notamment par :

- nom ;
- numéro de téléphone ;
- appartement ;
- immeuble ;
- référence de paiement.

Des filtres doivent être disponibles pour :

- statut ;
- période ;
- immeuble ;
- appartement ;
- locataire ;
- type d'incident ;
- statut de paiement.

---

# 15. Documents et justificatifs

Le produit doit permettre d'attacher des documents ou images aux entités concernées.

Exemples :

- contrat ;
- facture ;
- reçu ;
- photo d'incident ;
- justificatif de dépense ;
- document d'intervention.

Chaque document doit être rattaché à une entité identifiable.

Exemple :

**Facture plomberie**

→ Immeuble Camayenne  
→ Appartement A04  
→ Incident #024

---

# 16. Historique et journal d'activité

Le système doit conserver un journal d'activité.

Exemples :

> 05/09/2026 à 09:14  
> Mamadou Diallo a enregistré un paiement de 2 500 000 GNF pour A04.

> 08/09/2026 à 14:42  
> Le locataire de A04 a déclaré un incident plomberie.

> 09/09/2026 à 10:15  
> Le gestionnaire a clôturé l'incident.

Le journal doit être exploitable à des fins de suivi, de contrôle et de support.

---

# 17. États et transitions

Les principales entités doivent suivre des états contrôlés.

## 17.1 Appartement

```text
VACANT
   ↓          (bail activé)
OCCUPIED
   ↓          (bail terminé)
VACANT
```

`MAINTENANCE` peut être positionné depuis `VACANT` ou `OCCUPIED` selon la situation réelle.

« Ancien locataire » n'est pas un statut d'appartement : c'est l'état de la relation locative, porté par `leases.status = ENDED`.

## 17.2 Invitation

```text
Créée
   ↓
Envoyée
   ↓
Acceptée
   ↓
Active
```

ou :

```text
Envoyée
   ↓
Expirée
   ↓
Renvoyée
```

## 17.3 Paiement

```text
PENDING
   ↓
CONFIRMED
```

ou :

```text
PENDING
   ↓
FAILED | CANCELLED
```

Le passage à `CONFIRMED` ne peut jamais provenir du frontend — voir DEC-009.

## 17.4 Incident

```text
OPEN
   ↓
ASSIGNED
   ↓
IN_PROGRESS
   ↓
RESOLVED
   ↓
CLOSED
```

`ON_HOLD` peut s'intercaler entre `ASSIGNED`/`IN_PROGRESS` et la suite.

La liste exhaustive des transitions autorisées est définie par DEC-017 et doit être appliquée par le backend.

## 17.5 Intervention

```text
PLANNED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

ou :

```text
PLANNED | IN_PROGRESS
   ↓
CANCELLED
```

Voir DEC-018. La clôture d'une intervention ne clôture pas automatiquement l'incident.

## 17.6 Créance (loyer et charge)

```text
UNPAID
   ↓
PARTIALLY_PAID
   ↓
PAID
```

ou :

```text
UNPAID | PARTIALLY_PAID
   ↓
OVERDUE      (date d'échéance dépassée avec solde restant)
```

Voir DEC-015.

Ces transitions sont détaillées dans le document Business Rules.

---

# 18. Exigences UX

Le produit doit respecter des principes UX stricts.

## 18.1 Réduire le nombre d'étapes

Une tâche courante doit pouvoir être accomplie avec le minimum d'actions possible.

## 18.2 Ne pas demander ce que le système connaît déjà

Exemple :

Lorsqu'un locataire active son compte, son appartement et son immeuble doivent déjà être connus.

## 18.3 Montrer les actions prioritaires

Les informations nécessitant une action doivent être visibles immédiatement.

## 18.4 Utiliser un langage simple

Éviter les termes techniques inutiles.

Préférer :

**Loyer en retard**

à :

**Créance locative échue non régularisée**

## 18.5 Prévenir les erreurs

Les actions critiques doivent être confirmées.

Exemple :

Avant la révocation d'un gestionnaire :

> Retirer l'accès de ce gestionnaire ?

Le système doit expliquer clairement la conséquence.

---

# 19. Exigences mobile

L'utilisation mobile est prioritaire.

Le produit doit être utilisable sur des smartphones courants.

Les actions suivantes doivent être particulièrement optimisées :

- enregistrer un paiement ;
- consulter un loyer ;
- envoyer une relance ;
- inviter un locataire ;
- déclarer un incident ;
- ajouter une photo ;
- consulter un reçu.

Les interfaces doivent tenir compte des connexions parfois limitées.

---

# 20. Résilience et connectivité

Le produit doit être conçu pour fonctionner correctement dans des conditions de réseau variables.

Lorsque cela est possible, les fonctionnalités doivent :

- limiter les transferts inutiles ;
- compresser les images ;
- éviter les écrans inutilement lourds ;
- conserver temporairement certaines données non sensibles ;
- informer clairement l'utilisateur lorsqu'une action est en attente de synchronisation.

La stratégie hors ligne complète pourra être étudiée après validation du MVP.

---

# 21. Sécurité fonctionnelle

Le système doit notamment garantir :

- authentification sécurisée ;
- autorisation par rôle ;
- isolation des données entre organisations ;
- accès limité au périmètre de l'utilisateur ;
- liens d'invitation sécurisés ;
- expiration des invitations ;
- protection des documents ;
- journalisation des actions sensibles.

Un utilisateur ne doit jamais pouvoir accéder à des informations uniquement en modifiant une URL ou un identifiant côté client.

---

# 22. Règles principales d'isolation des données

Une organisation ne doit jamais pouvoir voir les données d'une autre organisation.

Un gestionnaire ne doit voir que les immeubles auxquels il a accès.

Un locataire ne doit voir que :

- son propre compte ;
- son appartement ;
- son contrat ;
- ses paiements ;
- ses charges ;
- ses incidents ;
- ses documents autorisés.

---

# 23. Performance attendue

Les actions courantes doivent donner une réponse rapide.

Les principales vues doivent charger rapidement sur une connexion mobile normale.

Les opérations lourdes telles que :

- génération de rapports ;
- traitement d'import ;
- génération de documents ;
- traitement d'images ;

peuvent être exécutées de manière asynchrone si nécessaire.

L'utilisateur doit cependant toujours connaître l'état de l'opération.

---

# 24. Principes de fiabilité financière

Les données financières doivent être traitées avec une attention particulière.

Le système ne doit pas modifier silencieusement une transaction.

Toute correction importante doit être traçable.

## Convention monétaire

Convention unique — voir DEC-014 :

```text
amount    entier signé, exprimé dans la plus petite unité de la devise
currency  code ISO 4217 explicite
```

Pour le GNF, l'exposant de sous-unité est 0.

```text
2 500 000 GNF  ->  amount = 2500000, currency = 'GNF'
```

Règles :

- aucun nombre à virgule flottante dans un calcul financier ;
- aucune addition implicite entre devises différentes ;
- le formatage d'affichage relève exclusivement du frontend.

Pour le marché initial, le GNF constitue la devise unique, mais chaque montant porte sa devise afin de ne pas bloquer une future évolution multidevise.

---

# 25. Critères de réussite du MVP

Le MVP sera considéré comme fonctionnel lorsqu'un utilisateur pourra réaliser le parcours suivant sans intervention technique :

### Propriétaire

1. Créer son compte.
2. Créer un immeuble.
3. Créer les appartements.
4. Inviter un gestionnaire.
5. Consulter l'état de l'immeuble.

### Gestionnaire

1. Accepter son invitation.
2. Accéder à l'immeuble.
3. Ajouter les locataires.
4. Inviter les locataires.
5. Configurer les loyers.
6. Suivre les échéances.
7. Enregistrer les paiements.
8. Envoyer des relances.
9. Créer une charge commune.
10. Déclarer ou traiter un incident.
11. Enregistrer une dépense.

### Locataire

1. Recevoir l'invitation.
2. Activer son compte.
3. Consulter son loyer.
4. Consulter ses charges.
5. Consulter son historique.
6. Effectuer ou déclarer un paiement selon les moyens disponibles.
7. Consulter sa quittance.
8. Signaler un incident.

### Propriétaire

Le propriétaire doit ensuite pouvoir retrouver l'information créée par le gestionnaire et consulter l'état réel de son patrimoine.

---

# 26. Critères UX du MVP

Le MVP doit notamment respecter les critères suivants :

- aucune inscription complexe pour les gestionnaires invités ;
- aucune inscription complexe pour les locataires invités ;
- aucune donnée importante ne doit être demandée deux fois ;
- les actions principales doivent être clairement visibles ;
- les erreurs doivent être compréhensibles ;
- les conséquences des actions sensibles doivent être explicites ;
- le tableau de bord doit permettre de comprendre la situation rapidement ;
- l'expérience mobile doit être prioritaire ;
- les informations doivent être cohérentes entre les différents rôles.

---

# 27. MVP versus version future

## MVP

Le produit doit permettre :

**Immeubles**

**Appartements**

**Locataires**

**Contrats**

**Loyers**

**Paiements**

**Quittances**

**Relances**

**Charges communes**

**Incidents**

**Travaux**

**Dépenses**

**Tableaux de bord**

**Invitations**

**Permissions**

**Historique**

## Version future

Pourront être étudiés :

- comptabilité avancée ;
- gestion de copropriété ;
- automatisation bancaire avancée ;
- marketplace de prestataires ;
- gestion documentaire avancée ;
- scoring ;
- prédiction des impayés ;
- intégration de services financiers ;
- gestion multi-pays ;
- API publique ;
- intégrations partenaires ;
- automatisations avancées.

---

# 28. Dépendances fonctionnelles

Certaines fonctionnalités dépendent d'autres composants.

Exemples :

**Quittance**

dépend de :

Paiement confirmé  
→ Locataire  
→ Contrat  
→ Appartement  
→ Immeuble

**Charge locataire**

dépend de :

Facture  
→ Méthode de répartition  
→ Appartement  
→ Locataire

**Dépense de maintenance**

dépend de :

Incident  
→ Intervention  
→ Montant  
→ Immeuble

Cette logique devra être maintenue dans les prochaines spécifications.

---

# 29. Principes de conception du système

Le produit doit être construit autour de quelques règles fondamentales :

### Source de vérité unique

Un paiement doit exister une seule fois dans le système.

### Relations explicites

Chaque donnée doit être reliée à son contexte.

### Historique immuable

Les opérations passées doivent rester traçables.

### Permissions centralisées

Les accès doivent être déterminés par le rôle et le périmètre autorisé.

### Automatisation

Les opérations prévisibles doivent être exécutées automatiquement.

### Simplicité

La complexité technique doit être masquée derrière une interface simple.

---

# 30. Résumé du PRD

Le MVP est un SaaS multi-utilisateurs organisé autour de trois rôles :

**Propriétaire → Gestionnaire → Locataire**

Le propriétaire crée son espace et contrôle les accès.

Le gestionnaire gère les immeubles, appartements, locataires, loyers, paiements, charges, incidents et dépenses.

Le locataire reçoit une invitation et accède uniquement à son propre espace.

Le système doit centraliser l'information, automatiser les opérations répétitives, assurer la traçabilité et offrir une expérience mobile simple.

Le produit ne doit pas chercher à résoudre tous les problèmes de l'immobilier dès sa première version.

Sa première mission est de transformer la gestion quotidienne d'un immeuble en un processus numérique clair, structuré et facilement pilotable.

> **Le système doit être capable de gérer une grande complexité sans jamais imposer cette complexité à l'utilisateur.**