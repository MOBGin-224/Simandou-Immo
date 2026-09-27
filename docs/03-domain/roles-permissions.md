# Roles & Permissions Matrix

> **Note de consolidation, DEC-025**
>
> Le MVP évalue les droits sur **deux dimensions uniquement** : le **rôle** et le **périmètre d'immeubles**.
>
> Le catalogue des permissions `resource.action` est défini **en code** et mappé statiquement par rôle. Il n'existe pas de permissions attribuées individuellement à un gestionnaire.
>
> Les éléments suivants de ce document sont reclassés **Future Evolution** et ne doivent pas être implémentés au MVP :
>
> | Élément | Classement |
> |---|---|
> | Délégation à cases à cocher par domaine (section 29) | `FUT-FEAT-017` |
> | Gestionnaire principal / gestionnaire secondaire (section 28) | `FUT-FEAT-018` |
> | Mentions « selon droits » impliquant une granularité par gestionnaire | `FUT-FEAT-017` |
>
> Dans les matrices ci-dessous, lire **« selon droits »** comme **« selon le périmètre d'immeubles attribué »**, et non comme une permission individuelle.

## 1. Objet du document

Ce document définit les rôles du produit, leurs responsabilités et les permissions associées à chaque type d'utilisateur.

Il précise notamment :

- qui peut consulter une information ;
- qui peut créer une information ;
- qui peut la modifier ;
- qui peut la désactiver ;
- qui peut la révoquer ;
- sur quel périmètre chaque utilisateur peut agir ;
- quelles actions doivent rester réservées au propriétaire ;
- quelles actions peuvent être déléguées au gestionnaire ;
- quelles informations sont accessibles au locataire.

L'objectif est de construire un système dans lequel les droits sont suffisamment puissants pour permettre une véritable gestion opérationnelle, tout en restant suffisamment stricts pour protéger le patrimoine, les données et l'historique.

---

# 2. Principes de permission

## 2.1 Le rôle ne suffit pas

Le système doit déterminer les droits d'un utilisateur à partir de deux éléments :

```text
Rôle
+
Périmètre d'accès
```

Exemple :

```text
Gestionnaire
+
Résidence Camayenne
```

Ce gestionnaire peut gérer Camayenne mais pas nécessairement les autres immeubles du propriétaire.

---

## 2.2 La propriété et la gestion sont distinctes

Le propriétaire possède l'autorité sur le patrimoine.

Le gestionnaire reçoit une délégation de gestion.

Le gestionnaire peut donc effectuer de nombreuses opérations sans devenir propriétaire des données ou des biens concernés.

---

## 2.3 Le locataire n'est pas un gestionnaire réduit

Le locataire possède un accès très limité et contextuel.

Il peut agir sur ce qui concerne :

- son identité ;
- son logement ;
- son contrat ;
- ses paiements ;
- ses charges ;
- ses incidents.

Il ne peut pas consulter les informations des autres locataires.

---

## 2.4 Les permissions doivent être compréhensibles

L'utilisateur qui attribue des droits doit comprendre facilement ce qu'il autorise.

Éviter les permissions techniques telles que :

> `property.update.write`

Préférer :

> **Gérer les informations de l'immeuble**

---

# 3. Rôles principaux

Le MVP comporte trois rôles principaux.

## 3.1 Propriétaire

Autorité principale sur le patrimoine.

Responsabilités :

- gestion du patrimoine ;
- gestion des gestionnaires ;
- contrôle des données ;
- consultation financière ;
- supervision de la maintenance ;
- contrôle des accès.

---

## 3.2 Gestionnaire

Utilisateur opérationnel.

Responsabilités :

- gestion quotidienne ;
- gestion des appartements ;
- gestion des locataires ;
- loyers ;
- paiements ;
- charges ;
- incidents ;
- travaux ;
- dépenses.

---

## 3.3 Locataire

Utilisateur final de son logement.

Responsabilités :

- consulter ses informations ;
- payer ;
- consulter ses documents ;
- signaler des problèmes ;
- suivre ses demandes.

---

# 4. Portée des permissions

Les permissions doivent pouvoir s'appliquer à plusieurs niveaux.

## Niveau 1 : Organisation

Concerne l'espace global du propriétaire.

Exemples :

- gérer les utilisateurs ;
- consulter l'ensemble du patrimoine ;
- modifier les paramètres globaux.

## Niveau 2 : Immeuble

Concerne une résidence spécifique.

Exemples :

- gérer les appartements ;
- consulter les finances ;
- gérer les locataires.

## Niveau 3 : Appartement

Concerne un logement particulier.

Exemples :

- consulter l'occupant ;
- modifier certains paramètres ;
- consulter les paiements ;
- suivre les incidents.

## Niveau 4 : Donnée personnelle

Concerne les informations privées d'un utilisateur.

Exemples :

- téléphone ;
- email ;
- informations personnelles du locataire.

---

# 5. Niveaux d'autorité

Pour simplifier la conception, le système peut être organisé autour de quatre niveaux d'autorité :

### Administration

Gestion du patrimoine et des accès.

### Gestion

Gestion opérationnelle.

### Consultation

Lecture sans modification.

### Personnel

Accès limité aux propres données de l'utilisateur.

---

# 6. Principes spécifiques au propriétaire

Le propriétaire dispose du niveau d'autorité maximal sur les ressources qui lui appartiennent.

Il doit pouvoir :

- créer ;
- consulter ;
- modifier ;
- archiver ;
- gérer les accès ;
- révoquer les gestionnaires ;
- consulter l'historique.

Cependant, même le propriétaire ne doit pas pouvoir modifier silencieusement les données historiques critiques.

Une correction financière doit toujours rester traçable.

---

# 7. Principes spécifiques au gestionnaire

Le gestionnaire possède uniquement les droits qui lui sont délégués.

Il ne doit pas pouvoir :

- supprimer la propriété d'un immeuble ;
- transférer la propriété sans autorisation ;
- révoquer le propriétaire ;
- modifier l'autorité du propriétaire ;
- accéder à un immeuble qui ne lui est pas attribué.

Il peut gérer les opérations quotidiennes selon son périmètre.

---

# 8. Principes spécifiques au locataire

Le locataire doit pouvoir :

- consulter ses propres données ;
- consulter son contrat ;
- consulter ses obligations ;
- effectuer des paiements ;
- consulter ses paiements ;
- recevoir ses quittances ;
- créer des incidents ;
- suivre ses incidents.

Il ne peut pas :

- consulter les autres locataires ;
- voir les finances globales de l'immeuble ;
- modifier son appartement ;
- modifier son loyer ;
- modifier ses charges ;
- gérer les utilisateurs.

---

# 9. Matrice globale des permissions

Légende :

**C** = Créer  
**L** = Lire  
**M** = Modifier  
**A** = Archiver / désactiver  
**R** = Révoquer  
**S** = Soumettre / déclarer  
**P** = Payer  
**X** = Aucun accès

| Fonction | Propriétaire | Gestionnaire | Locataire |
|---|---|---|---|
| Gérer son profil | L/M | L/M | L/M |
| Créer un immeuble | C | Selon droits | X |
| Consulter un immeuble | L | L | Limité |
| Modifier un immeuble | M | Selon droits | X |
| Archiver un immeuble | A | Selon droits | X |
| Ajouter un appartement | C | C | X |
| Modifier un appartement | M | M | X |
| Archiver un appartement | A | Selon droits | X |
| Ajouter un gestionnaire | C | X | X |
| Modifier les droits d'un gestionnaire | M | X | X |
| Suspendre un gestionnaire | A | X | X |
| Révoquer un gestionnaire | R | X | X |
| Ajouter un locataire | C | C | X |
| Modifier un locataire | M | M | Limité |
| Inviter un locataire | C | C | X |
| Suspendre un locataire | A | A | X |
| Révoquer l'accès locataire | R | R | X |
| Créer un contrat | C | C | X |
| Modifier un contrat | M | M | X |
| Clôturer un contrat | M | M | X |
| Consulter les loyers | L | L | Ses loyers |
| Créer une échéance | C | C | X |
| Modifier une échéance | M | M | X |
| Consulter les paiements | L | L | Ses paiements |
| Enregistrer un paiement manuel | C | C | X |
| Effectuer un paiement | X | X | P |
| Corriger un paiement | M | M avec traçabilité | X |
| Consulter les quittances | L | L | Ses quittances |
| Créer une charge | C | C | X |
| Modifier une charge avant publication | M | M | X |
| Modifier une charge publiée | M avec traçabilité | M avec traçabilité | X |
| Consulter les charges | L | L | Ses charges |
| Signaler un incident | C | C | S |
| Consulter un incident | L | L | Ses incidents |
| Modifier le statut d'un incident | M | M | X |
| Créer une intervention | C | C | X |
| Modifier une intervention | M | M | X |
| Enregistrer une dépense | C | C | X |
| Modifier une dépense | M | M avec traçabilité | X |
| Consulter les dépenses | L | L | X |
| Consulter les rapports | L | L selon droits | X |
| Consulter l'historique global | L | L selon droits | Historique personnel |
| Consulter le journal d'activité | L | L selon droits | X |
| Gérer les paramètres globaux | M | X | X |

---

# 10. Gestion des immeubles

## Propriétaire

Le propriétaire peut :

- créer un immeuble ;
- modifier les informations ;
- archiver l'immeuble ;
- consulter l'ensemble des données ;
- attribuer un gestionnaire.

## Gestionnaire

Le gestionnaire peut :

- consulter les immeubles qui lui sont attribués ;
- modifier les informations opérationnelles selon ses droits ;
- gérer les appartements ;
- gérer les locataires ;
- gérer les opérations financières.

Il ne peut pas transférer la propriété de l'immeuble.

## Locataire

Le locataire ne voit que :

- le nom ou identifiant de son immeuble ;
- les informations nécessaires à son expérience.

---

# 11. Gestion des appartements

## Création

Le propriétaire peut créer les appartements.

Le gestionnaire peut également les créer si cette permission lui est attribuée.

## Modification

Les informations opérationnelles peuvent être modifiées par le gestionnaire.

Certaines informations sensibles peuvent rester réservées au propriétaire.

## Exemple

Un gestionnaire peut modifier :

- le statut ;
- les informations opérationnelles ;
- certains paramètres de location.

Mais une information considérée comme liée à la propriété juridique du bien doit rester protégée.

---

# 12. Gestion des gestionnaires

Cette fonctionnalité est exclusivement propriétaire dans le MVP.

Le propriétaire peut :

### Ajouter

Créer une invitation.

### Modifier

Modifier le périmètre et les droits.

### Suspendre

Bloquer temporairement l'accès.

### Réactiver

Restaurer l'accès.

### Révoquer

Mettre fin à l'accès.

Le gestionnaire ne doit jamais pouvoir modifier ses propres droits au-dessus de ceux attribués par le propriétaire.

---

# 13. Gestion des locataires

Le gestionnaire constitue le principal point d'entrée pour les locataires.

Il peut :

- créer un profil ;
- envoyer une invitation ;
- renvoyer une invitation ;
- modifier certaines informations ;
- associer un locataire à un appartement ;
- gérer le contrat ;
- désactiver son accès.

Le propriétaire conserve une visibilité sur ces données.

---

# 14. Modification des données personnelles du locataire

Certaines données doivent pouvoir être modifiées par le locataire lui-même.

Par exemple :

- photo de profil si utilisée ;
- email ;
- certaines informations de contact.

D'autres informations doivent rester contrôlées par le gestionnaire.

Par exemple :

- appartement ;
- loyer contractuel ;
- date de début du contrat ;
- statut locatif.

Le locataire ne doit pas pouvoir modifier directement les données qui déterminent ses obligations financières.

---

# 15. Gestion des contrats

Le contrat constitue une donnée sensible.

Le propriétaire peut :

- consulter ;
- créer ;
- modifier ;
- clôturer.

Le gestionnaire peut :

- consulter ;
- créer ;
- modifier ;
- clôturer selon les droits.

Le locataire peut :

- consulter son propre contrat ;
- télécharger les documents autorisés.

Il ne peut pas modifier les informations contractuelles structurantes.

---

# 16. Gestion des loyers

Le gestionnaire doit avoir tous les outils nécessaires à la gestion quotidienne des loyers.

Il peut :

- consulter ;
- créer les paramètres ;
- générer les échéances ;
- enregistrer les paiements manuels ;
- consulter les retards ;
- déclencher les relances.

Le propriétaire peut :

- consulter ;
- contrôler ;
- éventuellement corriger ou autoriser certaines opérations sensibles.

Le locataire peut :

- consulter ses montants ;
- consulter ses échéances ;
- payer ;
- consulter son historique.

---

# 17. Gestion des paiements

Les paiements constituent une zone sensible.

## Paiement numérique

Le locataire initie le paiement.

Le système traite la transaction.

Le système confirme ou rejette le paiement selon le résultat de la transaction.

Le gestionnaire ne doit pas pouvoir déclarer arbitrairement un paiement numérique comme confirmé sans trace.

## Paiement manuel

Le gestionnaire peut enregistrer :

- espèces ;
- virement ;
- autre moyen.

Une preuve peut être ajoutée.

L'opération doit indiquer clairement :

> **Paiement enregistré manuellement par [utilisateur]**

---

# 18. Correction des paiements

Une transaction confirmée ne doit pas être supprimée silencieusement.

Le système doit privilégier :

**Annulation / correction / contre-écriture logique**

avec journalisation.

Exemple :

```text
Paiement initial
2 500 000 GNF
        ↓
Correction
-2 500 000 GNF
        ↓
Nouvelle opération
2 000 000 GNF
```

Le système conserve la trace de l'ensemble des événements.

---

# 19. Gestion des charges

Le gestionnaire peut :

- créer une facture ;
- choisir une méthode de répartition ;
- prévisualiser le résultat ;
- publier les charges.

Le propriétaire peut consulter l'ensemble.

Le locataire peut voir uniquement :

> **Sa part**

et éventuellement le détail nécessaire à sa compréhension.

---

# 20. Gestion des incidents

Le locataire doit pouvoir créer un incident.

Le gestionnaire peut ensuite :

- consulter ;
- prioriser ;
- assigner ;
- commenter ;
- modifier le statut ;
- clôturer.

Le propriétaire peut consulter les incidents de ses immeubles.

Le propriétaire peut également intervenir selon les droits prévus, notamment pour les décisions importantes.

---

# 21. Gestion des dépenses

Le gestionnaire peut créer une dépense.

Le propriétaire peut consulter toutes les dépenses de son patrimoine.

Selon une future politique de contrôle, certaines catégories de dépenses pourraient nécessiter une validation du propriétaire.

Cette fonction peut être conservée pour une version ultérieure si le MVP souhaite rester plus simple.

---

# 22. Gestion des documents

## Propriétaire

Accès à tous les documents liés à son patrimoine.

## Gestionnaire

Accès aux documents des immeubles qui lui sont attribués.

## Locataire

Accès uniquement aux documents qui le concernent.

Exemples :

- son contrat ;
- ses quittances ;
- ses reçus ;
- les informations de ses incidents.

---

# 23. Gestion de l'historique

L'historique doit être accessible selon les droits.

## Propriétaire

Accès complet sur son patrimoine.

## Gestionnaire

Accès à l'historique des ressources qu'il gère.

## Locataire

Accès à son propre historique.

Un ancien gestionnaire peut être retiré de l'accès opérationnel mais rester identifiable dans les journaux historiques.

---

# 24. Journal d'activité

Le journal d'activité est différent de l'historique métier.

### Historique métier

Exemple :

> Le loyer de septembre est payé.

### Journal d'activité

Exemple :

> Mamadou a enregistré manuellement le paiement de 2 500 000 GNF le 5 septembre à 10:23.

Les deux niveaux doivent être conservés lorsque nécessaire.

---

# 25. Permissions sur les actions sensibles

Certaines actions doivent être considérées comme sensibles :

- révocation ;
- suppression logique ;
- modification d'un contrat actif ;
- modification d'un loyer actif ;
- correction d'un paiement confirmé ;
- modification d'une charge déjà publiée ;
- modification d'une information liée au propriétaire.

Ces actions doivent :

- être limitées aux rôles autorisés ;
- afficher clairement leur conséquence ;
- être journalisées ;
- pouvoir être retrouvées dans l'historique.

---

# 26. Permission versus visibilité

Un utilisateur peut parfois voir une donnée sans pouvoir la modifier.

Exemple :

Le gestionnaire voit :

> Nom du propriétaire

mais ne peut pas modifier le propriétaire.

Le locataire peut voir :

> Son loyer

mais ne peut pas modifier le montant contractuel.

Il faut donc distinguer clairement :

**Voir**

de :

**Modifier**

et :

**Gérer**

---

# 27. Périmètre d'un gestionnaire

Le gestionnaire peut être associé à :

### Un seul immeuble

```text
Gestionnaire A
→ Résidence Camayenne
```

### Plusieurs immeubles

```text
Gestionnaire A
→ Camayenne
→ Kipé
→ Dixinn
```

### Tous les immeubles

Selon les droits du propriétaire.

Le système doit permettre cette distinction.

---

# 28. Gestionnaire principal et gestionnaire secondaire

> **Hors périmètre MVP, `FUT-FEAT-018` (DEC-025).**

Le produit pourra ultérieurement distinguer deux niveaux dans la gestion opérationnelle.

### Gestionnaire principal

Possèderait les responsabilités opérationnelles principales.

### Gestionnaire secondaire

Possèderait un sous-ensemble des droits.

Cette distinction est utile pour des équipes ou agences qui travaillent à plusieurs.

**Au MVP, il n'existe qu'un seul niveau de gestionnaire.** Plusieurs gestionnaires peuvent être affectés au même immeuble et disposent alors des mêmes permissions sur ce périmètre.

---

# 29. Délégation de droits

Le propriétaire doit pouvoir attribuer des droits sans devoir comprendre un système technique complexe.

Exemple :

> **Mamadou**
>
> Gestionnaire
>
> Immeubles :
> Camayenne
> Kipé
>
> Peut gérer sur ces immeubles :
> locataires, contrats, loyers, paiements, charges, maintenance, dépenses
>
> Ne peut pas :
> gérer les gestionnaires, ni accéder à un immeuble hors de ce périmètre

Au MVP, la délégation porte **uniquement sur le périmètre d'immeubles**.

L'interface présente les permissions du rôle en lecture seule, à titre d'information, et laisse le propriétaire choisir uniquement les immeubles.

## Future Evolution

> **`FUT-FEAT-017`** : l'attribution de droits par domaine, sous forme de cases à cocher, n'appartient pas au MVP.

```text
Permissions :
[x] Locataires
[x] Loyers
[x] Paiements
[x] Maintenance
[ ] Gestionnaires
```

Cet écran sera introduit lorsque la délégation fine entrera dans le périmètre.

---

# 30. Protection contre l'escalade de privilèges

Un utilisateur ne doit jamais pouvoir :

- s'attribuer des permissions supplémentaires ;
- modifier son propre rôle ;
- accéder à un immeuble non attribué ;
- accéder à un autre propriétaire ;
- transformer son compte en propriétaire ;
- utiliser une invitation pour accéder à une autre organisation.

Les permissions doivent être vérifiées côté serveur, indépendamment de l'interface.

---

# 31. Isolation entre organisations

Si plusieurs propriétaires utilisent la plateforme, leurs données doivent être strictement séparées.

Exemple :

```text
Organisation A
├── Immeuble 1
└── Immeuble 2

Organisation B
├── Immeuble 3
└── Immeuble 4
```

Un utilisateur de l'organisation A ne doit jamais pouvoir accéder à l'organisation B simplement en connaissant un identifiant.

---

# 32. Cas particulier : propriétaire également gestionnaire

Le système doit autoriser :

```text
Utilisateur
→ Propriétaire
→ Gestionnaire
```

Dans ce cas, l'utilisateur possède les deux ensembles de permissions.

L'interface peut adapter son mode de fonctionnement selon le contexte.

Exemple :

> Propriétaire et gestionnaire de Résidence Camayenne

Il peut ainsi gérer lui-même ses locataires sans créer un compte gestionnaire séparé.

---

# 33. Cas particulier : plusieurs propriétaires

Le produit devra prévoir à terme la possibilité qu'un même patrimoine soit associé à plusieurs propriétaires.

Ce besoin peut concerner :

- copropriété ;
- indivision ;
- sociétés ;
- groupes d'investisseurs.

Le MVP peut conserver un modèle plus simple si nécessaire, mais l'architecture technique ne doit pas rendre cette évolution impossible.

---

# 34. Cas particulier : un locataire sur plusieurs logements

Un même utilisateur peut potentiellement être associé à plusieurs logements au fil du temps.

Exemple :

```text
Mamadou
├── Ancien appartement A04
└── Appartement actuel B07
```

Le compte utilisateur doit rester unique.

Ce sont les relations locatives qui évoluent.

---

# 35. États d'accès utilisateur

Chaque utilisateur peut avoir un état indépendant de son rôle.

## États

**Invitation créée**

**Invitation envoyée**

**Invitation expirée**

**Actif**

**Suspendu**

**Révoqué**

**Archivé**

Le statut doit être cohérent avec les droits disponibles.

---

# 36. Révocation versus archivage

Ces notions doivent être distinguées.

### Révoqué

L'utilisateur perd immédiatement son accès.

### Archivé

L'utilisateur n'est plus opérationnel mais reste conservé dans les historiques.

### Supprimé

Cette opération doit être exceptionnellement rare et soumise à des règles de conservation des données.

Le produit doit privilégier :

**Révoquer ou archiver**

plutôt que :

**Supprimer**

---

# 37. Matrice détaillée par domaine

## Immeubles

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Créer | Oui | Selon droits | Non |
| Consulter | Oui | Oui, périmètre autorisé | Limité |
| Modifier | Oui | Selon droits | Non |
| Archiver | Oui | Selon droits | Non |

## Appartements

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Créer | Oui | Oui | Non |
| Consulter | Oui | Oui | Son logement |
| Modifier | Oui | Oui, selon droits | Non |
| Changer le statut | Oui | Oui | Non |
| Affecter un locataire | Oui | Oui | Non |

## Locataires

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Ajouter | Oui | Oui | Non |
| Consulter | Oui | Oui | Son profil |
| Modifier | Oui | Oui | Données personnelles autorisées |
| Inviter | Oui | Oui | Non |
| Suspendre | Oui | Oui | Non |
| Révoquer | Oui | Oui | Non |

## Contrats

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Créer | Oui | Oui | Non |
| Consulter | Oui | Oui | Son contrat |
| Modifier | Oui | Oui | Non |
| Clôturer | Oui | Oui | Non |

## Loyers

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Consulter | Oui | Oui | Ses loyers |
| Générer | Oui | Oui | Non |
| Modifier paramètres | Oui | Oui selon droits | Non |
| Payer | Non | Non | Oui |
| Relancer | Oui | Oui | Non |

## Paiements

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Consulter | Oui | Oui | Ses paiements |
| Initier paiement numérique | Non | Non | Oui |
| Enregistrer paiement manuel | Oui | Oui | Non |
| Corriger | Oui | Oui avec traçabilité | Non |
| Télécharger quittance | Oui | Oui | Ses quittances |

## Charges

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Créer | Oui | Oui | Non |
| Modifier avant publication | Oui | Oui | Non |
| Publier | Oui | Oui | Non |
| Consulter | Oui | Oui | Sa part |
| Payer | Non | Non | Oui, selon flux |

## Maintenance

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Créer incident | Oui | Oui | Oui |
| Consulter | Oui | Oui | Ses incidents |
| Modifier statut | Oui | Oui | Non |
| Assigner | Oui | Oui | Non |
| Ajouter intervention | Oui | Oui | Non |
| Clôturer | Oui | Oui | Non |

## Dépenses

| Action | Propriétaire | Gestionnaire | Locataire |
|---|---:|---:|---:|
| Créer | Oui | Oui | Non |
| Consulter | Oui | Oui | Non |
| Modifier | Oui | Oui avec traçabilité | Non |
| Supprimer | Non recommandé | Non recommandé | Non |

---

# 38. Règle de responsabilité

Une action doit toujours pouvoir répondre à la question :

> **Qui a fait quoi ?**

Exemple :

> Dépense de 450 000 GNF  
> Créée par : Mamadou Diallo  
> Gestionnaire  
> 09/09/2026 à 16:02

Cette règle est particulièrement importante pour :

- paiements ;
- dépenses ;
- modifications de contrat ;
- charges ;
- révocations ;
- changements de statut.

---

# 39. Principe de moindre privilège

Un utilisateur doit recevoir uniquement les droits nécessaires à son rôle.

Le système doit éviter :

> **Donner tous les droits par défaut.**

Exemple :

Un gestionnaire chargé uniquement des loyers n'a pas nécessairement besoin de modifier les paramètres de propriété.

Cela limite les erreurs et protège les données.

---

# 40. Permissions futures

> **Hors périmètre MVP.** Le MVP comporte exactement trois rôles : `OWNER`, `MANAGER`, `TENANT` (DEC-003).

L'architecture devra permettre d'introduire ultérieurement des rôles supplémentaires.

Exemples :

- administrateur d'agence ;
- comptable ;
- agent de recouvrement ;
- responsable maintenance ;
- propriétaire associé ;
- auditeur ;
- prestataire.

Ces rôles ne font pas partie du MVP principal, mais le modèle de permissions doit pouvoir les accueillir.

---

# 41. Principes techniques de sécurité liés aux permissions

Les permissions devront être vérifiées :

1. côté interface pour simplifier l'expérience ;
2. côté serveur pour garantir la sécurité.

Masquer un bouton ne constitue pas une protection suffisante.

Chaque requête sensible doit vérifier :

- identité ;
- rôle ;
- organisation ;
- périmètre ;
- permission ;
- statut de l'utilisateur.

---

# 42. Critères d'acceptation du système de permissions

Le système sera considéré comme correct lorsque les situations suivantes fonctionneront :

### Cas 1

Le propriétaire peut gérer tous ses immeubles.

### Cas 2

Le gestionnaire A ne peut accéder qu'aux immeubles qui lui sont attribués.

### Cas 3

Le gestionnaire B ne peut pas voir les données du gestionnaire A lorsqu'elles concernent un autre immeuble.

### Cas 4

Le locataire ne peut voir que ses données.

### Cas 5

Le propriétaire peut révoquer immédiatement un gestionnaire.

### Cas 6

La révocation ne supprime pas l'historique.

### Cas 7

Un gestionnaire ne peut pas augmenter lui-même ses permissions.

### Cas 8

Une correction financière reste traçable.

### Cas 9

Un utilisateur d'une organisation ne peut accéder à aucune donnée d'une autre organisation.

---

# 43. Synthèse du modèle de permissions

Le modèle peut être résumé ainsi :

```text
PROPRIÉTAIRE
    │
    ├── contrôle le patrimoine
    ├── attribue les gestionnaires
    ├── définit leurs droits
    └── peut révoquer leurs accès
            │
            ▼
       GESTIONNAIRE
            │
            ├── gère les immeubles autorisés
            ├── gère les locataires
            ├── gère les loyers
            ├── gère les paiements
            ├── gère les charges
            ├── gère la maintenance
            └── gère les dépenses
                    │
                    ▼
                LOCATAIRE
                    │
                    ├── consulte son espace
                    ├── paie
                    ├── consulte ses reçus
                    └── signale ses incidents
```

Le modèle de permissions repose donc sur une logique de **délégation contrôlée**.

Le propriétaire reste l'autorité sur le patrimoine.

Le gestionnaire dispose des droits nécessaires pour opérer.

Le locataire dispose uniquement des droits nécessaires pour utiliser les services qui le concernent.

Cette séparation doit être visible pour l'utilisateur, mais suffisamment souple pour permettre des configurations réalistes, comme un propriétaire qui gère lui-même ses immeubles ou un gestionnaire responsable de plusieurs résidences.