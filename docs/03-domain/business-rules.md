# Business Rules / Règles métier

> **Note de consolidation**
>
> Ce document est subordonné au **Product & Technical Decision Register** et au **Master Product Specification**.
>
> Les décisions suivantes y sont appliquées et ne sont plus des options ouvertes :
>
> | Décision | Effet sur ce document |
> |---|---|
> | DEC-005 | Une part de charge est une **créance payable** (BR-052, BR-055, BR-056) |
> | DEC-022 | Allocation **multi-créances** dans le périmètre MVP (BR-041) |
> | DEC-023 | Paiement supérieur au montant dû **refusé** (BR-097, §37) |
> | DEC-015 | Statuts de créance unifiés loyer / charge (BR-037) |
> | DEC-017 / DEC-018 | Cycles distincts incident et intervention (BR-060) |
> | DEC-014 | Montants en entier minor unit + devise (BR-085) |

## 1. Objet du document

Ce document définit les règles métier qui régissent le fonctionnement du SaaS de gestion d'immeubles.

Il précise ce que le système doit faire dans différentes situations et garantit que les comportements restent cohérents entre les utilisateurs, les modules et les données.

Les règles métier constituent la logique fonctionnelle du produit.

Elles permettent notamment de déterminer :

- comment les rôles fonctionnent ;
- comment les relations entre utilisateurs sont créées ;
- comment les contrats génèrent les loyers ;
- comment les paiements modifient les échéances ;
- comment les charges sont réparties ;
- comment les incidents évoluent ;
- comment les droits sont retirés ;
- comment l'historique est préservé ;
- comment le système réagit aux erreurs ou aux cas particuliers.

---

# 2. Principes métier fondamentaux

## BR-001 : La donnée de référence doit être unique

Une information structurante doit posséder une source de vérité unique.

Exemple :

Le montant contractuel du loyer appartient au contrat.

Les échéances utilisent ce montant.

Les tableaux de bord utilisent les échéances et les paiements.

Le système ne doit pas maintenir plusieurs montants indépendants pour la même information sans raison fonctionnelle.

---

## BR-002 : Toute donnée opérationnelle doit avoir un contexte

Une opération doit toujours être rattachée à son contexte.

Exemple :

Un paiement doit pouvoir être relié à :

- un locataire ;
- un appartement ;
- un contrat ou une dette ;
- une période.

Une dépense doit pouvoir être reliée au minimum à un immeuble.

---

## BR-003 : L'historique ne doit pas être détruit par les changements

Lorsqu'une relation prend fin, les données historiques restent conservées.

Exemple :

Un locataire quitte A04.

Son contrat est terminé.

Son historique de paiement reste disponible.

L'appartement peut ensuite être affecté à un nouveau locataire sans écraser l'ancien historique.

---

## BR-004 : Les permissions sont vérifiées côté serveur

Une action ne doit jamais être autorisée uniquement parce qu'un bouton est visible ou masqué dans l'interface.

Toute opération doit être contrôlée par :

- l'identité de l'utilisateur ;
- son rôle ;
- son organisation ;
- son périmètre d'accès ;
- sa permission ;
- le statut de son accès.

---

# 3. Règles relatives aux organisations

## BR-005 : Isolation des organisations

Les données d'une organisation doivent être strictement séparées de celles des autres organisations.

Un utilisateur appartenant à l'organisation A ne peut jamais accéder aux ressources de l'organisation B sans relation d'accès explicite.

---

## BR-006 : Une donnée ne peut appartenir qu'à une organisation de référence

Un immeuble, un gestionnaire, une charge, une dépense ou toute autre ressource métier doit être rattaché à une organisation identifiable.

Cela permet notamment de garantir l'isolation des données.

---

# 4. Règles relatives aux utilisateurs

## BR-007 : Le compte utilisateur est distinct du rôle

Un utilisateur représente une personne.

Le rôle représente sa fonction dans le système.

Une même personne peut donc avoir plusieurs rôles selon le contexte.

---

## BR-008 : L'utilisateur invité n'est pas actif avant activation

Lorsqu'un propriétaire invite un gestionnaire ou qu'un gestionnaire invite un locataire, le système crée une invitation et éventuellement un profil préliminaire.

Le compte utilisateur devient actif uniquement lorsque l'invitation est acceptée et que l'utilisateur termine son activation.

---

## BR-009 : Une invitation ne doit pas créer de doublon utilisateur

Si le numéro de téléphone ou l'email correspond déjà à un utilisateur existant, le système doit exploiter le compte existant lorsque cela est possible.

Il ne doit pas créer inutilement plusieurs comptes pour la même personne.

---

## BR-010 : Un compte peut changer de contexte

Un même compte peut être associé à plusieurs relations dans le temps.

Exemple :

Mamadou est locataire de A04.

Il quitte A04.

Il devient locataire de B07.

Le compte utilisateur reste le même.

Ce sont ses relations locatives qui changent.

---

# 5. Règles relatives aux invitations

## BR-011 : Chaque invitation possède un identifiant sécurisé unique

Une invitation doit être individualisée et non réutilisable par défaut.

---

## BR-012 : Une invitation possède une durée de validité

Une invitation non utilisée doit expirer après une durée configurable.

Après expiration, l'utilisateur doit recevoir une nouvelle invitation.

---

## BR-013 : Une nouvelle invitation invalide l'ancienne

Lorsqu'une invitation est renvoyée, l'ancien lien devient invalide lorsque le système utilise un mécanisme d'invitation à usage unique.

---

## BR-014 : Une invitation doit être liée à son contexte

Une invitation de gestionnaire doit préciser le contexte d'accès qui lui est attribué.

Une invitation de locataire doit être liée au contexte locatif prévu.

Le système ne doit pas permettre qu'un lien destiné à A04 permette d'accéder à B07.

---

# 6. Règles relatives aux propriétaires

## BR-015 : Le propriétaire conserve l'autorité sur son patrimoine

Le propriétaire reste l'autorité principale pour les ressources qui lui appartiennent.

Il contrôle notamment les accès des gestionnaires.

---

## BR-016 : Le propriétaire peut gérer directement ses biens

Le propriétaire n'est pas obligé de créer un gestionnaire.

Il peut agir lui-même sur les opérations autorisées.

---

# 7. Règles relatives aux gestionnaires

## BR-017 : Le gestionnaire agit uniquement dans son périmètre

Un gestionnaire ne peut agir que sur :

- les immeubles qui lui sont attribués ;
- les fonctionnalités que ses permissions autorisent.

---

## BR-018 : Un gestionnaire ne peut pas s'accorder lui-même de nouveaux droits

Toute augmentation de ses permissions doit venir d'une autorité disposant des droits nécessaires.

Dans le MVP, cette autorité est le propriétaire.

---

## BR-019 : La révocation d'un gestionnaire est immédiate

Lorsqu'un propriétaire révoque le gestionnaire :

- les nouveaux accès sont bloqués immédiatement ;
- ses opérations précédentes restent dans l'historique ;
- les données qu'il a créées restent dans le système.

Un gestionnaire révoqué peut être **réinvité** (DEC-043) : sa ligne d'accès est réactivée, sans second compte, et rien de ce qu'il a fait avant n'est modifié rétroactivement. Un gestionnaire peut aussi être **suspendu** puis réactivé (DEC-044) : la suspension bloque l'accès en conservant son périmètre.

---

# 8. Règles relatives aux locataires

## BR-020 : Le locataire est rattaché à un logement par une relation locative

Le locataire ne doit pas être considéré comme une propriété permanente de l'appartement.

La relation passe par un contrat ou une relation locative active.

---

## BR-021 : Un locataire ne peut voir que ses propres données

Le locataire ne peut accéder qu'aux informations qui concernent :

- son compte ;
- son logement ;
- son contrat ;
- ses loyers ;
- ses paiements ;
- ses charges ;
- ses incidents ;
- ses documents autorisés.

---

## BR-022 : Le locataire ne peut pas modifier les données financières de référence

Le locataire ne peut pas modifier directement :

- le montant contractuel du loyer ;
- la date d'échéance définie au contrat ;
- sa part de charge calculée ;
- son statut de paiement.

Il peut demander une correction au gestionnaire ou utiliser les mécanismes prévus.

---

# 9. Règles relatives aux immeubles

## BR-023 : Un immeuble appartient à une organisation

Un immeuble doit être associé à une organisation.

---

## BR-024 : Un immeuble peut contenir plusieurs appartements

Le nombre d'appartements n'est pas limité à une petite résidence.

Le modèle doit supporter aussi bien :

- un petit immeuble ;
- qu'un portefeuille composé de nombreux immeubles.

---

## BR-025 : L'archivage d'un immeuble ne supprime pas son historique

Lorsqu'un immeuble est archivé :

- il n'est plus considéré comme actif ;
- ses données historiques restent accessibles aux utilisateurs autorisés ;
- ses opérations futures sont bloquées selon les règles du système.

---

# 10. Règles relatives aux appartements

## BR-026 : Un appartement appartient à un seul immeuble

Un appartement ne peut pas appartenir simultanément à plusieurs immeubles.

---

## BR-027 : Un appartement peut avoir plusieurs occupants successifs

Plusieurs contrats successifs peuvent être rattachés au même appartement.

---

## BR-028 : Un appartement ne peut pas avoir deux contrats actifs incompatibles

Le système doit empêcher deux contrats actifs qui se chevauchent pour un même logement lorsque les conditions métier ne permettent pas cette situation.

---

## BR-029 : Le statut d'occupation doit être cohérent

Un appartement lié à un contrat actif doit généralement apparaître comme occupé.

Un appartement sans contrat actif peut apparaître comme vacant, sauf situation particulière définie ultérieurement.

---

# 11. Règles relatives aux contrats

## BR-030 : Un contrat possède une période de validité

Un contrat doit avoir au minimum :

- une date de début ;
- une date de fin lorsqu'elle est applicable.

---

## BR-031 : Le contrat définit le loyer de référence

Le montant contractuel du loyer est la référence principale pour les échéances du contrat.

---

## BR-032 : Une modification de contrat ne modifie pas automatiquement les périodes clôturées

Si le loyer passe de 2 500 000 GNF à 2 800 000 GNF à partir d'octobre :

Les échéances antérieures restent à leur valeur d'origine.

Les futures échéances utilisent le nouveau montant.

---

## BR-033 : Tout changement important d'un contrat doit être traçable

Le système doit conserver :

- ancienne valeur ;
- nouvelle valeur ;
- utilisateur ;
- date ;
- éventuellement raison du changement.

---

# 12. Règles relatives aux échéances de loyer

## BR-034 : Les échéances sont générées à partir des contrats actifs

Le système doit générer automatiquement les échéances selon les paramètres du contrat.

---

## BR-035 : Une échéance appartient à une période identifiable

Exemple :

> Loyer septembre 2026

Cette période ne doit pas être ambiguë.

---

## BR-036 : Une échéance possède un montant attendu

Le montant attendu est déterminé selon le contrat et les éventuelles règles complémentaires.

---

## BR-037 : Le statut de l'échéance découle de sa situation financière

Exemple :

Cette règle s'applique **identiquement** aux créances de loyer et aux créances de charge (DEC-015).

| Situation | Statut |
|---|---|
| Aucun paiement alloué | `UNPAID` |
| Paiement partiel, solde restant | `PARTIALLY_PAID` |
| Solde nul | `PAID` |
| Date d'échéance dépassée avec solde restant | `OVERDUE` |
| Créance annulée | `CANCELLED` |

### Affichage dérivé « À venir »

Lorsque `status = UNPAID` et que la date d'échéance est postérieure à la date du jour, l'interface affiche **« À venir »**.

Ce n'est **pas** un statut stocké : c'est une dérivation de présentation. Le backend ne persiste jamais cette valeur.

### Passage à OVERDUE

Le passage de `UNPAID` ou `PARTIALLY_PAID` vers `OVERDUE` est effectué par un job idempotent, pas au moment de la lecture.

Une créance `PAID` ou `CANCELLED` ne passe jamais à `OVERDUE`.

---

# 13. Règles relatives aux paiements

## BR-038 : Un paiement confirmé augmente le montant payé

Lorsqu'un paiement est confirmé :

```text id="g52drs"
Montant payé
+
Montant du paiement confirmé
=
Nouveau montant payé
```

---

## BR-039 : Le solde est recalculé automatiquement

```text id="d2s3jz"
Solde d'une créance
=
Montant attendu
-
Montant payé confirmé
```

Le solde ne peut jamais être inférieur à zéro.

Le **total dû d'un locataire** est la somme des soldes de ses créances ouvertes, **loyers et charges confondus** :

```text
Total dû
=
somme(soldes des créances UNPAID, PARTIALLY_PAID, OVERDUE)
```

Les trop-perçus n'existent pas au MVP : un paiement supérieur au total dû est refusé (BR-097).

---

## BR-040 : Le paiement partiel ne clôture pas la dette

Exemple :

Montant attendu : 2 800 000 GNF

Paiement : 1 500 000 GNF

Le solde est :

1 300 000 GNF

L'échéance reste ouverte.

---

## BR-041 : Un paiement peut couvrir plusieurs créances

> **Règle du MVP, DEC-022, conséquence de DEC-005.**

L'allocation multi-créances fait partie du périmètre MVP.

Un paiement unique peut couvrir :

- une ou plusieurs créances de loyer ;
- une ou plusieurs créances de charge ;
- une combinaison des deux.

Chaque allocation référence **exactement une** créance.

### Ordre d'allocation automatique

Lorsque le locataire règle un montant global, le système alloue dans un ordre **déterministe** :

```text
1. date d'échéance croissante
2. à date égale : loyer avant charge
3. à date et type égaux : date de création croissante
```

Le même paiement, sur les mêmes créances, doit toujours produire la même répartition.

### Invariants

```text
somme(allocations d'un paiement)  <=  montant du paiement
montant d'une allocation          <=  solde de la créance visée
```

---

## BR-042 : Un paiement confirmé doit conserver sa référence

Une transaction confirmée ne doit pas perdre son identifiant ou sa référence.

---

## BR-043 : Un paiement confirmé n'est jamais supprimé silencieusement

Toute annulation ou correction doit laisser une trace.

---

## BR-044 : Un paiement numérique n'est considéré comme payé qu'après confirmation

Le simple lancement d'une transaction ne suffit pas.

Le statut doit refléter le résultat réel de l'opération.

---

## BR-045 : Un paiement manuel est explicitement identifié

Lorsqu'un gestionnaire enregistre un paiement en espèces ou autre moyen manuel, le système doit conserver :

- utilisateur ayant enregistré ;
- moyen ;
- montant ;
- date ;
- référence ou note si nécessaire.

---

# 14. Règles relatives aux quittances

## BR-046 : Une quittance est générée à partir d'un paiement admissible

La génération est déclenchée selon les règles du paiement.

---

## BR-047 : La quittance doit correspondre aux données du paiement

Le système doit éviter qu'une quittance affiche un montant différent de la transaction qui la justifie.

---

## BR-048 : Une quittance historique ne doit pas être modifiée silencieusement

En cas de correction du paiement source, le système doit conserver une trace de la modification et appliquer la stratégie définie pour les documents.

---

# 15. Règles relatives aux charges communes

## BR-049 : Une charge commence par un montant global

Exemple :

> Facture d'eau : 3 600 000 GNF

Ce montant appartient à l'immeuble.

---

## BR-050 : La méthode de répartition doit être explicite

Chaque charge publiée doit indiquer sa méthode de calcul.

Exemple :

**Répartition égale**

---

## BR-051 : Le total des parts doit correspondre au montant global

Le système doit appliquer une règle d'arrondi afin que :

```text id="u4wzch"
Somme des parts
=
Montant total
```

sauf cas explicitement justifié par une règle métier.

---

## BR-052 : Une charge publiée crée des créances payables

> **Décision verrouillée : DEC-005.**

La publication d'une charge crée, pour chaque appartement concerné, une **créance payable** distincte de l'échéance de loyer.

Chaque créance de charge porte :

```text
montant dû
montant payé
solde
date d'échéance
statut (même cycle que la créance de loyer)
```

Une charge non publiée ne crée aucune créance et n'est visible d'aucun locataire.

La publication est **atomique** : soit toutes les créances sont créées, soit aucune.

Une charge déjà publiée ne peut pas être republiée.

### Appartement vacant

Si un appartement concerné n'a pas de bail actif au moment de la publication, la créance est créée au niveau du logement **sans locataire redevable**.

Elle reste visible du propriétaire et du gestionnaire, et n'apparaît dans aucun espace locataire.

Cette situation figée n'est pas recalculée lorsqu'un nouveau locataire arrive.

---

## BR-053 : Les modifications post-publication sont traçables

Une charge déjà publiée ne doit pas être modifiée silencieusement.

---

## BR-054 : Une charge peut être annulée sans détruire l'historique

L'annulation doit conserver :

- charge initiale ;
- utilisateur ;
- date ;
- raison éventuelle.

---

# 16. Règles relatives aux paiements de charges

## BR-055 : Une charge peut être payée avec le loyer ou séparément

Le produit présente au locataire un **montant global à payer** :

> Loyer + charges = total dû

tout en conservant les deux composantes **distinctes dans les données**.

Le locataire peut régler :

- le total dû en une opération, le système répartissant automatiquement selon BR-041 ;
- ou une créance précise, s'il choisit explicitement de le faire.

---

## BR-056 : Le paiement doit permettre de distinguer les composantes

Exemple :

```text id="2kbgz3"
Créance de loyer septembre : 2 500 000
Créance de charge eau      :   300 000
Total dû                   : 2 800 000
```

Après un paiement de 1 500 000 GNF, le système doit pouvoir répondre précisément :

```text
Loyer septembre   payé 1 500 000   reste 1 000 000   PARTIALLY_PAID
Charge eau        payé         0   reste   300 000   UNPAID
Total dû restant                          1 300 000
```

Cette ventilation provient des **allocations**, jamais d'un calcul d'affichage.

Elle doit être identique dans l'espace locataire, l'espace gestionnaire, la quittance et les tableaux de bord.

---

## BR-056-bis : La quittance ventile les composantes

Une quittance émise pour un paiement couvrant plusieurs créances doit présenter la ventilation par composante, et non un montant global indifférencié.

---

# 17. Règles relatives aux incidents

## BR-057 : Tout incident doit avoir un créateur

Le système doit savoir qui a signalé l'incident.

---

## BR-058 : Un incident est toujours rattaché à un contexte

Il doit être relié à :

- un immeuble ;
- et, lorsque nécessaire, un appartement.

---

## BR-059 : Le locataire peut déclarer un incident sur son logement

Le système connaît automatiquement l'appartement concerné.

Le locataire n'a pas à le sélectionner manuellement sauf cas particulier.

---

## BR-060 : Le statut d'un incident suit un cycle défini

> **Valeurs canoniques : DEC-017.**

```text id="n2rlq0"
OPEN           Nouveau
↓
ASSIGNED       Affecté
↓
IN_PROGRESS    En cours
↓
RESOLVED       Résolu
↓
CLOSED         Clôturé
```

`ON_HOLD` (En attente) peut s'intercaler.

### Transitions autorisées

```text
OPEN        -> ASSIGNED | IN_PROGRESS | CLOSED
ASSIGNED    -> IN_PROGRESS | ON_HOLD | CLOSED
IN_PROGRESS -> ON_HOLD | RESOLVED | CLOSED
ON_HOLD     -> IN_PROGRESS | CLOSED
RESOLVED    -> CLOSED | IN_PROGRESS
CLOSED      -> terminal
```

Toute transition non listée doit être **rejetée par le backend** avec `INVALID_STATE`.

**« À traiter » n'est pas un statut** : c'est un filtre du tableau de bord gestionnaire portant sur `OPEN` et `ASSIGNED`.

### Cycle de l'intervention

L'intervention possède un cycle **distinct** (DEC-018) :

```text
PLANNED -> IN_PROGRESS -> COMPLETED
PLANNED | IN_PROGRESS -> CANCELLED
```

---

## BR-061 : Un incident peut avoir plusieurs interventions

Un problème peut nécessiter plusieurs actions.

Le système doit conserver l'ensemble des interventions associées.

---

# 18. Règles relatives aux interventions

## BR-062 : Une intervention doit être reliée à un incident ou à une tâche de maintenance autorisée

Cela permet de conserver le contexte.

---

## BR-063 : Le coût prévu et le coût réel sont distincts

Le système doit pouvoir afficher :

> Prévu : 500 000 GNF  
> Réel : 450 000 GNF

---

## BR-064 : La clôture d'une intervention ne clôture pas automatiquement toutes les situations

Un incident peut nécessiter plusieurs interventions.

Le système ne doit clôturer l'incident que lorsque la condition de résolution est satisfaite.

---

# 19. Règles relatives aux dépenses

## BR-065 : Toute dépense doit avoir un montant

Le montant doit être supérieur ou égal à zéro selon la nature de l'opération.

---

## BR-066 : Une dépense doit être contextualisée

Elle doit au minimum être rattachée à un immeuble.

Elle peut également être liée à :

- un appartement ;
- un incident ;
- une intervention ;
- un prestataire.

---

## BR-067 : Une dépense validée doit être traçable

Toute modification importante doit conserver un historique.

---

# 20. Règles relatives aux notifications

## BR-068 : Une notification doit être déclenchée par un événement identifiable

Exemples :

- invitation ;
- paiement confirmé ;
- impayé ;
- incident ;
- changement de statut.

---

## BR-069 : Une notification doit pointer vers son contexte

Une notification de paiement doit permettre d'accéder au paiement concerné.

Une notification d'incident doit permettre d'accéder à l'incident.

---

## BR-070 : Les notifications ne doivent pas devenir la source de vérité

Le statut réel de l'opération reste dans l'objet métier.

Exemple :

Une notification indique :

> Paiement reçu.

Le statut réel du paiement reste vérifié dans la transaction.

---

# 21. Règles relatives aux relances

## BR-071 : Les relances automatiques reposent sur le statut réel

Le système ne doit pas envoyer une relance à un locataire dont le loyer est confirmé comme payé.

---

## BR-072 : Les relances doivent respecter des règles d'éligibilité

Une relance peut être déclenchée lorsque :

- une échéance est proche ;
- une échéance est due ;
- un solde reste impayé.

---

## BR-073 : Les relances doivent éviter le spam

Le système doit prévoir des limites ou une logique de fréquence.

Exemple :

Une même dette ne doit pas déclencher plusieurs notifications identiques à quelques minutes d'intervalle.

---

# 22. Règles relatives aux départs de locataires

## BR-074 : La fin d'une relation locative ne supprime pas le locataire

Le locataire devient un ancien locataire pour cet appartement.

---

## BR-075 : Le contrat doit être clôturé

Le contrat passe à l'état approprié.

---

## BR-076 : Les nouvelles échéances doivent cesser

Une fois le contrat terminé, le système ne doit plus générer de nouvelles échéances pour cette relation à partir de la date de fin.

---

## BR-077 : Les dettes antérieures restent dues

La fin du contrat ne supprime pas automatiquement les éventuels impayés antérieurs.

---

# 23. Règles relatives au changement de locataire

Lorsqu'un locataire A quitte A04 et qu'un locataire B arrive :

1. le contrat de A est terminé ;
2. les dettes historiques de A restent liées à A ;
3. l'appartement peut passer temporairement à vacant ;
4. le contrat de B est créé ;
5. B reçoit sa propre relation locative ;
6. B ne voit jamais les données de A.

---

# 24. Règles relatives aux appartements vacants

Un appartement vacant :

- ne doit pas générer de loyer locatif sans contrat actif ;
- ne doit pas avoir de locataire actif ;
- doit rester visible dans le patrimoine ;
- peut conserver ses historiques passés.

---

# 25. Règles relatives aux droits d'accès

## BR-078 : La permission est toujours limitée par le périmètre

Même si un utilisateur possède le rôle gestionnaire, il ne peut pas accéder à un immeuble qui n'est pas dans son périmètre.

---

## BR-079 : La révocation prend effet immédiatement

Après révocation, les nouvelles requêtes doivent être refusées.

Les sessions déjà ouvertes doivent également perdre les droits concernés.

---

## BR-080 : L'historique reste attribué à l'ancien utilisateur

Exemple :

> Paiement enregistré par Mamadou

Même après révocation de Mamadou, cette attribution reste dans l'historique.

---

# 26. Règles relatives aux données historiques

## BR-081 : L'historique financier ne doit pas être écrasé

Les paiements, dépenses et charges importantes doivent être conservés selon la politique de conservation.

---

## BR-082 : Les changements importants doivent être auditables

Exemples :

- changement de loyer ;
- correction de paiement ;
- modification de charge ;
- révocation ;
- clôture de contrat.

---

# 27. Règles relatives aux corrections

## BR-083 : Une correction doit être explicite

Une donnée sensible ne doit pas être modifiée de façon invisible.

---

## BR-084 : Le système doit distinguer modification et création d'une nouvelle opération

Exemple :

Plutôt que de modifier silencieusement un paiement de 2 500 000 GNF en 2 000 000 GNF, le système doit pouvoir conserver la trace du changement.

---

# 28. Règles relatives aux calculs financiers

## BR-085 : Les calculs doivent utiliser la devise associée

> **Convention unique : DEC-014.**

Tout montant est un **entier** exprimé dans la plus petite unité de la devise, accompagné d'un **code ISO 4217 explicite**.

Pour le GNF, l'exposant de sous-unité est 0.

```text
2 500 000 GNF  ->  amount = 2500000, currency = 'GNF'
```

Le système ne doit jamais :

- additionner implicitement des montants dans des devises différentes ;
- utiliser un nombre à virgule flottante dans un calcul financier ;
- supposer une devise non explicitée.

Le formatage d'affichage relève exclusivement du frontend.

---

## BR-086 : Les arrondis doivent être déterministes

Un même calcul avec les mêmes entrées doit produire le même résultat.

### Répartition d'une charge

```text
part_de_base = total ÷ nombre_de_logements     (division entière)
reste        = total - (part_de_base × nombre_de_logements)
```

Le reste est distribué à raison d'**une unité par logement**, dans l'ordre croissant de la référence d'appartement, jusqu'à épuisement.

Exemple :

```text
Total     1 000 GNF
Logements         3

part_de_base  333
reste           1

A01  334
A02  333
A03  333
-----------
somme  1 000   =  total
```

L'invariant `somme des parts = montant total` doit être vérifié **avant** publication et ne jamais être violé ensuite.

---

# 29. Règles relatives aux tableaux de bord

## BR-087 : Les indicateurs doivent être calculés à partir des données sources

Exemple :

**Loyers encaissés**

doit correspondre à la somme des paiements admissibles selon les règles retenues.

---

## BR-088 : Les indicateurs doivent avoir une période explicite

Exemple :

> Loyers encaissés en septembre 2026.

et non simplement :

> Loyers encaissés.

---

## BR-089 : Les chiffres doivent pouvoir être expliqués

Lorsqu'un utilisateur voit :

> 27 500 000 GNF encaissés

il doit pouvoir accéder à la liste des paiements qui composent ce montant.

---

# 30. Règles relatives aux rapports

Tout rapport doit préciser :

- période ;
- immeuble ;
- date de génération ;
- utilisateur ou système à l'origine ;
- données utilisées.

Les rapports historiques doivent conserver la période à laquelle ils correspondent.

---

# 31. Règles relatives aux documents

## BR-090 : Un document doit avoir un contexte

Un fichier ne doit pas être stocké sans savoir à quelle donnée il appartient.

---

## BR-091 : Un document critique doit être protégé contre l'accès public

Les contrats, justificatifs et documents financiers ne doivent pas être accessibles par une URL publique non protégée.

---

# 32. Cas particulier : propriétaire gestionnaire

Si une personne est à la fois propriétaire et gestionnaire :

- elle peut exercer les deux ensembles de permissions ;
- elle ne doit pas être obligée de créer deux comptes ;
- les actions doivent rester correctement journalisées.

---

# 33. Cas particulier : plusieurs gestionnaires

Plusieurs gestionnaires peuvent travailler sur le même immeuble.

Le système doit accepter les modifications successives et conserver la trace de l'auteur de chaque action.

Lorsqu'une opération est simultanée, le système doit éviter les écrasements silencieux.

---

# 34. Cas particulier : deux gestionnaires modifient la même donnée

Le système doit prévoir un mécanisme de cohérence.

Exemple :

Gestionnaire A ouvre un contrat.

Gestionnaire B modifie le même contrat.

La première version ne doit pas écraser silencieusement les modifications de la seconde.

Une stratégie de verrouillage, de versionnement ou de contrôle de concurrence sera définie techniquement.

---

# 35. Cas particulier : paiement en double

Le système doit détecter autant que possible les paiements numériques potentiellement dupliqués en utilisant des références transactionnelles ou autres identifiants disponibles.

Un paiement confirmé ne doit pas être comptabilisé deux fois simplement à cause de deux notifications identiques.

---

# 36. Cas particulier : transaction en attente

Un paiement en attente ne doit pas être considéré comme encaissé.

Exemple :

```text id="f22x93"
Paiement initié
↓
En attente
```

Tant que la confirmation n'est pas reçue :

**Montant encaissé = 0**

pour cette transaction.

---

# 37. Paiement supérieur au montant dû

## BR-097 : Un paiement supérieur au total dû est refusé

> **Règle arrêtée : DEC-023.** Cette règle n'est plus une option ouverte.

Exemple :

```text
Total dû   : 2 800 000 GNF
Paiement   : 3 000 000 GNF
Résultat   : REFUSÉ
```

Code d'erreur :

```text
AMOUNT_EXCEEDS_OUTSTANDING
```

### Justification

- le solde d'une créance ne peut jamais être négatif (BR-039) ;
- la notion de crédit, d'avoir ou de trop-perçu n'appartient pas au périmètre MVP ;
- l'introduire créerait une entité financière non prévue.

### Conséquences pratiques

**Paiement digital** : le montant proposé est calculé par le serveur et plafonné au total dû. Le client ne choisit jamais librement un montant supérieur.

**Paiement manuel en espèces** : le gestionnaire enregistre le montant réellement **imputé**. La monnaie rendue au locataire n'est pas un objet du système.

### Paiement en avance

Payer une créance dont la date d'échéance est future **n'est pas** un trop-perçu : la créance existe déjà et porte un solde.

Ce cas est autorisé et normal.

La gestion des crédits est classée Future Evolution.

---

# 38. Cas particulier : charge supérieure à la facture

Le système doit empêcher la publication d'une répartition dont la somme dépasse le montant global de la facture.

---

# 39. Cas particulier : appartement sans locataire

L'appartement peut exister sans locataire actif.

Il reste dans le patrimoine mais ne génère pas d'échéances locatives tant qu'aucun contrat actif ne l'exige.

---

# 40. Cas particulier : locataire invité mais non activé

Le profil locataire peut être créé avant l'activation du compte.

Il peut être rattaché à l'appartement.

Mais certaines actions nécessitant une authentification du locataire ne sont pas disponibles avant activation.

---

# 41. Cas particulier : numéro de téléphone déjà utilisé

Si le numéro existe déjà :

- le système identifie l'utilisateur ;
- évite le doublon ;
- propose une relation supplémentaire si elle est autorisée.

---

# 42. Cas particulier : mauvais numéro lors d'une invitation

Si l'invitation n'est pas encore activée :

- le gestionnaire peut corriger le numéro ;
- l'ancienne invitation est invalidée ;
- une nouvelle invitation est générée.

Si le compte a déjà été activé, le changement de numéro suit la procédure de modification du compte.

---

# 43. Cas particulier : gestionnaire révoqué pendant une opération

Si un propriétaire révoque un gestionnaire alors qu'il travaille dans le système :

Les prochaines opérations doivent être refusées.

Les opérations déjà confirmées avant la révocation restent valides selon leur état.

---

# 44. Cas particulier : locataire qui quitte l'immeuble avec un impayé

Le contrat peut être terminé.

Le compte locataire peut être désactivé pour l'accès à son ancien logement.

Mais :

- l'impayé reste enregistré ;
- l'historique reste conservé ;
- le montant dû ne disparaît pas automatiquement.

---

# 45. Cas particulier : modification du loyer en cours de période

Le système doit demander une date d'effet.

Exemple :

Ancien loyer :

2 500 000 GNF

Nouveau loyer :

2 800 000 GNF

Date d'effet :

01/10/2026

Les échéances de septembre restent à 2 500 000 GNF.

Les échéances d'octobre utilisent 2 800 000 GNF.

---

# 46. Cas particulier : changement de propriétaire

Ce cas n'appartient pas au cœur du MVP.

Cependant, l'architecture doit éviter que les données soient structurées de manière impossible à transférer ultérieurement.

Une procédure de transfert de patrimoine pourra être spécifiée dans une future version.

---

# 47. Cas particulier : suppression

## Règle générale

Les utilisateurs ne doivent presque jamais utiliser une suppression destructive pour corriger une situation métier.

Préférer :

- archiver ;
- désactiver ;
- révoquer ;
- annuler ;
- clôturer.

---

# 48. Règles de confidentialité

## BR-092 : Les données personnelles sont limitées selon le rôle

Un locataire ne doit pas voir le numéro de téléphone d'un autre locataire.

---

## BR-093 : Les données financières ne sont pas publiques

Les loyers, revenus, dépenses et charges doivent être protégés selon les permissions.

---

## BR-094 : Les documents privés nécessitent une autorisation

Un lien vers un contrat ou un justificatif doit être contrôlé.

---

# 49. Règles de notification

## BR-095 : Les notifications sont liées aux préférences utilisateur

Un utilisateur peut éventuellement choisir certains canaux ou types de notifications selon les paramètres disponibles.

---

## BR-096 : Les événements critiques peuvent rester obligatoires

Certaines notifications sensibles peuvent être nécessaires à la sécurité du compte ou au fonctionnement du service.

---

# 50. Priorité des règles

Toutes les règles ne sont pas équivalentes.

## Niveau critique

- isolation des données ;
- permissions ;
- paiements ;
- historique financier ;
- contrat ;
- sécurité ;
- révocation.

## Niveau élevé

- loyers ;
- charges ;
- maintenance ;
- documents ;
- notifications.

## Niveau normal

- préférences ;
- personnalisation ;
- fonctions de confort.

Cette hiérarchie doit guider les tests et les priorités de développement.

---

# 51. Critères de validation métier

Le moteur métier du MVP doit notamment être capable de démontrer les scénarios suivants.

### Scénario 1

Un propriétaire crée un immeuble et invite un gestionnaire.

Le gestionnaire ne voit que les immeubles auxquels il a accès.

### Scénario 2

Le gestionnaire ajoute un locataire et lui envoie une invitation.

Le locataire reçoit un espace préconfiguré.

### Scénario 3

Le locataire paie son loyer.

Le paiement confirmé réduit automatiquement le solde de l'échéance.

### Scénario 4

Le locataire paie partiellement.

Le solde restant est correctement calculé.

### Scénario 5

Une facture d'eau est répartie.

La somme des parts correspond au montant global.

### Scénario 6

Un locataire signale une fuite.

Le gestionnaire voit l'incident dans son portefeuille.

### Scénario 7

Le gestionnaire enregistre une intervention.

La dépense liée apparaît dans les finances de l'immeuble.

### Scénario 8

Le propriétaire révoque le gestionnaire.

Le gestionnaire perd immédiatement ses accès.

### Scénario 9

Le locataire quitte l'appartement.

L'ancien historique est conservé et le logement peut recevoir un nouveau locataire.

### Scénario 10

Une correction financière est réalisée.

La correction reste entièrement traçable.

---

# 52. Principes pour les futurs développements

Toute nouvelle fonctionnalité devra répondre à quatre questions :

1. **Quelle donnée est concernée ?**
2. **Qui peut agir dessus ?**
3. **Quelle règle métier s'applique ?**
4. **Quel historique doit être conservé ?**

Aucune fonctionnalité ne doit être ajoutée uniquement au niveau de l'interface sans définir son comportement métier.

---

# 53. Synthèse

Les règles métier constituent le moteur logique du produit.

Elles garantissent que :

- les propriétaires contrôlent leur patrimoine ;
- les gestionnaires peuvent réellement travailler ;
- les locataires disposent d'une expérience simple ;
- les paiements restent fiables ;
- les charges sont explicables ;
- les incidents sont traçables ;
- les données historiques sont conservées ;
- les permissions restent maîtrisées ;
- les tableaux de bord reposent sur des données cohérentes.

Le principe fondamental reste :

> **La plateforme doit automatiser les règles prévisibles et rendre visibles les situations qui nécessitent une décision humaine.**