# User Flows & Parcours utilisateurs

## 1. Objet du document

Ce document décrit les principaux parcours utilisateurs du produit de gestion d'immeubles.

Il complète le Product Requirements Document en répondant à une question différente :

> **Que se passe-t-il concrètement lorsqu'un utilisateur veut accomplir une tâche ?**

Le document sert à :

- valider la logique fonctionnelle avant la conception des interfaces ;
- identifier les étapes inutiles ;
- repérer les informations nécessaires à chaque étape ;
- définir les transitions entre propriétaires, gestionnaires et locataires ;
- prévoir les cas d'erreur et les situations particulières ;
- préparer l'architecture de l'information et les wireframes.

Le principe général reste :

> **Une expérience simple pour l'utilisateur, une logique robuste en arrière-plan.**

---

# 2. Principes de parcours

Les parcours du produit doivent respecter les règles suivantes.

## 2.1 Invitation avant inscription

Les utilisateurs secondaires ne doivent pas avoir à découvrir le produit seuls.

Le système doit les rattacher à leur contexte avant leur première connexion.

Le parcours privilégié est :

**Création → Invitation → Activation → Utilisation**

---

## 2.2 Préremplissage maximal

Lorsque le système connaît déjà une information, elle doit être préremplie.

Exemple :

Le gestionnaire crée :

> Mamadou Diallo  
> Appartement A04  
> Loyer : 2 500 000 GNF

Lorsque Mamadou active son compte, il ne doit pas recommencer à renseigner ces informations.

---

## 2.3 Une action principale par étape

Chaque étape doit avoir une action principale clairement identifiable.

Exemple :

> **Inviter le gestionnaire**

plutôt que plusieurs actions concurrentes.

---

## 2.4 Les erreurs doivent être récupérables

Une erreur ne doit pas obliger l'utilisateur à recommencer tout le parcours.

Exemple :

Une invitation envoyée à un mauvais numéro doit pouvoir être annulée et renvoyée à un autre numéro.

---

## 2.5 Les actions critiques nécessitent une confirmation

Les actions ayant une conséquence importante doivent être confirmées.

Exemple :

> Révoquer l'accès de ce gestionnaire ?

Le système doit expliquer ce qui va se passer.

---

# 3. Parcours global du produit

Le parcours principal du système est :

```text
PROPRIÉTAIRE
    │
    ├── crée son espace
    │
    ├── crée son immeuble
    │
    └── invite un gestionnaire
              │
              ▼
         GESTIONNAIRE
              │
              ├── accepte l'invitation
              │
              ├── configure les appartements
              │
              ├── ajoute les locataires
              │
              └── invite les locataires
                        │
                        ▼
                    LOCATAIRE
                        │
                        ├── accepte l'invitation
                        ├── active son accès
                        ├── consulte son logement
                        ├── consulte ce qu'il doit
                        ├── paie
                        └── signale des incidents
```

À partir de là, chaque événement enrichit automatiquement les données visibles par les autres rôles.

---

# 4. Parcours 1 : Création du compte propriétaire

## Objectif

Permettre à un propriétaire de créer son espace sans configuration inutile.

## Déclencheur

Le propriétaire souhaite utiliser le produit pour gérer son patrimoine.

## Étapes

### Étape 1

Le propriétaire accède au produit.

### Étape 2

Il renseigne les informations minimales nécessaires :

- nom ;
- téléphone ou email ;
- mot de passe.

### Étape 3

Le système vérifie les coordonnées selon le mécanisme d'authentification retenu.

### Étape 4

Le compte est créé.

### Étape 5

Le propriétaire arrive dans son espace vide.

Le système lui propose immédiatement :

> **Ajouter mon premier immeuble**

## Résultat

Le propriétaire dispose d'un espace opérationnel sans devoir remplir un long profil.

---

# 5. Parcours 2 : Création du premier immeuble

## Objectif

Créer rapidement le premier patrimoine géré.

## Déclencheur

Le propriétaire vient de créer son compte.

## Étapes

### Étape 1

Le propriétaire sélectionne :

> Ajouter un immeuble

### Étape 2

Il renseigne :

- nom ou identifiant de l'immeuble ;
- adresse ;
- ville ;
- quartier ;
- nombre de logements ou structure du bâtiment.

### Étape 3

Le système crée l'immeuble.

### Étape 4

Le système propose immédiatement :

> Ajouter les appartements

### Étape 5

Le propriétaire peut :

- créer les appartements un par un ;
- ou utiliser une création groupée lorsque cela est pertinent.

## Résultat

L'immeuble existe dans le système avec sa structure initiale.

---

# 6. Parcours 3 : Ajouter les appartements

## Objectif

Construire la structure locative de l'immeuble.

## Étapes

Le propriétaire ou un gestionnaire autorisé sélectionne :

> Ajouter un appartement

Il renseigne notamment :

- numéro ou identifiant ;
- étage ;
- type éventuel ;
- loyer par défaut éventuel ;
- statut.

Le système crée le logement.

## Création rapide

Pour un immeuble de 20 appartements, le produit doit éviter d'imposer 20 formulaires complexes.

Il doit permettre une logique rapide :

> A01, A02, A03, A04...

Puis l'utilisateur complète les détails lorsque nécessaire.

## Résultat

La résidence possède sa structure complète.

---

# 7. Parcours 4 : Inviter un gestionnaire

## Objectif

Permettre au propriétaire de déléguer la gestion sans création libre de compte.

## Déclencheur

Le propriétaire souhaite qu'une autre personne gère l'immeuble.

## Étapes

### Étape 1

Le propriétaire sélectionne :

> Ajouter un gestionnaire

### Étape 2

Il renseigne :

- nom ;
- numéro de téléphone ;
- email éventuellement.

### Étape 3

Il sélectionne les immeubles concernés.

Exemple :

**Camayenne**
**Kipé**

Au moins un immeuble. Une action « Tout sélectionner » coche tous les immeubles existants, sans que les immeubles créés plus tard s'ajoutent d'eux-mêmes (DEC-042).

### Étape 4

Il choisit le niveau d'accès si plusieurs niveaux sont disponibles.

Au MVP il n'existe qu'un niveau (DEC-025) : cette étape est absente de l'écran.

### Étape 5

Il sélectionne :

> Créer l'invitation

Le libellé dit « créer » et non « envoyer » : aucun envoi automatique n'a lieu au MVP (DEC-026).

### Étape 6

Le système crée une invitation unique, valable 7 jours par défaut (DEC-045).

### Étape 7

Le système affiche le lien d'invitation, **une seule fois**, avec une action pour le copier. Le propriétaire le transmet lui-même, par WhatsApp, SMS ou en personne.

Un lien perdu se renvoie depuis la liste des gestionnaires : le jeton n'est stocké que haché et ne peut pas être réaffiché.

## Résultat

Le gestionnaire existe dans le système mais son compte n'est pleinement actif qu'après activation.

---

# 8. Parcours 5 : Activation du compte gestionnaire

## Objectif

Permettre au gestionnaire invité de commencer rapidement son travail.

## Étapes

### Étape 1

Le gestionnaire reçoit une invitation.

Exemple :

> Vous avez été invité à gérer Résidence Camayenne.

### Étape 2

Il ouvre le lien.

### Étape 3

Le système reconnaît l'invitation.

Il affiche notamment :

- le nom du propriétaire ou de l'organisation ;
- le ou les immeubles concernés ;
- son rôle.

### Étape 4

Le gestionnaire définit son mot de passe.

### Étape 5

Le compte est activé.

### Étape 6

Il arrive directement dans son environnement de gestion.

Il ne doit pas devoir recréer :

- son immeuble ;
- son propriétaire ;
- son rôle ;
- ses droits.

## Résultat

Le gestionnaire est immédiatement opérationnel.

---

# 9. Parcours 6 : Premier démarrage du gestionnaire

## Objectif

Transformer un compte activé en environnement exploitable.

## Premier accès

Le système peut afficher une progression simple :

**Votre immeuble est prêt**

1. Vérifier les appartements
2. Ajouter les locataires
3. Configurer les loyers
4. Commencer la gestion

Le système ne doit pas obliger l'utilisateur à terminer toute la configuration avant de pouvoir utiliser le reste du produit.

## Résultat

Le gestionnaire comprend immédiatement ce qu'il doit faire ensuite.

---

# 10. Parcours 7 : Ajouter un locataire

## Objectif

Permettre au gestionnaire d'intégrer progressivement les locataires existants.

## Portée : ce parcours est scindé en deux lots (DEC-046)

Au Lot 7, « ajouter un locataire » veut dire **inviter une personne à l'espace locataire d'un logement désigné**. Rien de plus. La relation locative elle-même, avec sa date d'entrée et son loyer, naît du bail au Lot 8.

| Élément | Lot 7 Locataires | Lot 8 Contrats |
| --- | --- | --- |
| Nom, téléphone, email facultatif | Saisis à l'invitation | Repris, non ressaisis |
| Logement désigné | Saisi à l'invitation | Repris par le bail |
| Date d'entrée | Hors périmètre | Saisie au bail |
| Montant du loyer | Hors périmètre | Saisi au bail |
| Informations du contrat | Hors périmètre | Saisies au bail |

> **Pourquoi cette frontière.** Le périmètre d'un gestionnaire sur un locataire ne peut se résoudre que par le logement : au Lot 7, c'est l'invitation seule qui le porte. Mêler le loyer à l'invitation obligerait à créer un embryon de bail sans en avoir les règles.

## Déclencheur

Le gestionnaire veut donner à une personne l'accès à l'espace locataire d'un de ses logements.

## Étapes au Lot 7

### Étape 1

Le gestionnaire sélectionne un logement de son périmètre. Le logement n'a pas besoin d'être vacant : ce parcours sert précisément à inscrire des locataires déjà en place.

### Étape 2

Il sélectionne :

> Inviter un locataire

### Étape 3

Il renseigne le minimum :

- nom ;
- numéro de téléphone ;
- éventuellement email.

Le logement est déjà connu du formulaire, puisque le parcours part de lui.

### Étape 4

Le système crée l'invitation et affiche le lien de partage sécurisé (DEC-026). Sa transmission suit le parcours 8.

### Étape 5

Le système rattache l'invitation :

**Invitation → Logement → Immeuble → Organisation**

L'invitation **ne change aucun statut d'occupation** : le logement garde le statut qu'il avait, et ce statut ne deviendra dérivé de la relation locative qu'au Lot 8 (DEC-050).

## Résultat au Lot 7

Le locataire figure dans la liste des locataires du logement avant même d'avoir activé son compte, au statut « Invité ». Son espace locataire ne porte aucune donnée financière : celles-ci n'existeront qu'avec le bail.

## Suite au Lot 8

Créer le bail apporte la date d'entrée, le montant du loyer et les informations du contrat. Deux points y seront traités et ne le sont donc pas ici :

- une seule relation locative active par organisation pour une même personne (DEC-049), règle du bail et non de l'invitation ;
- créer un bail doit pouvoir créer la personne sans invitation, pour le locataire qui n'utilisera jamais l'application (DEC-046).

---

# 11. Parcours 8 : Invitation du locataire

## Objectif

Permettre au gestionnaire d'intégrer un locataire sans lui demander de rechercher ou télécharger le produit.

## Étapes

Le gestionnaire choisit :

> Inviter le locataire

> **Au MVP, DEC-026** : le système génère un **lien de partage sécurisé**.

```text
Le système crée l'invitation et affiche le lien.
Le gestionnaire copie le lien en un geste.
Le gestionnaire le transmet par son propre moyen :
WhatsApp, SMS, ou en personne.
```

L'interface affiche ensuite l'état de l'invitation : envoyée, ouverte, acceptée, expirée.

L'envoi automatique par SMS et WhatsApp est reporté (DEC-008) et sera branché derrière `NotificationProvider` sans modifier ce parcours.

## Message conceptuel

> Bonjour Mamadou.  
> Votre espace locataire pour Résidence Camayenne est prêt.  
> Cliquez ici pour activer votre accès.

## Résultat

Le locataire reçoit un accès contextualisé.

---

# 12. Parcours 9 : Activation du compte locataire

## Objectif

Permettre au locataire de rejoindre le système avec un minimum d'effort.

## Étapes

### Étape 1

Le locataire clique sur le lien.

### Étape 2

Le système vérifie l'invitation.

### Étape 3

Le système affiche les informations déjà connues :

- nom ;
- résidence ;
- appartement.

### Étape 4

Le locataire définit son mot de passe.

### Étape 5

Le compte est activé.

### Étape 6

Le locataire arrive directement sur son espace.

## Résultat

Le locataire peut immédiatement voir ce qui le concerne.

---

# 13. Parcours 10 : Connexion quotidienne du locataire

## Objectif

Rendre l'utilisation très simple.

Après connexion, le locataire doit voir immédiatement :

- son logement ;
- le montant actuel à payer ;
- la prochaine échéance ;
- son dernier paiement ;
- ses éventuels incidents.

L'écran d'accueil doit prioriser les actions.

Exemple :

> **À payer**
>
> 2 800 000 GNF
>
> Échéance : 5 septembre
>
> **Payer**

---

# 14. Parcours 11 : Configuration du loyer

## Objectif

Créer la base permettant le suivi mensuel.

## Déclencheur

Le locataire est ajouté et son contrat est créé.

## Étapes

Le gestionnaire renseigne ou valide :

- montant ;
- date d'échéance ;
- périodicité ;
- date de début ;
- autres paramètres nécessaires.

Le système crée ensuite automatiquement les échéances selon les règles définies.

## Résultat

Le gestionnaire n'a pas besoin de créer manuellement le loyer chaque mois.

---

# 15. Parcours 12 : Génération mensuelle d'une échéance

## Objectif

Automatiser la préparation des loyers.

À l'arrivée de la nouvelle période, le système génère les montants dus pour les contrats actifs.

Pour chaque logement :

> Loyer septembre 2026  
> Montant : 2 500 000 GNF  
> Échéance : 05/09/2026

Le système peut également intégrer les charges déjà publiées.

---

# 16. Parcours 13 : Notification d'échéance

## Objectif

Informer le locataire avant qu'un retard n'existe.

Selon les paramètres configurés :

- plusieurs jours avant l'échéance ;
- le jour de l'échéance ;
- après l'échéance.

Le système envoie automatiquement une notification.

Le locataire peut ouvrir directement son espace depuis la notification.

---

# 17. Parcours 14 : Paiement du loyer

## Objectif

Permettre au locataire de régler une somme due simplement.

## Étapes

### Étape 1

Le locataire ouvre son espace.

Il voit son **total dû**, composé de ses créances ouvertes (DEC-005) :

> **Total à payer : 2 800 000 GNF**
>
> Loyer septembre : 2 500 000 GNF, À payer
> Eau septembre : 300 000 GNF, À payer

Le total est l'information principale. Les composantes restent consultables.

### Étape 2

Il sélectionne :

> Payer

### Étape 3

Le système lui présente les moyens disponibles.

### Étape 4

Il effectue le paiement.

### Étape 5

Le système reçoit la confirmation du paiement.

### Étape 6

Les créances réglées passent à :

> **Payé**

Le paiement est alloué aux créances concernées selon un ordre déterministe : échéance croissante, loyer avant charge (DEC-022).

Un paiement unique peut donc solder à la fois le loyer et la charge.

### Étape 7

Une quittance est générée.

### Étape 8

Le locataire reçoit une confirmation.

## Résultat

Le gestionnaire et le propriétaire voient également le paiement mis à jour selon leurs droits.

---

# 18. Parcours 15 : Paiement partiel

## Cas

Le locataire doit :

2 800 000 GNF

Il paie :

1 500 000 GNF.

Le système ne doit pas considérer la dette comme entièrement réglée.

Il doit afficher :

> Total dû : 2 800 000 GNF  
> Payé : 1 500 000 GNF  
> Reste : 1 300 000 GNF

Avec la ventilation par créance :

```text
Loyer septembre   payé 1 500 000   reste 1 000 000   Partiellement payé
Eau septembre     payé         0   reste   300 000   À payer
```

Le solde reste dû sur chaque créance concernée.

> **DEC-023** : un paiement supérieur au total dû est refusé. Il n'existe ni crédit ni trop-perçu au MVP.

---

# 19. Parcours 16 : Enregistrement d'un paiement manuel

## Cas

Le locataire paie en espèces.

## Étapes

Le gestionnaire sélectionne :

> Enregistrer un paiement

Puis :

- locataire ;
- période ;
- montant ;
- moyen de paiement ;
- date ;
- référence ou note éventuelle.

Il valide.

Le système met à jour l'échéance.

La quittance est générée de la même manière que pour un paiement numérique.

## Principe

Pour le reste du système, peu importe que le paiement ait été effectué en espèces ou numériquement.

Le système doit conserver la différence comme information du paiement, mais utiliser la même logique comptable de suivi.

---

# 20. Parcours 17 : Relance d'un locataire

## Déclencheur

Le loyer arrive à échéance sans paiement complet.

Le système peut générer automatiquement une relance.

Le gestionnaire peut également déclencher une relance manuelle.

## Étapes

Gestionnaire :

> Loyers → En retard → sélectionner le locataire → Relancer

Le système utilise les informations connues.

Il n'est pas nécessaire pour le gestionnaire de retaper le montant ou le nom.

---

# 21. Parcours 18 : Création d'une facture commune

## Exemple

L'immeuble reçoit une facture d'eau :

**3 600 000 GNF**

## Étapes

### Étape 1

Le gestionnaire sélectionne :

> Nouvelle charge

### Étape 2

Il choisit :

> Eau

### Étape 3

Il renseigne :

- montant ;
- période ;
- facture ;
- immeuble.

### Étape 4

Il choisit la méthode de répartition.

Exemple :

> Répartition égale

### Étape 5

Le système calcule automatiquement la part de chaque appartement.

12 appartements :

**300 000 GNF chacun**

### Étape 6

Le gestionnaire vérifie.

### Étape 7

Il sélectionne :

> Publier

## Résultat

Chaque locataire concerné voit apparaître sa part.

---

# 22. Parcours 19 : Modification ou correction d'une charge

Le gestionnaire peut découvrir une erreur avant publication.

Il peut alors modifier la charge.

Après publication, une modification importante doit nécessiter une confirmation et être enregistrée dans l'historique.

Le système doit empêcher une correction silencieuse susceptible de modifier les montants sans trace.

---

# 23. Parcours 20 : Signalement d'un incident par le locataire

## Objectif

Permettre au locataire de déclarer un problème sans devoir appeler ou envoyer plusieurs messages.

## Étapes

### Étape 1

Le locataire sélectionne :

> Signaler un problème

### Étape 2

Il choisit une catégorie :

- plomberie ;
- électricité ;
- climatisation ;
- serrurerie ;
- autre.

### Étape 3

Il décrit le problème.

### Étape 4

Il ajoute éventuellement une photo.

### Étape 5

Il envoie.

## Résultat

Le système crée automatiquement :

**Incident**

rattaché à :

**Locataire → Appartement → Immeuble**

Le gestionnaire reçoit une notification.

---

# 24. Parcours 21 : Traitement d'un incident

## Étapes

Le gestionnaire ouvre l'incident.

Il peut :

- consulter les détails ;
- changer le statut ;
- définir la priorité ;
- ajouter un commentaire ;
- assigner une personne ;
- enregistrer une intervention.

## Exemple

Statut initial :

**Nouveau**

Puis :

**À traiter**

Puis :

**En cours**

Puis :

**Résolu**

Puis :

**Clôturé**

---

# 25. Parcours 22 : Création d'une intervention

Le gestionnaire associe une intervention à l'incident.

Informations :

- prestataire ;
- date ;
- coût prévu ;
- description.

Après intervention :

- coût réel ;
- photos ;
- justificatif ;
- commentaire.

Le gestionnaire clôture l'intervention.

## Résultat

L'historique de l'appartement est enrichi.

---

# 26. Parcours 23 : Enregistrement d'une dépense

## Cas

Un plombier demande :

**450 000 GNF**

Le gestionnaire crée la dépense.

Il renseigne :

- catégorie : plomberie ;
- montant ;
- date ;
- prestataire ;
- immeuble ;
- incident associé.

Le système comptabilise cette opération dans les dépenses de l'immeuble.

---

# 27. Parcours 24 : Consultation du patrimoine par le propriétaire

Le propriétaire se connecte.

Il voit directement :

### Mes immeubles

Camayenne  
12 logements

Kipé  
18 logements

Il peut ensuite sélectionner un immeuble.

Il retrouve :

- occupation ;
- revenus ;
- impayés ;
- dépenses ;
- charges ;
- incidents ;
- activité récente.

Le propriétaire doit pouvoir aller du résumé au détail sans demander d'information au gestionnaire.

---

# 28. Parcours 25 : Révocation d'un gestionnaire

## Déclencheur

Le propriétaire souhaite retirer l'accès d'un gestionnaire.

## Étapes

### Étape 1

Le propriétaire ouvre le profil du gestionnaire.

### Étape 2

Il sélectionne :

> Révoquer l'accès

### Étape 3

Le système affiche clairement la conséquence :

> Ce gestionnaire ne pourra plus accéder aux immeubles concernés. Les données historiques seront conservées.

### Étape 4

Le propriétaire confirme.

### Étape 5

L'accès est immédiatement bloqué.

## Résultat

Le gestionnaire ne peut plus consulter ou modifier les ressources concernées.

Son historique d'actions reste conservé.

---

# 29. Parcours 26 : Révocation d'un locataire

## Cas

Un locataire quitte l'appartement.

Le gestionnaire doit pouvoir :

1. mettre fin au contrat ;
2. désactiver son accès ;
3. conserver son historique ;
4. libérer l'appartement ;
5. préparer l'arrivée d'un nouveau locataire.

## Résultat

L'appartement passe par exemple de :

**Occupé**

à :

**Vacant**

Le locataire devient un ancien locataire.

Son historique reste associé au logement.

---

# 30. Parcours 27 : Changement de locataire

## Cas

Le locataire A quitte A04.

Le locataire B arrive.

## Étapes

### Étape 1

Le gestionnaire clôture le contrat du locataire A.

### Étape 2

Le système conserve :

- les anciens loyers ;
- les paiements ;
- les charges ;
- les incidents ;
- les documents.

### Étape 3

L'appartement passe à l'état vacant.

### Étape 4

Le gestionnaire ajoute le locataire B.

### Étape 5

Il crée son contrat.

### Étape 6

Il envoie l'invitation.

## Résultat

Le nouvel occupant démarre avec un espace propre sans effacer l'historique du précédent.

---

# 31. Parcours 28 : Réinvitation d'un utilisateur

## Cas

Une invitation n'a pas été acceptée ou a expiré.

Le gestionnaire ou propriétaire autorisé doit pouvoir sélectionner :

> Renvoyer l'invitation

Le système génère un nouveau lien si nécessaire.

L'ancien lien devient invalide.

---

# 32. Parcours 29 : Invitation envoyée au mauvais numéro

## Cas

Le gestionnaire saisit un mauvais numéro.

Le compte n'a pas encore été activé.

Le gestionnaire doit pouvoir :

- annuler l'invitation ;
- corriger le numéro ;
- renvoyer une nouvelle invitation.

Aucune donnée historique ne doit être détruite simplement à cause de la correction du contact.

---

# 33. Parcours 30 : Utilisateur déjà existant

## Cas

Un locataire possède déjà un compte dans le système.

Le gestionnaire l'ajoute à un nouvel appartement ou à un nouvel immeuble autorisé.

Le système doit détecter que le numéro existe déjà.

Il ne doit pas créer inutilement un deuxième compte.

Il doit proposer :

> Utiliser le compte existant ?

Le rattachement est alors effectué selon les permissions et les règles applicables.

---

# 34. Parcours 31 : Mot de passe oublié

Un utilisateur sélectionne :

> Mot de passe oublié

Il renseigne le moyen de récupération disponible.

Le système lui permet de définir un nouveau mot de passe après vérification.

Le changement de mot de passe ne doit pas modifier :

- ses données ;
- son rôle ;
- ses relations ;
- son historique.

---

# 35. Parcours 32 : Changement de numéro de téléphone

Le changement de numéro doit être traité comme une opération sensible.

Le système doit demander une vérification du nouveau numéro.

Une fois la vérification réussie :

- le nouveau numéro devient le contact principal ;
- les anciennes invitations éventuellement liées deviennent invalides ;
- les données restent inchangées.

---

# 36. Parcours 33 : Perte d'accès d'un gestionnaire

## Cas

Un gestionnaire ne travaille plus pour le propriétaire.

Le propriétaire révoque son accès.

Le système doit :

- bloquer immédiatement la connexion ou l'accès aux ressources ;
- conserver son identité historique ;
- conserver ses actions passées ;
- ne pas supprimer les données qu'il a créées.

Les ressources restent sous le contrôle du propriétaire.

---

# 37. Parcours 34 : Plusieurs gestionnaires sur un même immeuble

Le produit doit pouvoir supporter plusieurs gestionnaires.

Exemple :

**Résidence Camayenne**

Gestionnaire principal : Mamadou  
Gestionnaire secondaire : Ibrahima

Les deux peuvent avoir des permissions identiques ou différentes.

Le système doit clairement indiquer les responsabilités et les accès.

---

# 38. Parcours 35 : Un gestionnaire sur plusieurs immeubles

Un gestionnaire peut gérer :

- Camayenne ;
- Kipé ;
- Dixinn.

À la connexion, il doit pouvoir naviguer facilement entre ces immeubles.

Le tableau de bord doit présenter :

**Mon portefeuille**

puis permettre de basculer vers chaque immeuble.

---

# 39. Parcours 36 : Un propriétaire qui gère lui-même son immeuble

Le produit ne doit pas obliger le propriétaire à créer un gestionnaire lorsqu'il souhaite tout gérer lui-même.

Il peut :

1. créer son immeuble ;
2. ajouter les appartements ;
3. ajouter les locataires ;
4. gérer directement les loyers ;
5. gérer les incidents.

Dans ce cas, le propriétaire dispose également des fonctions opérationnelles nécessaires.

---

# 40. Parcours 37 : Vue d'ensemble mensuelle

Le système doit être capable de reconstituer automatiquement la situation d'un immeuble pour une période donnée.

Exemple :

### Septembre 2026

Loyers attendus : 30 000 000 GNF

Loyers encaissés : 27 500 000 GNF

Reste à encaisser : 2 500 000 GNF

Charges : 3 600 000 GNF

Dépenses : 2 450 000 GNF

Incidents : 4

Résolus : 3

Cette information doit être calculée à partir des données existantes, sans double saisie.

---

# 41. Parcours 38 : Du résumé au détail

Le produit doit toujours permettre une navigation descendante.

Exemple :

**27 500 000 GNF encaissés**

↓

Liste des paiements

↓

**Mamadou Diallo**

↓

Appartement A04

↓

Loyer septembre

↓

Paiement de 2 500 000 GNF

↓

Quittance correspondante

Le même principe doit fonctionner pour :

- dépenses ;
- charges ;
- incidents ;
- appartements ;
- locataires.

---

# 42. Parcours 39 : Erreur de paiement

## Cas

Un paiement est enregistré à tort.

Le système ne doit pas permettre une suppression silencieuse.

Le gestionnaire doit pouvoir :

> Annuler / corriger le paiement

Le système demande une confirmation et exige éventuellement une justification.

L'historique indique :

- paiement initial ;
- action de correction ;
- utilisateur ;
- date ;
- nouvelle situation.

---

# 43. Parcours 40 : Connexion ou accès impossible

Lorsque le service est temporairement indisponible ou que la connexion réseau est faible, le système doit :

- informer clairement l'utilisateur ;
- ne pas confirmer une opération non enregistrée ;
- éviter les doubles soumissions ;
- conserver une indication claire de l'état de l'action.

Pour une opération financière, aucune confirmation visuelle définitive ne doit être affichée tant que le système n'a pas obtenu la confirmation nécessaire.

---

# 44. Parcours transversal : logique de synchronisation entre rôles

Une caractéristique fondamentale du produit est que plusieurs utilisateurs travaillent sur les mêmes données.

Exemple :

### Gestionnaire

Enregistre :

> Paiement A04 : 2 500 000 GNF

### Système

Met à jour :

> Loyer A04 : Payé

### Locataire

Voit :

> Paiement confirmé

### Propriétaire

Voit :

> Loyers encaissés +2 500 000 GNF

Une même action doit donc mettre à jour toutes les vues concernées automatiquement.

---

# 45. Parcours transversal : changement de statut

Les changements d'état doivent être cohérents dans tout le produit.

Exemple :

```text
LOCATAIRE
Actif
   ↓
Départ annoncé
   ↓
Contrat terminé
   ↓
Ancien locataire

APPARTEMENT
Occupé
   ↓
Départ
   ↓
Vacant

CONTRAT
Actif
   ↓
Terminé

ACCÈS
Actif
   ↓
Désactivé
```

Une seule opération peut donc entraîner plusieurs changements cohérents dans le système.

---

# 46. Parcours transversal : propriété et délégation

Le produit doit distinguer :

**propriété de la donnée**

et

**droit de gestion**.

Le propriétaire reste l'autorité principale sur son patrimoine.

Le gestionnaire dispose de droits opérationnels.

Le locataire ne possède qu'un accès limité à ses propres informations.

Cette distinction est fondamentale pour la sécurité et la gouvernance du produit.

---

# 47. Parcours critique de référence

Le scénario suivant doit servir de test fonctionnel complet du MVP.

## Situation initiale

Un propriétaire possède :

**1 immeuble**
**12 appartements**

Il embauche un gestionnaire.

## Séquence

### Étape 1

Le propriétaire crée son compte.

### Étape 2

Il crée l'immeuble.

### Étape 3

Il crée les 12 appartements.

### Étape 4

Il invite le gestionnaire.

### Étape 5

Le gestionnaire accepte.

### Étape 6

Le gestionnaire ajoute les 12 locataires.

### Étape 7

Les locataires reçoivent leurs invitations.

### Étape 8

Ils activent leurs espaces.

### Étape 9

Le gestionnaire configure les loyers.

### Étape 10

Le système génère les échéances.

### Étape 11

Les locataires reçoivent les notifications.

### Étape 12

Certains paient numériquement.

### Étape 13

Certains paient en espèces et le gestionnaire enregistre les paiements.

### Étape 14

Un locataire paie seulement une partie.

### Étape 15

Le système affiche le solde restant.

### Étape 16

Une facture d'eau commune arrive.

### Étape 17

Le gestionnaire saisit la facture.

### Étape 18

Le système répartit la facture.

### Étape 19

Chaque locataire voit sa part.

### Étape 20

Un locataire signale une fuite.

### Étape 21

Le gestionnaire reçoit l'incident.

### Étape 22

Il assigne un prestataire.

### Étape 23

Il enregistre le coût de l'intervention.

### Étape 24

La dépense apparaît dans les finances de l'immeuble.

### Étape 25

Le propriétaire consulte son tableau de bord.

### Étape 26

Il retrouve les revenus, charges, dépenses et incidents.

### Étape 27

Le mois suivant, le système recommence automatiquement le cycle des échéances.

Si ce scénario fonctionne sans incohérence, le cœur fonctionnel du produit est solide.

---

# 48. Parcours prioritaires du MVP

Tous les parcours ne sont pas de même importance.

Les parcours critiques à valider en premier sont :

1. Création du propriétaire
2. Création de l'immeuble
3. Invitation du gestionnaire
4. Activation du gestionnaire
5. Ajout du locataire
6. Invitation du locataire
7. Activation du locataire
8. Configuration du contrat
9. Génération des loyers
10. Paiement
11. Relance
12. Charge commune
13. Incident
14. Intervention
15. Dépense
16. Consultation propriétaire
17. Révocation gestionnaire
18. Départ d'un locataire

Ces parcours constituent la colonne vertébrale du MVP.

---

# 49. Principes UX issus des parcours

L'analyse des parcours permet de dégager plusieurs règles importantes.

## Règle 1

**Le contexte doit être créé avant l'utilisateur secondaire.**

Le locataire n'existe pas seulement comme compte utilisateur.

Il existe d'abord comme :

> locataire d'un appartement donné dans un immeuble donné.

## Règle 2

**Le produit doit guider plutôt qu'expliquer.**

L'utilisateur ne doit pas avoir besoin de lire une documentation pour savoir quoi faire ensuite.

## Règle 3

**Les informations doivent circuler automatiquement.**

Une donnée entrée dans un module doit alimenter les autres modules concernés.

## Règle 4

**La plupart des opérations doivent être réalisables sans quitter le contexte.**

Par exemple, depuis un appartement, le gestionnaire doit pouvoir accéder directement à :

- locataire ;
- loyer ;
- paiements ;
- incidents.

## Règle 5

**Les actions critiques doivent être explicites.**

Révocation, suppression logique, modification financière et clôture doivent être clairement confirmées.

---

# 50. Conclusion

Le produit repose sur des parcours très simples en apparence :

**Créer → Inviter → Gérer → Payer → Suivre**

Mais derrière cette simplicité se trouve une logique beaucoup plus structurée :

- relations entre utilisateurs ;
- relations entre immeubles et appartements ;
- contrats ;
- échéances ;
- transactions ;
- charges ;
- incidents ;
- dépenses ;
- permissions ;
- historiques ;
- notifications.

La conception UX/UI devra donc transformer cette complexité fonctionnelle en parcours courts, cohérents et prévisibles.

La prochaine étape consiste à formaliser cette structure dans :

> **Information Architecture / Architecture de l'information**

Ce document permettra de définir précisément **comment les contenus et fonctionnalités seront organisés dans le produit**, avant de passer aux wireframes et aux écrans.