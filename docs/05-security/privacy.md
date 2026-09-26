# Data Protection & Privacy Specification

## 1. Objet du document

Ce document définit les principes et exigences de protection des données du SaaS de gestion d'immeubles.

Il précise :

- quelles données sont collectées ;
- pourquoi elles sont collectées ;
- qui peut y accéder ;
- comment elles sont protégées ;
- comment elles sont conservées ;
- comment elles sont modifiées ;
- comment elles sont archivées ;
- comment les documents privés sont protégés ;
- comment les notifications externes doivent être conçues ;
- comment les accès sont contrôlés ;
- comment les données sont supprimées ou conservées ;
- comment gérer les demandes relatives aux données personnelles.

L'objectif est de construire un produit qui traite les données personnelles de manière proportionnée, sécurisée et compréhensible.

---

# 2. Principes fondamentaux

## PRIV-001 : Minimisation

Le produit ne doit collecter que les données nécessaires à son fonctionnement.

Ne pas collecter une donnée simplement parce qu'elle pourrait être utile plus tard.

---

## PRIV-002 : Finalité

Chaque catégorie de données doit avoir une finalité claire.

Exemple :

```text id="kh69cb"
Numéro de téléphone
↓
Identification
+
Invitation
+
Notifications
```

Une donnée ne doit pas être utilisée pour une finalité totalement différente sans justification.

---

## PRIV-003 : Accès limité

La présence d'une donnée dans le système ne signifie pas que tous les utilisateurs peuvent la voir.

L'accès dépend de :

```text id="vsg13p"
Organisation
↓
Rôle
↓
Scope
↓
Permission
↓
Ressource
```

---

## PRIV-004 : Sécurité par conception

La protection des données doit être intégrée aux fonctionnalités dès leur conception.

Elle ne doit pas être ajoutée uniquement après développement.

---

## PRIV-005 : Conservation proportionnée

Les données doivent être conservées aussi longtemps que nécessaire au fonctionnement du produit ou aux obligations applicables, puis archivées ou supprimées selon les règles définies.

Les durées exactes doivent être validées selon le contexte juridique et contractuel du service.

---

## PRIV-006 : Transparence

L'utilisateur doit pouvoir comprendre :

- quelles données sont traitées ;
- pourquoi ;
- par qui ;
- dans quelles circonstances ;
- comment exercer ses droits lorsque ceux-ci sont applicables.

---

# 3. Classification des données

Le système doit catégoriser les données afin de déterminer les protections appropriées.

## Catégorie A : Données d'identité

Exemples :

- nom ;
- prénom ;
- identifiant utilisateur ;
- téléphone ;
- email.

---

## Catégorie B : Données locatives

Exemples :

- appartement ;
- contrat ;
- date de début ;
- date de fin ;
- loyer ;
- statut locatif.

---

## Catégorie C : Données financières

Exemples :

- paiements ;
- montants dus ;
- charges ;
- dépenses ;
- quittances.

---

## Catégorie D : Documents

Exemples :

- contrat ;
- justificatif ;
- photo ;
- document locatif ;
- facture.

---

## Catégorie E : Données techniques

Exemples :

- logs ;
- request ID ;
- événements techniques ;
- erreurs ;
- appareil ;
- navigateur.

---

## Catégorie F : Données analytics

Exemples :

- événements d'utilisation ;
- vues ;
- actions ;
- parcours.

---

# 4. MVP

# 4.1 Registre minimal des données

## MVP-PRIV-001

Chaque modèle principal doit avoir une définition claire de :

```text
Donnée
Finalité
Source
Propriétaire
Accès
Conservation
Protection
```

---

# 5. User

## MVP-PRIV-002

Le profil utilisateur peut contenir notamment :

- identifiant ;
- nom ;
- prénom ;
- téléphone ;
- email ;
- statut ;
- préférences nécessaires.

Les champs facultatifs doivent réellement rester facultatifs lorsqu'ils ne sont pas nécessaires au fonctionnement du compte.

---

# 6. Organisation

## MVP-PRIV-003

Les informations d'organisation sont isolées dans leur contexte.

Un utilisateur appartenant à l'organisation A ne doit pas voir les informations privées de l'organisation B.

---

# 7. Gestionnaires

## MVP-PRIV-004

Les informations d'un gestionnaire doivent être accessibles uniquement aux utilisateurs ayant un besoin fonctionnel légitime.

Le locataire n'a pas automatiquement accès aux données privées des gestionnaires.

---

# 8. Locataires

## MVP-PRIV-005

Les informations personnelles du locataire sont protégées.

Un locataire ne doit notamment pas pouvoir consulter les données personnelles d'un autre locataire simplement parce qu'ils occupent le même immeuble.

---

# 9. Données de logement

## MVP-PRIV-006

Les informations suivantes doivent être protégées selon leur contexte :

- appartement ;
- occupant ;
- contrat ;
- loyer ;
- charges ;
- incidents ;
- documents.

L'existence d'un appartement peut éventuellement être visible dans certains contextes, mais les données personnelles qui lui sont associées restent protégées.

---

# 10. Données financières

## MVP-PRIV-007

Les données financières sont considérées comme sensibles dans le contexte métier.

Elles doivent être limitées :

- par rôle ;
- par organisation ;
- par périmètre ;
- par ressource.

---

## MVP-PRIV-008 : Pas de fuite par les listes

Une liste de paiements ne doit pas retourner plus de données que nécessaire.

Par exemple, un locataire ne doit pas recevoir une réponse API contenant les paiements de tous les occupants de l'immeuble pour ensuite les cacher dans l'interface.

---

# 11. Documents privés

## MVP-PRIV-009

Les documents privés doivent être stockés dans un espace non public.

Le système doit effectuer un contrôle d'accès avant de fournir un document.

---

## MVP-PRIV-010 : URLs temporaires

Lorsque des URLs temporaires sont utilisées :

- elles doivent avoir une durée de validité limitée ;
- elles ne doivent pas être prévisibles ;
- elles ne doivent être générées qu'après vérification des permissions.

---

# 12. Photos d'incidents

## MVP-PRIV-011

Les photos d'incident doivent être traitées comme des contenus privés.

Le système doit éviter qu'une simple connaissance de l'URL permette de les consulter.

---

# 13. Pièces justificatives

## MVP-PRIV-012

Les justificatifs de dépenses, paiements ou contrats doivent suivre le même modèle de protection.

---

# 14. Téléphone et email

## MVP-PRIV-013

Les coordonnées de contact doivent être utilisées uniquement dans les contextes prévus :

- authentification ;
- invitation ;
- notifications ;
- récupération de compte ;
- communication fonctionnelle.

---

# 15. Affichage partiel

Lorsque cela est pertinent, certaines interfaces peuvent utiliser un affichage partiellement masqué.

Exemple :

```text id="yvfgna"
+224 *** ** ** 45
```

Cette technique ne remplace pas l'autorisation backend.

---

# 16. Logs

## MVP-PRIV-014

Les logs techniques doivent éviter les données personnelles inutiles.

Ne pas enregistrer systématiquement :

- numéro de téléphone complet ;
- email complet ;
- document privé ;
- contenu complet d'un incident ;
- informations financières sans nécessité.

---

# 17. Audit

## MVP-PRIV-015

L'audit doit enregistrer suffisamment d'informations pour comprendre l'action sans recopier inutilement l'intégralité des données personnelles.

Exemple :

```text id="x84tbs"
Actor:
User 123

Action:
payment.updated

Resource:
Payment 456

Timestamp:
2026-09-17T...
```

---

# 18. Analytics

## MVP-PRIV-016

Product Analytics ne doit pas recevoir les données personnelles inutiles.

Préférer :

```text id="yl9cj1"
tenant_invited
```

à :

```text id="2xspr7"
tenant_invited_to="+224xxxxxxxx"
```

lorsque le numéro n'est pas nécessaire à l'analyse.

---

# 19. Données des paiements

## MVP-PRIV-017

Le produit ne doit pas stocker de données de paiement sensibles qu'il n'a pas besoin de conserver.

Lorsqu'un fournisseur externe traite une donnée sensible, le système doit conserver uniquement les références nécessaires au suivi métier.

---

# 20. Webhooks

## MVP-PRIV-018

Les données provenant des fournisseurs doivent être :

- validées ;
- limitées ;
- transformées en données métier nécessaires.

Ne pas stocker automatiquement tout le payload fournisseur sans justification.

---

# 21. Invitations

## MVP-PRIV-019

Les invitations contiennent des informations potentiellement sensibles.

Les tokens doivent :

- être imprévisibles ;
- expirer ;
- être à usage limité ;
- être révoquables.

---

# 22. Liens externes

## MVP-PRIV-020

Un lien d'invitation, de récupération ou d'accès à un document ne doit pas exposer inutilement :

- identifiants internes ;
- informations personnelles ;
- données financières.

---

# 23. Recherche

## MVP-PRIV-021

Les résultats de recherche doivent être filtrés avant d'être retournés à l'utilisateur.

Le système ne doit pas :

```text id="u6gk7n"
Retourner toutes les données
↓
Masquer dans le frontend
```

---

# 24. Exports

## MVP-PRIV-022

Un export doit être considéré comme une copie de données potentiellement sensible.

Avant export :

- vérifier le droit d'accès ;
- limiter le périmètre ;
- limiter les champs ;
- enregistrer l'opération lorsque nécessaire.

---

# 25. Partage de données

## MVP-PRIV-023

Le produit ne doit pas exposer automatiquement les données d'un utilisateur à un autre utilisateur.

Toute fonction de partage doit définir explicitement :

```text
Qui partage ?
Avec qui ?
Quelles données ?
Pendant combien de temps ?
Pourquoi ?
```

---

# 26. Notifications externes

## MVP-PRIV-024

Les notifications via :

- SMS ;
- WhatsApp ;
- email ;

doivent contenir uniquement les informations nécessaires.

Exemple :

```text id="jx9jpi"
Votre paiement a été confirmé.
Consultez votre espace pour plus de détails.
```

peut être préférable à un message contenant toutes les informations financières et contractuelles.

---

# 27. Notifications sur écran verrouillé

## MVP-PRIV-025

Les notifications push ou système doivent éviter d'exposer des données sensibles lorsque le téléphone peut être consulté par une autre personne.

---

# 28. Contenu des messages

## MVP-PRIV-026

Le système doit permettre de différencier :

### Message minimal

Informations générales.

### Message détaillé

Informations accessibles après authentification.

---

# 29. Données de staging

## MVP-PRIV-027

Le staging ne doit pas utiliser inutilement les données personnelles réelles.

Préférer :

- données synthétiques ;
- anonymisation ;
- fixtures de test.

---

# 30. Développement local

## MVP-PRIV-028

Les données de production ne doivent pas être copiées localement sans nécessité et autorisation appropriée.

---

# 31. Sauvegardes

## MVP-PRIV-029

Les sauvegardes doivent bénéficier d'un niveau de protection au moins équivalent à celui des données originales.

Une sauvegarde contenant les données des utilisateurs ne doit pas être considérée comme un simple fichier technique.

---

# 32. Suppression

## MVP-PRIV-030

Le système doit distinguer :

```text id="lp5q6j"
Suppression d'un compte
≠
Suppression de l'historique métier
```

La suppression d'un compte ne doit pas détruire automatiquement des données nécessaires à l'intégrité des historiques, lorsque leur conservation est requise.

---

# 33. Archivage

## MVP-PRIV-031

Lorsqu'une donnée ne doit plus être active mais doit être conservée, privilégier :

- archivage ;
- désactivation ;
- statut terminé ;
- relation historique.

---

# 34. Départ d'un locataire

## MVP-PRIV-032

Le départ d'un locataire doit conserver notamment :

- contrat historique ;
- paiements ;
- quittances ;
- incidents historiques ;
- documents nécessaires.

Son accès actif au logement doit être retiré.

---

# 35. Révocation d'un gestionnaire

## MVP-PRIV-033

Après révocation :

- accès actif supprimé ;
- historique conservé ;
- traces d'audit conservées ;
- données personnelles toujours protégées.

---

# 36. Changement de coordonnées

## MVP-PRIV-034

Le changement de :

- téléphone ;
- email ;

doit être protégé par une vérification appropriée.

---

# 37. Changement de rôle

## MVP-PRIV-035

Un changement de rôle ne doit pas donner accès rétroactivement à des données non autorisées par le nouveau contexte.

Le système doit recalculer les droits selon la nouvelle relation.

---

# 38. Accès par appareil

## MVP-PRIV-036

Le système ne doit pas considérer qu'un utilisateur est autorisé uniquement parce qu'il utilise un appareil déjà connu.

L'identité et la session restent les principales sources d'autorisation.

---

# 39. Sessions

## MVP-PRIV-037

Les sessions doivent respecter les règles définies dans Security & Access Control Specification.

Lorsqu'une session n'est plus valide, l'accès aux données protégées doit être bloqué.

---

# 40. Cache navigateur

## MVP-PRIV-038

Les données personnelles ne doivent pas être mises en cache de manière incontrôlée.

Le système doit limiter la persistance locale des informations sensibles.

---

# 41. PWA

## MVP-PRIV-039

La PWA ne doit pas créer un accès permanent aux données pour toute personne utilisant le même appareil.

---

# 42. Multi-tenant

## MVP-PRIV-040

L'isolation entre organisations est une exigence de confidentialité fondamentale.

Tester :

```text id="6jlyby"
Organization A
≠
Organization B
```

sur :

- API ;
- database ;
- documents ;
- recherche ;
- exports ;
- analytics ;
- notifications.

---

# 43. Accès interne

## MVP-PRIV-041

Les accès internes de l'équipe au système de production doivent être limités aux personnes et opérations nécessaires.

---

# 44. Principe du moindre privilège interne

## MVP-PRIV-042

Les accès administratifs ne doivent pas être plus larges que nécessaire.

---

# 45. Accès aux données pour le support

## MVP-PRIV-043

Un éventuel accès support aux données des utilisateurs doit être :

- contrôlé ;
- limité ;
- justifié ;
- traçable.

---

# 46. Export par support

## MVP-PRIV-044

Les données utilisateur ne doivent pas être exportées manuellement pour résoudre un problème sans procédure appropriée.

---

# 47. Demande d'accès aux données

## MVP-PRIV-045

Le produit doit pouvoir identifier les données principales associées à un utilisateur.

Cela facilite une future procédure de consultation ou d'export des données personnelles.

---

# 48. Correction des données

## MVP-PRIV-046

Le système doit permettre la correction de certaines données utilisateur lorsque celle-ci est autorisée.

La correction d'une donnée actuelle ne doit pas effacer l'historique lorsqu'il est nécessaire à l'intégrité du système.

---

# 49. Traçabilité

## MVP-PRIV-047

Les modifications importantes de données personnelles ou de relations métier doivent pouvoir être retracées lorsque cela est nécessaire.

---

# 50. Data Retention

## MVP-PRIV-048

Les catégories de données doivent avoir des règles de conservation documentées.

Exemple :

```text
User
Lease
Payment
Receipt
Incident
Document
Audit
```

La durée exacte doit être validée selon :

- besoin métier ;
- obligations applicables ;
- contrats ;
- contraintes opérationnelles.

---

# 51. Purge

## MVP-PRIV-049

Une purge automatique ne doit jamais être mise en place sans définir précisément :

```text id="m7cs00"
Quoi ?
Pourquoi ?
Quand ?
Quelle exception ?
Quel impact historique ?
```

---

# 52. Suppression logique

## MVP-PRIV-050

Lorsque la suppression physique n'est pas appropriée, utiliser :

- `archived`;
- `inactive`;
- `revoked`;
- `ended`;

selon le modèle métier.

---

# 53. Fichiers orphelins

## MVP-PRIV-051

Le système doit prévoir une stratégie pour éviter que des fichiers privés deviennent définitivement orphelins ou impossibles à gérer.

---

# 54. Données de test

## MVP-PRIV-052

Les fixtures doivent utiliser des données fictives.

Ne pas mettre de vraies coordonnées personnelles dans Git.

---

# 55. Logs de développement

## MVP-PRIV-053

Les logs locaux ne doivent pas encourager la pratique consistant à afficher des données personnelles complètes.

Préférer les identifiants techniques.

---

# 56. Droit d'accès métier

Le droit d'accès à une donnée doit être déterminé en fonction de :

```text id="um7vaf"
Identity
+
Role
+
Scope
+
Permission
+
Relationship
```

---

# 57. Sécurité des relations

## MVP-PRIV-054

Une relation :

```text
User → Tenant
```

ou :

```text
User → Manager
```

doit être contrôlée comme une relation d'accès et non simplement comme une donnée.

---

# 58. Privacy by Design dans les écrans

## MVP-PRIV-055

Les écrans doivent éviter d'afficher inutilement des informations personnelles.

Exemple :

Une liste de locataires peut n'afficher que :

```text
Nom
Appartement
Statut
```

sans afficher systématiquement toutes les coordonnées.

---

# 59. Privacy by Design dans les tableaux

## MVP-PRIV-056

Sur mobile, les informations détaillées peuvent être déplacées dans la fiche secondaire afin de réduire l'exposition sur l'écran principal.

---

# 60. Privacy by Design dans les documents

## MVP-PRIV-057

Un document doit être affiché uniquement après vérification de l'autorisation.

---

# 61. Data Mapping

Le projet doit disposer d'une cartographie minimale :

```text id="8j8fll"
User
├── Identity
├── Contact
└── Authentication

Property
├── Address
└── Metadata

Tenant
├── Profile
├── Lease
├── Rent
└── Documents

Payment
├── Financial Data
└── Provider Reference
```

---

# 62. Data Flow

Les flux critiques doivent être documentés.

Exemple :

```text id="3moycp"
Tenant
↓
Frontend
↓
API
↓
Business Logic
↓
PostgreSQL
↓
Payment Provider
↓
Webhook
↓
PostgreSQL
```

---

# 63. Données externes

## MVP-PRIV-058

Lorsqu'une donnée est transmise à un fournisseur externe, le produit doit savoir :

- quelle donnée ;
- à quel fournisseur ;
- pour quelle finalité ;
- dans quel processus.

---

# 64. Fournisseurs

Les catégories de fournisseurs peuvent inclure :

- authentification ;
- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage ;
- analytics ;
- monitoring.

La liste exacte des fournisseurs doit être maintenue dans la documentation d'exploitation.

---

# 65. Secrets de fournisseurs

## MVP-PRIV-059

Les credentials permettant d'accéder aux services externes ne doivent jamais être considérés comme des données applicatives ordinaires.

Ils doivent être stockés dans des mécanismes sécurisés de gestion des secrets.

---

# 66. Incident de confidentialité

## MVP-PRIV-060

Une exposition non autorisée de données doit déclencher une procédure d'incident.

Flux :

```text id="2n1p07"
Détection
↓
Contenir
↓
Évaluer
↓
Corriger
↓
Documenter
↓
Notifier lorsque nécessaire
```

---

# 67. Tests de confidentialité

Avant production, tester au minimum :

### Test 1

Locataire A ne voit pas Locataire B.

### Test 2

Gestionnaire A ne voit pas un immeuble hors scope.

### Test 3

Organisation A ne voit pas Organisation B.

### Test 4

Document privé inaccessible sans permission.

### Test 5

Export limité au périmètre autorisé.

### Test 6

Recherche limitée au périmètre autorisé.

### Test 7

Notification externe ne révèle pas inutilement des données privées.

---

# 68. Future Evolutions

Les éléments suivants pourront être approfondis après le MVP.

## FUT-PRIV-001 : Centre de confidentialité utilisateur

Permettre à l'utilisateur de consulter plus facilement :

- données principales ;
- préférences ;
- historique des accès ;
- options de confidentialité.

---

## FUT-PRIV-002 : Export utilisateur avancé

Générer un export structuré des données personnelles d'un utilisateur.

---

## FUT-PRIV-003 : Suppression self-service avancée

Mettre en place un parcours complet permettant à l'utilisateur de demander certaines suppressions ou désactivations selon les règles applicables.

---

## FUT-PRIV-004 : Gestion avancée des consentements

Introduire une gestion détaillée de certains consentements lorsque les finalités du produit le nécessitent.

---

## FUT-PRIV-005 : Data Retention Automation

Automatiser certaines politiques d'archivage ou de purge une fois les règles juridiquement et opérationnellement validées.

---

## FUT-PRIV-006 : Privacy Dashboard interne

Créer un tableau de bord permettant de suivre :

- demandes utilisateurs ;
- incidents ;
- catégories de données ;
- accès internes ;
- cycles de conservation.

---

# 69. Architecture Constraints Related to Future Evolutions

## ARCH-PRIV-001 : Séparer identité et profil métier

Conserver la distinction :

```text id="egljfy"
User
≠
Tenant Profile
≠
Lease
```

Cela facilite les changements de logement et de relation locative.

---

## ARCH-PRIV-002 : Historique relationnel

Les relations importantes doivent être historisées au lieu d'être simplement remplacées.

---

## ARCH-PRIV-003 : Data Access Layer

L'accès aux données doit pouvoir appliquer les règles de confidentialité de manière centralisée.

---

## ARCH-PRIV-004 : Provider abstraction

Les fournisseurs externes ne doivent pas devenir indissociables du modèle métier.

---

## ARCH-PRIV-005 : Data classification

Les modèles importants doivent pouvoir être classifiés par niveau de sensibilité.

---

## ARCH-PRIV-006 : Audit extensible

L'architecture d'audit doit pouvoir évoluer pour tracer certains accès sensibles supplémentaires sans reconstruire tout le système.

---

# 70. Out of Scope

## OUT-PRIV-001

Construire dès le MVP un centre complet de gestion de toutes les préférences de confidentialité.

---

## OUT-PRIV-002

Construire une plateforme dédiée de Data Governance.

---

## OUT-PRIV-003

Mettre en place un Data Warehouse de gouvernance complet.

---

## OUT-PRIV-004

Automatiser toutes les demandes juridiques de suppression ou d'accès sans validation des processus applicables.

---

## OUT-PRIV-005

Collecter systématiquement plus de données personnelles sous prétexte de préparer des fonctions futures.

---

# 71. Documentation obligatoire

Le projet doit conserver une documentation minimale sur :

```text id="1ql4sn"
Catégorie de donnée
Finalité
Source
Stockage
Accès
Fournisseur externe
Conservation
Suppression / archivage
```

---

# 72. Definition of Done Privacy

Une fonctionnalité traitant des données personnelles est considérée comme terminée lorsque :

```text
[ ] Finalité définie
[ ] Données minimisées
[ ] Accès défini
[ ] Permissions serveur
[ ] Stockage approprié
[ ] Logs contrôlés
[ ] Analytics contrôlés
[ ] Notifications contrôlées
[ ] Tests de confidentialité
[ ] Documentation mise à jour
```

---

# 73. Checklist avant production

```text
## Données
[ ] Data inventory
[ ] Classification
[ ] Finalité
[ ] Conservation

## Accès
[ ] RBAC
[ ] Scope
[ ] Multi-tenant isolation
[ ] Documents privés

## Technique
[ ] HTTPS
[ ] Secrets protégés
[ ] Logs nettoyés
[ ] Backups protégés

## Analytics
[ ] No passwords
[ ] No secrets
[ ] No unnecessary PII

## Fournisseurs
[ ] Payment
[ ] Messaging
[ ] Email
[ ] Storage
[ ] Analytics

## Incidents
[ ] Procedure
[ ] Logs
[ ] Monitoring
```

---

# 74. Règle finale

La protection des données ne doit pas être traitée comme une fonctionnalité séparée du produit.

Elle doit être intégrée à chaque couche :

```text id="9jjddu"
Collecte
↓
Stockage
↓
Traitement
↓
Accès
↓
Partage
↓
Conservation
↓
Archivage / Suppression
```

La règle directrice est :

> **Collecter moins, exposer moins, conserver ce qui est nécessaire et toujours contrôler qui peut accéder à quoi.**