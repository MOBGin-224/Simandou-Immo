# Product Vision / Concept Note

> **Produit : SIMANDOU IMMO** (DEC-031).
>
> SIMANDOU IMMO est un produit **distinct de SIMANDOU SEJOUR**. Les deux ne doivent jamais être confondus.

## 1. Présentation du produit

**SIMANDOU IMMO** est un SaaS de gestion d'immeubles destiné aux propriétaires et aux gestionnaires de biens locatifs, adapté au contexte guinéen.

Il permet de centraliser, dans une seule plateforme, la gestion opérationnelle, financière et locative d'un ou plusieurs immeubles.

L'objectif est simple : remplacer une gestion dispersée entre cahiers, fichiers Excel, messages WhatsApp, reçus papier et échanges informels par un système numérique unique, structuré et accessible.

Le produit repose sur une architecture simple pour l'utilisateur :

**Propriétaire → Gestionnaire → Locataire**

Le propriétaire contrôle son patrimoine et les personnes qui y ont accès. Le gestionnaire assure la gestion quotidienne des immeubles et des locataires. Le locataire accède uniquement aux informations et services qui le concernent.

---

## 2. Le problème

La gestion d'un immeuble locatif devient rapidement complexe dès qu'il comporte plusieurs appartements.

Pour un immeuble de 10, 20 ou 50 logements, le gestionnaire doit généralement suivre simultanément :

- les appartements occupés et vacants ;
- les locataires ;
- les loyers mensuels ;
- les échéances ;
- les retards et impayés ;
- les cautions ;
- les paiements en espèces ou via mobile money ;
- les quittances ;
- les factures d'eau ou d'électricité ;
- les charges communes ;
- les interventions et réparations ;
- les dépenses ;
- les prestataires ;
- les échanges avec les locataires ;
- les informations à transmettre au propriétaire.

Dans de nombreux cas, ces informations sont réparties entre plusieurs outils ou supports.

Le propriétaire peut ainsi avoir du mal à obtenir une vision claire et actualisée de son patrimoine.

Le locataire, de son côté, peut devoir contacter directement le gestionnaire pour connaître le montant à payer, transmettre une preuve de paiement ou signaler un problème dans son logement.

Le problème n'est donc pas uniquement l'absence d'un logiciel de suivi des loyers.

Le véritable problème est l'absence d'un système unique permettant de gérer simplement l'ensemble de la vie opérationnelle d'un immeuble.

---

## 3. La vision

Créer une infrastructure numérique simple, fiable et accessible permettant de gérer un immeuble locatif de bout en bout.

Le produit doit permettre à un propriétaire ou à un gestionnaire de comprendre la situation d'un immeuble en quelques secondes, d'effectuer les opérations courantes sans complexité et de conserver un historique structuré de toutes les activités.

La technologie doit prendre en charge la complexité.

L'utilisateur ne doit voir que ce qui est nécessaire à son action.

### Principe directeur

> **Complexe technologiquement. Simple humainement.**

---

## 4. La mission du produit

La mission est de digitaliser la gestion quotidienne des immeubles locatifs en créant une expérience suffisamment simple pour être utilisée par tous les acteurs concernés, quel que soit leur niveau de familiarité avec les outils numériques.

Le produit doit notamment permettre de :

- centraliser les informations ;
- automatiser les opérations répétitives ;
- simplifier les paiements ;
- réduire les erreurs de suivi ;
- améliorer la communication entre les acteurs ;
- assurer une traçabilité complète ;
- donner au propriétaire une visibilité permanente sur son patrimoine.

---

## 5. Les utilisateurs

Le produit est conçu autour de trois rôles principaux.

### 5.1 Propriétaire

Le propriétaire est responsable de son patrimoine immobilier.

Il peut :

- créer son espace ;
- enregistrer ses immeubles ;
- inviter un ou plusieurs gestionnaires ;
- définir les immeubles auxquels un gestionnaire peut accéder ;
- consulter la situation de ses biens ;
- consulter les revenus, dépenses, impayés et travaux ;
- révoquer les accès d'un gestionnaire ;
- conserver l'historique des opérations.

Le propriétaire n'a pas nécessairement vocation à effectuer les opérations quotidiennes.

Son besoin principal est de contrôler, comprendre et suivre.

---

### 5.2 Gestionnaire

Le gestionnaire est l'utilisateur opérationnel principal.

Il est chargé de gérer les immeubles qui lui sont confiés.

Il peut :

- gérer les immeubles et appartements ;
- ajouter les locataires ;
- inviter les locataires ;
- gérer les contrats ;
- suivre les loyers ;
- enregistrer et suivre les paiements ;
- envoyer des relances ;
- gérer les charges communes ;
- gérer les incidents ;
- suivre les travaux ;
- enregistrer les dépenses ;
- consulter les historiques ;
- désactiver ou retirer les accès des locataires selon ses droits.

Le gestionnaire doit pouvoir effectuer la majorité de son travail quotidien depuis une interface simple et centralisée.

---

### 5.3 Locataire

Le locataire est un utilisateur invité.

Il ne doit pas être obligé de découvrir le produit ou de créer spontanément un compte.

Le gestionnaire l'ajoute directement à la plateforme et lui envoie une invitation par téléphone, SMS ou WhatsApp selon les moyens disponibles.

Le locataire active ensuite son accès et peut :

- consulter son logement ;
- consulter son loyer ;
- consulter ses charges ;
- effectuer un paiement lorsque cette fonctionnalité est disponible ;
- consulter son historique de paiements ;
- recevoir ses quittances ;
- recevoir des notifications et relances ;
- signaler un problème ;
- suivre l'état d'un incident.

Le locataire ne doit jamais avoir accès aux informations des autres logements ou locataires.

---

## 6. Principe d'accès par invitation

Le produit ne repose pas sur une logique d'inscription libre pour chaque utilisateur.

Il fonctionne principalement par rattachement et invitation.

### Parcours principal

**Propriétaire**

Crée son espace  
↓  
Ajoute son immeuble  
↓  
Invite un gestionnaire

**Gestionnaire**

Accepte l'invitation  
↓  
Accède à son espace  
↓  
Ajoute les appartements et locataires  
↓  
Invite les locataires

**Locataire**

Reçoit l'invitation  
↓  
Ouvre le lien  
↓  
Définit son mot de passe  
↓  
Accède à son espace

Cette approche réduit considérablement la friction lors du déploiement du produit dans un immeuble.

Le gestionnaire peut ainsi intégrer progressivement tous les locataires qu'il gère sans demander à chaque personne de chercher le produit, de créer un compte ou de comprendre comment fonctionne la plateforme.

---

## 7. Gestion des accès

Les accès doivent être contrôlés à partir du rôle et du périmètre de responsabilité de chaque utilisateur.

Le propriétaire conserve le contrôle de ses gestionnaires.

Il peut notamment :

- inviter un gestionnaire ;
- modifier ses droits ;
- limiter son accès à certains immeubles ;
- suspendre son accès ;
- révoquer définitivement son accès.

Le gestionnaire peut gérer les accès des locataires selon les permissions qui lui sont accordées.

La révocation d'un accès ne doit pas supprimer l'historique associé à l'utilisateur ou au logement.

Les données historiques restent conservées afin d'assurer la continuité et la traçabilité.

---

## 8. Les principes produit

### 8.1 Simplicité

Chaque action doit être compréhensible sans formation particulière.

Le produit ne doit pas reproduire la complexité d'un logiciel de gestion traditionnel.

### 8.2 Automatisation

Toutes les tâches répétitives doivent être automatisées autant que possible.

Exemples :

- génération des échéances ;
- calcul des charges ;
- changement automatique du statut d'un paiement ;
- génération des quittances ;
- notifications ;
- relances ;
- mise à jour des tableaux de bord.

### 8.3 Centralisation

Une information saisie une seule fois doit pouvoir être réutilisée dans tout le système.

Un locataire ajouté à un appartement doit automatiquement être disponible dans :

- les loyers ;
- les paiements ;
- les charges ;
- les incidents ;
- les historiques ;
- les rapports.

### 8.4 Traçabilité

Toute opération importante doit pouvoir être retrouvée.

Le système doit conserver notamment :

- qui a effectué une action ;
- à quelle date ;
- sur quel immeuble ;
- sur quel appartement ;
- avec quel montant lorsque cela s'applique ;
- quel était l'état précédent et le nouvel état lorsque cela est pertinent.

### 8.5 Accessibilité

Le produit doit être utilisable par des personnes ayant des niveaux très différents en matière de technologie.

L'interface doit privilégier :

- des mots simples ;
- des actions explicites ;
- des parcours courts ;
- une hiérarchie visuelle claire ;
- des confirmations compréhensibles ;
- des erreurs faciles à corriger.

### 8.6 Mobile first

Une partie importante de l'utilisation quotidienne doit pouvoir être effectuée depuis un smartphone.

Le produit doit particulièrement bien fonctionner pour :

- les gestionnaires sur le terrain ;
- les locataires ;
- les propriétaires consultant leur patrimoine à distance.

---

## 9. Périmètre fonctionnel initial

Le produit initial doit couvrir les principales opérations nécessaires à la gestion quotidienne d'un immeuble.

### Gestion des immeubles

- création d'un immeuble ;
- informations générales ;
- appartements ;
- statut des logements ;
- occupation.

### Gestion des locataires

- fiche locataire ;
- rattachement à un appartement ;
- informations de contact ;
- contrat ;
- historique.

### Gestion des loyers

- montant du loyer ;
- échéance ;
- statut ;
- retards ;
- impayés ;
- historique.

### Gestion des paiements

- paiement numérique ;
- paiement manuel ;
- enregistrement du moyen de paiement ;
- historique ;
- quittance.

### Gestion des charges communes

- création d'une facture ;
- définition de la méthode de répartition ;
- calcul automatique ;
- attribution aux appartements ;
- suivi du paiement.

### Gestion des incidents et travaux

- déclaration d'un incident ;
- photo ;
- description ;
- statut ;
- assignation ;
- coût ;
- historique ;
- clôture.

### Gestion des dépenses

- montant ;
- catégorie ;
- date ;
- justificatif ;
- rattachement à l'immeuble ou à une intervention.

### Tableaux de bord

- situation des loyers ;
- encaissements ;
- impayés ;
- dépenses ;
- charges ;
- incidents ;
- situation globale de l'immeuble.

### Espace propriétaire

- patrimoine ;
- situation financière ;
- activité ;
- dépenses ;
- incidents ;
- historique.

### Espace locataire

- logement ;
- montant à payer ;
- charges ;
- paiements ;
- quittances ;
- incidents.

---

## 10. Ce que le produit doit éviter

Le produit ne doit pas devenir dès sa première version un ERP immobilier complexe.

Le MVP ne cherchera pas immédiatement à couvrir :

- la comptabilité complète ;
- la fiscalité ;
- la gestion juridique avancée ;
- la copropriété complexe ;
- le financement immobilier ;
- l'assurance ;
- les services financiers avancés ;
- une marketplace complète de prestataires.

Ces sujets pourront être étudiés ultérieurement.

La priorité est de résoudre parfaitement la gestion quotidienne d'un immeuble locatif.

---

## 11. Le modèle mental du produit

Le modèle mental doit être extrêmement simple.

### Le propriétaire pense :

**Mon patrimoine**

### Le gestionnaire pense :

**Ce que je dois gérer aujourd'hui**

### Le locataire pense :

**Ce que je dois payer et ce qui concerne mon logement**

Le produit doit adapter l'interface et l'information affichée à ce besoin.

Un même système peut donc être très riche techniquement tout en présentant trois expériences différentes.

---

## 12. Expérience cible

À terme, l'utilisateur doit pouvoir comprendre la situation d'un immeuble en quelques secondes.

Exemple :

### Résidence Camayenne

12 appartements  
11 occupés  
10 loyers payés  
1 en retard  
1 non payé

Loyers encaissés : 27 500 000 GNF

Dépenses : 2 450 000 GNF

Incidents ouverts : 2

Cette vision doit permettre au gestionnaire et au propriétaire de passer rapidement de la vue globale au détail lorsque cela est nécessaire.

---

## 13. Valeur apportée

Le produit doit apporter une valeur directe à chaque acteur.

### Pour le propriétaire

- meilleure visibilité ;
- meilleur contrôle ;
- historique fiable ;
- suivi du patrimoine à distance ;
- réduction de la dépendance aux informations informelles.

### Pour le gestionnaire

- moins de tâches manuelles ;
- moins d'erreurs ;
- meilleure organisation ;
- relances simplifiées ;
- centralisation du travail quotidien.

### Pour le locataire

- accès simple ;
- meilleure visibilité sur ce qu'il doit ;
- paiement facilité ;
- reçus accessibles ;
- signalement des problèmes simplifié.

---

## 14. Vision à long terme

Le produit doit pouvoir évoluer progressivement d'un simple outil de gestion locative vers une véritable infrastructure numérique de gestion des immeubles.

La priorité initiale reste toutefois claire :

> **Permettre à un propriétaire ou à un gestionnaire de gérer facilement la vie quotidienne d'un immeuble depuis une seule plateforme.**

La sophistication doit être principalement invisible pour l'utilisateur.

Le système peut être complexe derrière l'interface, mais chaque utilisateur doit avoir l'impression que tout est simple.

---

## 15. Principes directeurs pour la conception future

Toutes les décisions produit, UX, techniques et fonctionnelles devront respecter les principes suivants :

1. **Simple à comprendre**
2. **Rapide à utiliser**
3. **Mobile first**
4. **Automatisation maximale**
5. **Une information, une seule source de vérité**
6. **Permissions claires**
7. **Historique et traçabilité**
8. **Invitation plutôt qu'inscription complexe**
9. **Aucune suppression destructive des données historiques**
10. **La technologie doit simplifier l'expérience, jamais la compliquer**

---

## 16. Définition synthétique du produit

> **Un SaaS de gestion d'immeubles permettant aux propriétaires et gestionnaires de centraliser les locataires, loyers, paiements, charges, incidents, travaux et dépenses dans une seule plateforme, avec une expérience simple pour chaque utilisateur et un système d'accès basé sur les invitations et les rôles.**

Le produit est conçu selon une philosophie simple :

> **Une infrastructure techniquement puissante, rendue simple par l'expérience utilisateur.**