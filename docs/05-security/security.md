# Security & Access Control Specification

## 1. Objet du document

Ce document définit les exigences de sécurité du SaaS de gestion d'immeubles.

Il couvre :

- l'authentification ;
- l'autorisation ;
- les rôles ;
- les permissions ;
- l'isolation entre organisations ;
- les invitations ;
- les sessions ;
- la protection des données personnelles ;
- les paiements ;
- les fichiers ;
- les webhooks ;
- les journaux d'audit ;
- la protection contre les abus ;
- les secrets ;
- les sauvegardes ;
- les incidents de sécurité.

L'objectif n'est pas de construire une infrastructure excessivement complexe pour le MVP, mais de garantir que les fondations ne compromettent ni les utilisateurs ni les données.

---

# 2. Principes fondamentaux

## SEC-001 : La sécurité est côté serveur

L'interface peut masquer une action interdite, mais cela ne constitue jamais une mesure de sécurité suffisante.

Toute action sensible doit être vérifiée côté serveur.

---

## SEC-002 : Principe du moindre privilège

Chaque utilisateur doit disposer uniquement des droits nécessaires à son rôle et à son périmètre.

---

## SEC-003 : Isolation stricte des organisations

Une organisation ne doit jamais accéder aux données d'une autre organisation.

---

## SEC-004 : Les opérations financières sont particulièrement protégées

Les paiements, corrections, remboursements et opérations liées aux charges doivent avoir des contrôles supplémentaires.

---

## SEC-005 : Les changements importants sont traçables

Une opération critique doit pouvoir être attribuée à un utilisateur ou au système.

---

# 3. Modèle de sécurité

Le contrôle d'accès repose sur plusieurs niveaux :

```text id="hz2m9k"
Identité
↓
Session
↓
Organisation
↓
Rôle
↓
Périmètre
↓
Permission
↓
Ressource
↓
Action
```

Exemple :

```text id="v3la0m"
Mamadou
↓
Session active
↓
Organisation A
↓
Gestionnaire
↓
Résidence Camayenne
↓
payment.create
↓
Appartement A04
↓
Créer paiement
```

L'accès doit être refusé si l'un des niveaux nécessaires n'est pas valide.

---

# 4. Authentification

## 4.1 Méthode

L'authentification doit utiliser une solution spécialisée et éprouvée plutôt qu'un système développé entièrement sur mesure.

Les méthodes initiales peuvent inclure :

- téléphone ;
- email lorsque disponible ;
- mot de passe.

Un système OTP pourra être ajouté lorsque les fournisseurs de messagerie et les contraintes de sécurité auront été validés.

---

## 4.2 Mot de passe

Les mots de passe doivent :

- être stockés uniquement sous forme sécurisée ;
- ne jamais apparaître dans les logs ;
- ne jamais être retournés par une API ;
- être soumis à une politique minimale de robustesse.

Le stockage doit utiliser un mécanisme de hash sécurisé fourni par le système d'authentification.

---

# 5. Activation de compte

Un gestionnaire ou un locataire ne crée pas librement son contexte.

Il reçoit une invitation.

Le parcours est :

```text id="42e6r9"
Invitation
↓
Validation
↓
Définition du mot de passe
↓
Activation
↓
Attribution des droits
↓
Connexion
```

L'activation doit être atomique lorsque plusieurs opérations sont réalisées.

---

# 6. Invitations

> **Note de consolidation** : ces règles portaient initialement les identifiants `SEC-001` à `SEC-005`, déjà utilisés par les principes fondamentaux de la section 2.
>
> Elles sont renumérotées `SEC-INV-001` à `SEC-INV-005` afin que chaque exigence reste référençable de manière unique (exigence TRACE-001).

## SEC-INV-001 : Token imprévisible

Les tokens d'invitation doivent être suffisamment aléatoires pour empêcher leur devinette.

---

## SEC-INV-002 : Stockage sécurisé du token

La base ne doit jamais conserver le token brut.

Seule une représentation hashée est stockée, et sert à la vérification.

---

## SEC-INV-003 : Expiration

Une invitation possède une date d'expiration.

Après expiration, elle ne peut plus être utilisée.

La durée par défaut est de **7 jours**, réglable par `INVITATION_TTL_DAYS` (DEC-045). L'expiration est contrôlée à chaque lecture et dans la requête même qui consomme l'invitation.

---

## SEC-INV-004 : Usage limité

Une invitation acceptée devient invalide.

Elle ne doit pas pouvoir être réutilisée.

---

## SEC-INV-005 : Révocation

Une invitation peut être révoquée avant son acceptation.

---

## SEC-INV-006 : Diffusion par lien au MVP

> **DEC-026** : au MVP, l'invitation est diffusée par **lien de partage sécurisé** copié par l'inviteur.

Ce mode de diffusion ne réduit **aucune** des propriétés ci-dessus.

Le lien reste à usage unique, expirant, révocable et lié à son contexte.

Le fait que l'inviteur transmette lui-même le lien ne l'autorise jamais à en modifier la portée.

---

# 7. Protection contre les invitations malveillantes

Une invitation doit être liée à :

- organisation ;
- rôle ;
- immeuble lorsque nécessaire ;
- appartement lorsque nécessaire ;
- utilisateur invitant ;
- destinataire prévu.

L'utilisation du lien ne doit jamais permettre de modifier ce contexte.

---

# 8. Sessions

Les sessions doivent être sécurisées.

Le système doit pouvoir :

- créer une session ;
- expirer une session ;
- révoquer une session ;
- renouveler une session de manière sécurisée.

Les cookies d'authentification, lorsqu'utilisés, doivent respecter les attributs de sécurité appropriés.

---

# 9. Gestion des sessions révoquées

Lorsqu'un propriétaire révoque un gestionnaire, les droits d'accès doivent être invalidés rapidement.

Le simple fait d'avoir une session encore ouverte ne doit pas permettre de continuer à effectuer des opérations protégées.

---

# 10. Changement de mot de passe

Le changement de mot de passe doit :

- vérifier l'utilisateur ;
- vérifier le nouveau mot de passe ;
- invalider les sessions appropriées lorsque nécessaire ;
- conserver l'historique de sécurité utile.

---

# 11. Réinitialisation de mot de passe

Le processus doit utiliser un mécanisme temporaire et sécurisé.

Le lien de récupération :

- possède une expiration ;
- est à usage limité ;
- ne révèle pas de données supplémentaires ;
- invalide les anciens mécanismes de récupération lorsque nécessaire.

---

# 12. Protection contre l'énumération des comptes

Les mécanismes de connexion et de récupération ne doivent pas révéler inutilement :

> ce numéro existe / n'existe pas.

Les messages publics doivent rester suffisamment génériques lorsque cette information pourrait être exploitée.

---

# 13. Autorisation

L'autorisation doit être centralisée.

Une fonction conceptuelle peut ressembler à :

```text id="pdv1pj"
can(
  user,
  permission,
  resource
)
```

Exemple :

```text id="bshxhj"
can(
  Mamadou,
  "payment.create",
  Apartment A04
)
```

Le résultat dépend de :

- rôle ;
- organisation ;
- périmètre ;
- statut ;
- permission.

---

# 14. RBAC + Scope

> **Modèle du MVP : DEC-025.**
>
> Les droits sont évalués sur **deux dimensions uniquement** : le **rôle** et le **périmètre**.

Le modèle combine :

### RBAC

Role Based Access Control, avec exactement trois rôles :

```text
OWNER | MANAGER | TENANT
```

Chaque rôle est associé **statiquement** à un sous-ensemble du catalogue de permissions `resource.action`, défini en code.

### Scope

Périmètre d'accès :

- `OWNER` : son organisation entière ;
- `MANAGER` : les immeubles qui lui sont attribués ;
- `TENANT` : son propre contexte locatif.

Exemple :

```text id="p86k17"
Role:
MANAGER

Scope:
Property 1 + Property 2

Permissions:
celles du rôle MANAGER, appliquées à ce périmètre
```

### Ce qui n'existe pas au MVP

Il n'existe **pas** de permissions attribuées individuellement à un gestionnaire.

Deux gestionnaires affectés au même immeuble disposent du même ensemble de permissions.

Les tables `permissions` et `access_permissions` ne sont pas créées.

La délégation fine est classée `FUT-FEAT-017`. Le service d'autorisation conserve la signature `can(user, permission, resource)` pour que son ajout futur reste additif.

---

# 15. Gestion des droits du propriétaire

Le propriétaire dispose du niveau d'autorité principal sur son organisation.

Il peut notamment :

- créer les immeubles ;
- attribuer des gestionnaires ;
- modifier leurs droits ;
- révoquer leurs accès ;
- consulter les données de son patrimoine.

Certaines actions nécessitant des protections supplémentaires doivent rester auditées.

---

# 16. Gestion des droits du gestionnaire

Le gestionnaire ne peut accéder qu'aux immeubles qui lui sont attribués.

Même s'il connaît techniquement l'identifiant d'un autre immeuble, l'API doit refuser l'accès.

---

# 17. Gestion des droits du locataire

Le locataire fonctionne selon un principe de self-access.

Il peut accéder uniquement à :

- son compte ;
- ses relations locatives ;
- ses paiements ;
- ses charges ;
- ses documents ;
- ses incidents.

---

# 18. Isolation multi-tenant

Chaque requête métier doit être évaluée dans le contexte d'une organisation.

Exemple :

```text id="w3p9bw"
Request
↓
Authenticated user
↓
Organization context
↓
Resource lookup
↓
Verify organization ownership
↓
Verify scope
↓
Allow / Deny
```

Il ne doit pas être possible de remplacer simplement :

```text id="9es2m7"
propertyId=123
```

par :

```text id="j6cy80"
propertyId=124
```

pour obtenir les données d'une autre organisation.

---

# 19. IDOR / Broken Access Control

Le produit doit explicitement se protéger contre les accès directs à des ressources non autorisées.

Exemple :

```text id="r9p6hm"
GET /api/v1/payments/payment-A
```

Le serveur doit vérifier que l'utilisateur possède le droit de voir `payment-A`.

Il ne doit jamais supposer que la connaissance de l'ID suffit.

---

# 20. Contrôle d'accès par objet

Chaque ressource doit être protégée individuellement lorsque nécessaire :

- immeuble ;
- appartement ;
- contrat ;
- locataire ;
- paiement ;
- charge ;
- incident ;
- dépense ;
- document.

---

# 21. Sécurité des données personnelles

Les informations personnelles doivent être limitées selon les rôles.

Exemple :

Le locataire A ne voit pas le numéro du locataire B.

Le gestionnaire autorisé peut voir les données nécessaires à sa mission.

Le propriétaire peut voir les données pertinentes de son patrimoine.

---

# 22. Protection des documents

Les documents privés ne doivent pas être exposés via des URLs publiques permanentes.

Une stratégie d'accès temporaire doit être utilisée.

Exemple :

```text id="g8a3hy"
Utilisateur autorisé
↓
API
↓
Permission check
↓
Signed URL
↓
Storage
```

---

# 23. Upload de fichiers

Tout fichier envoyé par un utilisateur doit être validé.

Contrôles possibles :

- taille maximale ;
- type MIME ;
- extension ;
- contenu lorsque nécessaire ;
- nom normalisé.

Les fichiers ne doivent pas être exécutables comme du code.

---

# 24. Photos d'incidents

Les photos sont des fichiers utilisateurs.

Le système doit :

- limiter leur taille ;
- générer des versions optimisées ;
- conserver l'original lorsque nécessaire ;
- empêcher leur accès public ;
- vérifier les permissions.

---

# 25. Paiements

Les paiements sont une zone critique.

Le système doit séparer :

```text id="42z9xp"
Transaction initiée
↓
Transaction fournisseur
↓
Confirmation
↓
Paiement métier
↓
Allocation
↓
Quittance
```

Le simple fait de recevoir une requête du frontend ne signifie jamais que l'argent a été reçu.

---

# 26. Webhooks de paiement

Chaque webhook doit être authentifié.

Le système doit vérifier selon le fournisseur :

- signature ;
- secret ;
- timestamp ;
- identifiant ;
- référence de transaction.

Un webhook non vérifiable doit être rejeté.

---

# 27. Idempotence des paiements

Un événement fournisseur peut être reçu plusieurs fois.

Le système doit traiter une référence fournisseur donnée au maximum selon les règles du fournisseur.

Exemple :

```text id="ksz7tj"
providerTransactionId:
OM-9847384
```

Une seconde notification pour le même identifiant ne doit pas créer un deuxième paiement.

---

# 28. Protection contre le double paiement

Le système doit éviter qu'un utilisateur lance accidentellement plusieurs paiements identiques en réponse à un état temporairement incertain.

Le frontend doit signaler :

> Paiement en vérification.

Le backend doit également détecter les duplications potentielles.

---

# 29. Secrets

Les secrets doivent être stockés uniquement dans les systèmes de gestion de secrets de l'environnement.

Ne jamais mettre dans Git :

- clés API ;
- secrets de paiement ;
- secrets WhatsApp ;
- clés de stockage ;
- secrets d'authentification.

---

# 30. Variables d'environnement

Séparer au minimum :

```text id="7k3qfz"
Development
Staging
Production
```

Chaque environnement possède ses propres secrets.

---

# 31. Protection des logs

Les logs ne doivent pas contenir :

- mots de passe ;
- tokens d'invitation ;
- tokens de session ;
- secrets API ;
- données bancaires ou de paiement sensibles inutiles.

---

# 32. Audit log

Les actions suivantes doivent être auditées :

- invitation d'utilisateur ;
- modification de permission ;
- révocation ;
- changement de loyer ;
- création de paiement manuel ;
- correction de paiement ;
- publication d'une charge ;
- création de dépense ;
- modification d'un contrat ;
- accès sensible aux documents lorsque nécessaire.

---

# 33. Audit immuable

L'audit doit être difficile à modifier par un utilisateur standard.

Un gestionnaire ne doit pas pouvoir effacer son propre historique.

---

# 34. Journal d'activité versus audit

### Activity Log

Destiné au produit et à la compréhension de l'activité.

### Audit Log

Destiné à la sécurité, au contrôle et aux opérations sensibles.

Ils peuvent avoir des niveaux de détail différents.

---

# 35. Rate Limiting

Les endpoints sensibles doivent être protégés contre les abus.

Priorités :

- connexion ;
- récupération de mot de passe ;
- invitations ;
- OTP éventuel ;
- paiements ;
- recherche lorsque nécessaire ;
- webhooks.

---

# 36. Protection contre le brute force

Après plusieurs tentatives échouées :

- ralentissement ;
- limitation ;
- challenge ;
- blocage temporaire ;

Better Auth (DEC-032) fournit la limitation de tentatives. Le blocage temporaire et le rate limiting applicatif restent de la responsabilité de l'application.

Un message d'échec ne doit jamais révéler si le compte existe.

---

# 37. Protection CSRF

Les mécanismes d'authentification et de mutation doivent être configurés pour éviter les requêtes forgées lorsque le contexte l'exige.

L'utilisation de mécanismes natifs de Next.js et de cookies sécurisés doit être privilégiée plutôt qu'une protection entièrement manuelle.

---

# 38. Protection XSS

Les contenus utilisateur :

- descriptions ;
- commentaires ;
- noms ;
- textes d'incident ;

doivent être affichés de manière sûre.

Ne jamais rendre du HTML arbitraire fourni par l'utilisateur sans sanitation explicite.

---

# 39. Validation serveur

Toutes les données entrantes doivent être validées.

Exemples :

- téléphone ;
- montant ;
- date ;
- UUID ;
- statut ;
- identifiants relationnels.

La validation frontend améliore l'UX mais n'est pas une mesure de sécurité.

---

# 40. SQL Injection

L'accès à PostgreSQL doit utiliser les requêtes paramétrées ou les mécanismes sûrs de Drizzle.

Aucune concaténation SQL utilisateur directe.

---

# 41. Upload et stockage

Les fichiers doivent être isolés du code exécutable de l'application.

Le stockage objet doit être séparé de l'application.

---

# 42. CORS

Pour le MVP web, limiter les origines autorisées.

Ne pas utiliser :

```text id="dj2jqk"
Access-Control-Allow-Origin: *
```

pour les opérations sensibles.

La politique exacte dépendra des clients et intégrations finales.

---

# 43. Headers de sécurité

Le frontend doit mettre en place les protections appropriées :

- Content Security Policy lorsque compatible ;
- X-Content-Type-Options ;
- Referrer Policy ;
- Frame protections ;
- autres headers appropriés.

Les valeurs exactes seront validées lors de l'implémentation.

---

# 44. Sécurité des API internes

Les routes internes destinées aux jobs ne doivent pas être publiquement exécutables.

Elles doivent être protégées par :

- secret interne ;
- signature ;
- mécanisme de job provider.

---

# 45. Sécurité des webhooks

Les webhooks doivent disposer d'une route dédiée.

Ils ne doivent pas utiliser le même mécanisme d'authentification que les utilisateurs.

---

# 46. Révocation d'un gestionnaire

Lorsqu'un gestionnaire est révoqué :

1. son statut passe à `REVOKED` ;
2. ses permissions deviennent invalides ;
3. ses sessions sont invalidées ou refusées lors du prochain contrôle ;
4. ses opérations historiques restent accessibles aux utilisateurs autorisés ;
5. un événement d'audit est créé.

---

# 47. Révocation d'un locataire

Deux mécanismes se ressemblent et ne doivent jamais être confondus (DEC-047). L'un retire l'accès au produit, l'autre met fin à la relation locative.

## Révocation de l'accès au produit, Lot 7

Portée par `tenant.revoke`. Elle retire à la personne la possibilité d'entrer dans l'espace locataire :

- l'accès passe à `REVOKED` ;
- ses sessions sont invalidées ou refusées au prochain contrôle ;
- l'historique reste conservé ;
- un événement d'audit est créé.

**Elle ne termine aucun bail et ne retire aucun logement.** La personne reste le locataire du logement : elle cesse seulement d'utiliser l'application. Le cas est banal, un locataire pouvant n'avoir jamais voulu de compte.

Une invitation encore en attente se révoque de la même manière, et c'est le moyen prévu pour corriger un numéro mal saisi (DEC-048) : révoquer, puis réinviter. Les sections 49 et 50 expliquent pourquoi un numéro ou un email ne se modifient pas en place.

## Fin de la relation locative, Lot 8

Portée par la fin du bail. **C'est elle, et elle seule, qui porte le retrait de l'accès au logement** :

- le bail est terminé ;
- l'accès au logement concerné est retiré ;
- l'historique reste conservé ;
- le compte utilisateur peut rester actif si la plateforme prévoit de futurs logements.

## Ce qu'il ne faut pas confondre

| Action | Met fin au bail | Fait cesser l'occupation du logement | Empêche d'entrer dans l'application |
| --- | --- | --- | --- |
| Révoquer l'accès, Lot 7 | Non | Non | Oui |
| Suspendre l'accès, Lot 7 | Non | Non | Oui, temporairement |
| Terminer le bail, Lot 8 | Oui | Oui | Non |
| Supprimer le compte utilisateur | Non | Non | Oui |

Révoquer l'accès au produit ne termine jamais le bail, et terminer un bail ne supprime jamais le compte.

---

# 48. Gestion des sessions lors des changements de permissions

Lorsqu'une permission importante est retirée, le système doit s'assurer que la session active ne contourne pas cette nouvelle restriction.

Les contrôles d'autorisation doivent être exécutés au niveau backend sur les actions protégées.

---

# 49. Sécurité du changement de numéro

Le numéro de téléphone est important pour :

- connexion ;
- récupération ;
- notifications ;
- invitations.

Tout changement doit être vérifié.

---

# 50. Sécurité du changement d'email

Même principe :

- vérification ;
- confirmation ;
- nouveau moyen validé avant remplacement définitif.

---

# 51. Sécurité des rapports

Un rapport doit être généré uniquement après vérification du droit d'accès au périmètre concerné.

Un propriétaire ne doit pouvoir demander un rapport que pour son propre patrimoine.

---

# 52. Sécurité des recherches

La recherche globale doit appliquer les permissions **avant** de retourner les résultats.

Ne jamais retourner une liste globale puis compter sur le frontend pour masquer les objets.

---

# 53. Sécurité des exports

Les exports sont particulièrement sensibles.

Avant un export :

- vérifier le rôle ;
- vérifier le périmètre ;
- vérifier le type de données ;
- limiter les informations exposées.

Les exports peuvent également être journalisés.

---

# 54. Sécurité des notifications

Une notification ne doit pas divulguer plus de données que nécessaire.

Exemple de message acceptable :

> Votre paiement de 2 500 000 GNF a été confirmé.

Le message ne doit pas exposer de données concernant d'autres utilisateurs.

---

# 55. Sécurité WhatsApp / SMS

Les messages envoyés sur des canaux externes doivent minimiser les informations sensibles.

Le détail complet doit être accessible après authentification via un lien sécurisé lorsque nécessaire.

---

# 56. Sécurité des liens profonds

Un lien comme :

```text id="u9j8ss"
/payments/123
```

ne suffit pas pour accéder au paiement.

La page doit vérifier :

- session ;
- organisation ;
- permission ;
- relation avec la ressource.

---

# 57. Session expirée

Lorsque la session expire :

- l'accès est bloqué ;
- l'utilisateur est renvoyé vers la connexion ;
- le contexte peut être restauré après reconnexion lorsque cela est sûr.

---

# 58. Accès refusé

L'interface doit distinguer :

### Non connecté

Connexion nécessaire.

### Authentifié mais non autorisé

Accès refusé.

### Ressource inexistante

Introuvable.

Éviter de révéler des informations inutiles sur les ressources protégées.

---

# 59. Sécurité mobile

Puisque le produit est mobile first :

- les sessions doivent être adaptées aux appareils mobiles ;
- les données sensibles ne doivent pas être mises en cache sans contrôle ;
- les notifications doivent rester prudentes ;
- les fichiers doivent être protégés ;
- les opérations financières doivent demander une confirmation claire.

---

# 60. Cache local

Le cache local ne doit pas contenir inutilement des données sensibles.

Pour les informations financières ou personnelles, déterminer explicitement :

- ce qui peut être mis en cache ;
- pendant combien de temps ;
- comment l'invalider.

---

# 61. PWA et sécurité

L'installation PWA ne doit pas permettre à un autre utilisateur du même appareil d'accéder automatiquement à des données sensibles.

Le verrouillage de session et la gestion du logout doivent rester fiables.

---

# 62. Monitoring de sécurité

Les événements anormaux doivent pouvoir être détectés.

Exemples :

- nombreuses tentatives de connexion ;
- invitations générées en masse ;
- multiples erreurs de permissions ;
- activité inhabituelle sur les paiements ;
- changements répétés de coordonnées.

---

# 63. Incident de sécurité

Une procédure interne doit permettre de :

1. identifier ;
2. contenir ;
3. analyser ;
4. corriger ;
5. documenter ;
6. notifier lorsque nécessaire.

Le produit doit pouvoir désactiver rapidement une intégration externe compromise.

---

# 64. Sauvegardes

Les sauvegardes PostgreSQL doivent être :

- automatiques ;
- régulières ;
- protégées ;
- séparées de l'environnement principal.

---

# 65. Test de restauration

Une sauvegarde n'est utile que si elle peut être restaurée.

Des tests de restauration doivent être réalisés périodiquement.

---

# 66. Environnements

Les environnements doivent être isolés :

```text id="fo8fc0"
Local
Development
Staging
Production
```

Une clé de production ne doit jamais être utilisée dans un environnement de développement.

---

# 67. Données de staging

Le staging doit éviter autant que possible les données personnelles réelles.

Les données peuvent être :

- synthétiques ;
- anonymisées ;
- générées artificiellement.

---

# 68. Sécurité de Claude Code

Claude Code doit travailler sans accès direct non contrôlé aux secrets de production.

Le workflow recommandé :

```text id="iedm0r"
Claude Code
↓
Code
↓
Tests
↓
Review
↓
CI
↓
Staging
↓
Validation
↓
Production
```

Claude Code ne doit pas être autorisé à déployer directement une modification critique en production sans contrôle.

---

# 69. Protection du dépôt Git

Le repository doit utiliser :

- revue de code ;
- protection de la branche principale ;
- secrets non commités ;
- scans de dépendances lorsque disponibles.

---

# 70. Dépendances

Les dépendances doivent être :

- versionnées ;
- régulièrement mises à jour ;
- surveillées pour les vulnérabilités connues.

Les dépendances inutiles doivent être évitées.

---

# 71. Sécurité des erreurs

Les messages destinés à l'utilisateur doivent rester compréhensibles.

Les détails techniques doivent être réservés aux logs.

Ne jamais afficher directement :

- stack trace ;
- SQL ;
- chemins serveur ;
- secrets ;
- variables d'environnement.

---

# 72. Sécurité des données financières

Les données financières doivent être manipulées comme des données critiques.

Le système doit notamment assurer :

- intégrité ;
- traçabilité ;
- idempotence ;
- contrôle d'accès ;
- conservation historique.

---

# 73. Politique d'accès aux données

Le produit doit suivre le principe :

> **Need to know**

Un utilisateur voit uniquement ce dont il a besoin pour exercer son rôle.

---

# 74. Tests de sécurité prioritaires

Avant mise en production, tester notamment :

### Isolation

Un utilisateur A ne peut pas accéder aux données de B.

### Permissions

Un gestionnaire ne peut pas devenir propriétaire.

### Révocation

Un gestionnaire révoqué ne peut plus agir.

### IDOR

Modifier un ID dans une URL ne donne pas accès à une autre ressource.

### Paiements

Une transaction externe répétée ne crée pas deux paiements.

### Invitations

Une invitation expirée ne fonctionne plus.

### Fichiers

Un document privé ne peut pas être téléchargé sans autorisation.

### Recherche

Les résultats respectent les permissions.

---

# 75. Matrice des risques

## Critique

- accès inter-organisation ;
- corruption financière ;
- fraude ou double paiement ;
- escalade de privilèges ;
- exposition de secrets.

## Élevé

- exposition de documents ;
- exposition de données personnelles ;
- révocation inefficace ;
- webhooks falsifiés.

## Moyen

- spam de notifications ;
- abus de recherche ;
- exposition excessive de données dans les logs.

---

# 76. Definition of Done sécurité

Une fonctionnalité critique n'est terminée que lorsque :

- authentification vérifiée ;
- autorisation vérifiée ;
- organisation vérifiée ;
- périmètre vérifié ;
- validation serveur ;
- audit prévu ;
- erreurs sécurisées ;
- tests de permissions ;
- aucun secret exposé.

---

# 77. Checklist avant production

### Auth

- sessions sécurisées ;
- récupération de compte ;
- expiration ;
- révocation.

### Autorisation

- RBAC ;
- scope ;
- isolation ;
- tests IDOR.

### Finance

- idempotence ;
- webhooks sécurisés ;
- transactions ;
- audit.

### Fichiers

- stockage privé ;
- URLs signées ;
- validation upload.

### Infrastructure

- secrets sécurisés ;
- HTTPS ;
- backups ;
- monitoring ;
- rate limiting.

### Application

- validation serveur ;
- erreurs maîtrisées ;
- dépendances à jour.

---

# 78. Principe final

La sécurité du produit ne doit pas être une couche ajoutée après le développement.

Elle doit être intégrée à la structure même du produit :

```text id="5c0t1d"
Identity
↓
Permissions
↓
Scope
↓
Business Rules
↓
Data Access
↓
Audit
```

La règle fondamentale reste :

> **Un utilisateur ne doit jamais obtenir une donnée ou effectuer une action simplement parce qu'il connaît son identifiant ou parce qu'une interface lui permet de l'appeler.**

Le backend doit toujours décider ce qui est autorisé.