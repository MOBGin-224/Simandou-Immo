# External Integrations & Third-Party Services Specification

## 1. Objet du document

Ce document définit la manière dont le SaaS de gestion d'immeubles doit intégrer les services externes nécessaires à son fonctionnement.

Les intégrations concernées sont notamment :

- authentification ;
- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage de fichiers ;
- monitoring ;
- analytics ;
- éventuels services de jobs ;
- autres fournisseurs nécessaires au produit.

L'objectif est d'éviter que la logique métier de l'application soit directement dépendante d'un fournisseur particulier.

Le principe est :

```text
Produit
↓
Interface interne
↓
Adapter
↓
Fournisseur externe
```

---

# 2. Principes fondamentaux

## EXT-001 : Les fournisseurs externes sont des dépendances

Un fournisseur externe peut :

- tomber en panne ;
- modifier son API ;
- changer ses tarifs ;
- modifier ses limites ;
- changer ses conditions ;
- devenir indisponible ;
- être remplacé.

L'architecture doit donc limiter le couplage.

---

## EXT-002 : Le domaine métier ne connaît pas les détails fournisseurs

Le module `payments` ne doit pas dépendre directement d'une API spécifique de fournisseur.

Exemple incorrect :

```text id="e6p7bv"
Payment Domain
↓
OrangeMoneyAPI
```

Préférer :

```text id="ce0r75"
Payment Domain
↓
Payment Service
↓
Provider Adapter
↓
Orange / MTN / Autre
```

---

## EXT-003 : Les fournisseurs ne sont pas la source de vérité métier

Le fournisseur externe confirme une opération externe.

Le système interne décide ensuite comment cette opération devient une donnée métier.

---

## EXT-004 : Toute intégration doit gérer les échecs

Une intégration doit prévoir :

- timeout ;
- erreur réseau ;
- réponse invalide ;
- fournisseur indisponible ;
- retry ;
- doublon ;
- état inconnu.

---

## EXT-005 : Les intégrations critiques doivent être idempotentes

Particulièrement :

- paiements ;
- webhooks ;
- notifications ;
- jobs ;
- synchronisations.

---

# 3. Classification des intégrations

Les intégrations sont divisées en :

### Critiques

Une panne impacte directement une fonction métier importante.

Exemples :

- authentification ;
- paiement ;
- base de données ;
- stockage.

### Importantes

Une panne dégrade l'expérience mais n'empêche pas nécessairement le fonctionnement du cœur métier.

Exemples :

- SMS ;
- WhatsApp ;
- email.

### Support

Une panne n'empêche pas directement les opérations métier.

Exemples :

- analytics ;
- monitoring ;
- outils de développement.

---

# 4. MVP

# 4.0 Statut des fournisseurs au MVP

> **DEC-008, DEC-026, DEC-027, DEC-028, DEC-032, DEC-033, DEC-034.**

| Service | Interface définie | Implémentation MVP | Décision |
|---|---|---|---|
| Base de données | aucun | PostgreSQL : Docker local, Supabase ailleurs | **VERROUILLÉE** (DEC-007) |
| Hébergement | aucun | Vercel | **VERROUILLÉE** (DEC-007) |
| Jobs / scheduler | Oui | Cron plateforme + routes internes | **DÉDUITE** (DEC-028) |
| Authentification | Oui | Better Auth, tables dans notre PostgreSQL | **VERROUILLÉE** (DEC-032) |
| Stockage objet | Oui | aucune | **OUVERTE** (DEC-033) |
| Paiement | Oui | Paiement manuel uniquement | **OUVERTE** (DEC-034) |
| SMS | Oui | Adapter inerte journalisé | Reporté (DEC-008) |
| WhatsApp | Oui | Adapter inerte journalisé | Reporté (DEC-008) |
| Email | Oui | Adapter inerte journalisé | Reporté (DEC-008) |
| Monitoring | Oui | Logs structurés + logs plateforme | Reporté (DEC-008) |
| Analytics | Oui | Adapter inerte, taxonomie définie | Reporté (DEC-008) |

## Règle absolue

**Aucun nom de fournisseur ne doit être inventé, supposé ou codé en dur** tant que la décision correspondante est OUVERTE.

## Conséquences fonctionnelles du report

Ces reports ont deux conséquences visibles sur le produit, déjà intégrées au périmètre :

| Conséquence | Décision |
|---|---|
| Les invitations sont diffusées par **lien de partage copié** par l'inviteur | DEC-026 |
| Les notifications et relances sont **in-app uniquement** | DEC-027 |

Ce ne sont pas des limitations temporaires masquées : ce sont les comportements spécifiés du MVP.

## Adapter inerte

Un adapter inerte respecte l'interface, journalise l'appel avec son contexte, et retourne un résultat d'échec explicite.

Il ne doit **jamais** simuler un succès : un appel inerte ne doit pas faire croire qu'un message a été envoyé.

---

# 4.1 Registre des fournisseurs

## MVP-EXT-001

Avant production, maintenir un registre interne contenant :

```text
Service
Fournisseur
Environnement
Credentials
Criticité
Fallback
Monitoring
Owner interne
Documentation
```

Le registre ne doit jamais contenir les secrets eux-mêmes.

---

# 5. Authentification

## MVP-EXT-002 : Auth Provider

L'authentification est assurée par **Better Auth** avec son adaptateur Drizzle (DEC-032).

Particularité de ce choix : il ne s'agit pas d'un service externe mais d'une bibliothèque qui écrit dans **notre** PostgreSQL. Il n'y a donc ni appel réseau sortant, ni store utilisateur séparé, ni adhérence à une API propriétaire.

Better Auth est responsable de :

- les identifiants de connexion et le hachage des mots de passe ;
- les sessions, leur durée de vie et leur révocation ;
- les jetons de vérification et de réinitialisation.

L'application reste responsable de :

- les rôles ;
- les permissions ;
- l'organisation ;
- les périmètres ;
- les relations métier.

Identification au MVP : **téléphone et mot de passe**. L'OTP est reporté avec DEC-008, faute de fournisseur SMS.

---

# 6. Abstraction Auth

## MVP-EXT-003

Le code métier ne doit pas appeler directement les primitives spécifiques du fournisseur.

Créer un service interne permettant au reste de l'application de travailler avec un modèle stable :

```text
getCurrentUser()
getSession()
requireAuthenticatedUser()
signOut()
```

Aucun appel direct à Better Auth depuis un module métier n'est admis. Cette règle protège deux choses : la capacité à changer de solution, et l'unicité du point où l'identité est résolue.

---

# 7. Paiements

Les paiements constituent l'intégration externe la plus critique.

Le système doit pouvoir intégrer ultérieurement différents moyens de paiement sans modifier profondément le domaine.

---

# 8. Payment Provider Interface

## MVP-EXT-004

Définir une interface conceptuelle :

```ts
interface PaymentProvider {
  createPayment(...): Promise<...>;
  getPaymentStatus(...): Promise<...>;
  verifyWebhook(...): Promise<...>;
}
```

Les noms exacts seront adaptés au codebase final.

---

# 9. Payment Adapter

Chaque fournisseur doit avoir un adaptateur distinct.

Exemple :

```text
PaymentService
├── ProviderAAdapter
├── ProviderBAdapter
└── ProviderCAdapter
```

---

# 10. Paiement métier versus transaction fournisseur

Ces deux concepts doivent rester séparés.

```text
Payment
=
Objet métier interne

Provider Transaction
=
Opération chez le fournisseur
```

---

# 11. Création d'un paiement

Flux recommandé :

```text id="r00yv5"
Utilisateur
↓
Application
↓
Validation
↓
Payment Service
↓
Provider Adapter
↓
Provider
↓
Référence fournisseur
↓
Payment = PENDING
```

---

# 12. Confirmation d'un paiement

Le paiement ne doit passer à `CONFIRMED` qu'après un signal valide :

```text id="j0e14c"
Webhook authentifié
ou
Vérification explicite du statut
```

Le frontend seul ne doit jamais confirmer la réception de l'argent.

---

# 13. Webhooks de paiement

## MVP-EXT-005

Chaque fournisseur doit disposer d'un traitement de webhook séparé.

Le système doit :

1. recevoir ;
2. authentifier ;
3. parser ;
4. identifier ;
5. vérifier l'idempotence ;
6. appliquer la transition métier ;
7. journaliser ;
8. répondre correctement au fournisseur.

---

# 14. Signature webhook

Selon le fournisseur, vérifier :

- signature ;
- secret ;
- timestamp ;
- référence ;
- autre mécanisme d'authentification.

Une requête non vérifiable est rejetée.

---

# 15. Idempotence paiement

Le système doit conserver une clé ou référence permettant d'éviter le traitement multiple d'une même transaction.

Exemple :

```text
provider = X
provider_transaction_id = ABC123
```

Cette combinaison doit pouvoir être reconnue comme déjà traitée.

---

# 16. Paiement en attente

Les intégrations doivent supporter un état intermédiaire.

Exemple :

```text
PENDING
```

Le système ne doit pas considérer une réponse technique ambiguë comme un succès financier.

---

# 17. Échec fournisseur

Lorsqu'un fournisseur refuse ou ne traite pas un paiement :

```text
Provider Error
↓
Payment = FAILED
ou
Payment = PENDING
```

selon la nature réelle de l'état.

Il ne faut pas convertir automatiquement toute erreur technique en paiement échoué sans analyser le contexte.

---

# 18. Timeout paiement

Une requête qui dépasse un délai raisonnable doit être considérée comme incertaine lorsque l'état financier réel n'est pas connu.

Dans ce cas :

```text
PENDING
+
Verification / Retry contrôlé
```

peut être préférable à une confirmation ou un échec arbitraire.

---

# 19. Retry paiement

Un retry n'est autorisé que si l'opération peut être rendue idempotente.

Un retry aveugle sur une opération financière est interdit.

---

# 20. Fournisseur de paiement principal

> **DEC-034 OUVERTE.** Aucun fournisseur n'est sélectionné.
>
> Tant que cette décision est ouverte, le MVP fonctionne avec le **paiement manuel** comme unique moyen opérationnel.
>
> Cela ne bloque ni les créances, ni les allocations, ni les quittances, ni les tableaux de bord.

Le premier fournisseur réel devra être choisi après validation de :

- disponibilité en Guinée ;
- API ;
- stabilité ;
- méthodes de paiement ;
- qualité des webhooks ;
- environnement de test ;
- documentation ;
- support ;
- coûts ;
- capacité de règlement ;
- contraintes contractuelles.

Le fournisseur final ne doit pas être considéré comme fixé par ce document.

---

# 21. Fallback paiement

## MVP-EXT-006

Le MVP peut prévoir un mécanisme fonctionnel de paiement manuel lorsque le paiement digital n'est pas disponible.

Exemple :

```text
Cash
Mobile Money enregistré manuellement
Autre méthode autorisée
```

L'enregistrement manuel doit rester clairement identifiable.

---

# 22. SMS

## MVP-EXT-007

Le SMS doit être traité comme un provider interchangeable.

Fonctions possibles :

- invitation ;
- récupération ;
- rappel ;
- notification de paiement.

---

# 23. SMS Adapter

Interface conceptuelle :

```ts
interface SmsProvider {
  sendMessage(...): Promise<...>;
}
```

---

# 24. Échec SMS

Si le SMS échoue :

- l'opération métier principale ne doit pas nécessairement échouer ;
- le système doit journaliser l'échec ;
- un retry peut être programmé lorsque pertinent.

Exemple :

```text
Tenant Created
↓
SMS Failed
↓
Tenant remains created
↓
Notification retry
```

---

# 25. WhatsApp

## MVP-EXT-008

WhatsApp est un canal de communication, pas une dépendance au modèle métier.

Le produit doit pouvoir fonctionner même si WhatsApp devient temporairement indisponible.

---

# 26. WhatsApp Adapter

Créer une interface de type :

```ts
interface WhatsappProvider {
  sendTemplate(...): Promise<...>;
}
```

---

# 27. Templates WhatsApp

Les messages WhatsApp destinés aux notifications opérationnelles doivent utiliser des templates conformes aux contraintes du fournisseur.

Les contenus doivent être centralisés lorsque possible.

---

# 28. WhatsApp et confidentialité

Les messages externes doivent minimiser les données sensibles.

Préférer :

```text
Votre paiement a été confirmé.
```

à :

```text
Votre paiement de 2 500 000 GNF pour l'appartement A04 de la Résidence X...
```

lorsque le détail n'est pas nécessaire dans le canal externe.

---

# 29. Email

## MVP-EXT-009

L'email doit être encapsulé dans une abstraction :

```ts
interface EmailProvider {
  send(...): Promise<...>;
}
```

---

# 30. Email Use Cases

Les cas d'usage peuvent inclure :

- invitation ;
- récupération de compte ;
- notifications ;
- alertes importantes ;
- messages système.

Le MVP peut limiter fortement l'utilisation de l'email si le contexte utilisateur privilégie le téléphone.

---

# 31. Stockage objet

## MVP-EXT-010

Le système de stockage doit être abstrait.

Exemple :

```ts
interface StorageProvider {
  upload(...): Promise<...>;
  delete(...): Promise<...>;
  createSignedUrl(...): Promise<...>;
}
```

---

# 32. Stockage privé

Les buckets de fichiers utilisateur doivent être privés.

---

# 33. URLs signées

Les fichiers privés doivent être servis via :

- contrôle d'accès ;
- URL temporaire ;
- ou mécanisme équivalent.

---

# 34. Erreurs de stockage

Un échec d'upload doit être différent de l'échec de la création de l'objet métier lorsque celui-ci peut être créé indépendamment.

Le workflow doit définir précisément les cas où l'opération doit être atomique.

---

# 35. Images

Pour les photos d'incident :

```text
Upload
↓
Validation
↓
Storage
↓
Metadata
↓
Association métier
```

Lorsque possible, les transformations d'image doivent être asynchrones.

---

# 36. Email, SMS et WhatsApp : abstraction commune

Le système peut utiliser une couche :

```text
NotificationService
├── EmailProvider
├── SmsProvider
└── WhatsappProvider
```

Le domaine métier déclenche :

```text
NotificationService.send(...)
```

et ne connaît pas le fournisseur concret.

---

# 37. Notification Delivery

Le système doit distinguer :

```text
Notification Created
↓
Delivery Attempted
↓
Delivered
ou
Failed
```

Cela permet de distinguer une création métier réussie d'un échec de communication.

---

# 38. Retry Notifications

Les notifications non critiques peuvent être retentées.

Une stratégie de retry doit prévoir :

- nombre maximal ;
- délai ;
- backoff ;
- état final ;
- logs.

---

# 39. Éviter les doubles notifications

Un même événement métier ne doit pas envoyer plusieurs notifications identiques à cause d'un retry technique.

Utiliser une clé d'idempotence lorsque nécessaire.

---

# 40. Jobs Provider

## MVP-EXT-011

La plateforme de jobs doit permettre :

- exécution différée ;
- retries ;
- planification ;
- observation.

L'intégration doit rester indépendante du domaine métier.

---

# 41. Analytics Provider

## MVP-EXT-012

Le fournisseur analytics doit être optionnel pour le fonctionnement métier.

Si l'analytics tombe :

```text
Produit = continue
Analytics = dégradé
```

et non :

```text
Analytics = down
→
Produit = down
```

---

# 42. Analytics abstraction

Lorsque cela est utile :

```ts
interface AnalyticsProvider {
  track(...): Promise<void>;
  identify(...): Promise<void>;
}
```

Les détails du fournisseur ne doivent pas apparaître dans les modules métier.

---

# 43. Monitoring Provider

## MVP-EXT-013

L'outil de monitoring doit recevoir :

- exceptions ;
- erreurs ;
- traces lorsque configurées ;
- contexte technique.

Il ne doit pas recevoir les données personnelles inutiles.

---

# 44. Monitoring Failure

Un échec d'envoi à l'outil de monitoring ne doit jamais bloquer l'application.

---

# 45. Environnements

Chaque intégration doit distinguer au minimum :

```text
Development
Staging
Production
```

---

# 46. Credentials par environnement

Les credentials de :

```text
Development
```

ne doivent jamais être ceux de :

```text
Production
```

---

# 47. Sandbox

Lorsqu'un fournisseur dispose d'un environnement sandbox :

```text
Local / Development
→
Sandbox

Staging
→
Sandbox ou environnement de test dédié

Production
→
Live
```

selon les capacités du fournisseur.

---

# 48. Test doubles

Les tests automatisés ne doivent pas appeler les fournisseurs réels par défaut.

Utiliser :

- mocks ;
- fakes ;
- stubs ;
- sandbox lorsque nécessaire.

---

# 49. Contract Tests

Pour les intégrations importantes, vérifier que l'application respecte le contrat attendu du fournisseur.

Exemples :

- format ;
- champs obligatoires ;
- codes de retour ;
- signatures ;
- webhooks.

---

# 50. Tests d'intégration externes

Un nombre limité de tests réels peut être exécuté dans un environnement de test fournisseur pour :

- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage.

Ils ne doivent pas dépendre d'un environnement instable pour chaque test CI.

---

# 51. Monitoring des intégrations

Chaque intégration critique doit avoir des indicateurs :

```text
Requests
Success
Failures
Timeouts
Retries
Latency
```

---

# 52. Health status des fournisseurs

Lorsque possible, maintenir un état :

```text
HEALTHY
DEGRADED
DOWN
UNKNOWN
```

Cette information est interne.

---

# 53. Circuit Breaker

## MVP-EXT-014

Un mécanisme de circuit breaker n'est pas obligatoire partout.

Il peut être utilisé lorsque :

- un fournisseur présente des erreurs répétées ;
- les retries créent une charge inutile ;
- le service peut raisonnablement continuer sans l'intégration.

---

# 54. Rate Limiting fournisseur

Respecter les limites imposées par chaque fournisseur.

La configuration doit prévoir :

- limites ;
- backoff ;
- quotas ;
- erreurs 429 ;
- reprise.

---

# 55. Provider Errors

Chaque provider adapter doit transformer les erreurs externes en erreurs internes compréhensibles.

Exemple :

```text
Provider:
4012
"Insufficient balance"

Application:
ProviderInsufficientBalance
```

Le domaine ne doit pas dépendre des codes internes d'un seul fournisseur.

---

# 56. Timeouts

Chaque appel externe doit avoir un timeout approprié.

Une intégration qui ne répond jamais ne doit pas bloquer une requête utilisateur indéfiniment.

---

# 57. Retry Policy

Chaque intégration doit définir :

```text
Retryable?
Max attempts?
Backoff?
Idempotent?
Fallback?
```

---

# 58. Fallback

Le fallback doit être défini uniquement lorsque cela apporte une vraie valeur.

Exemple :

```text
SMS indisponible
↓
Email disponible
```

La stratégie ne doit pas devenir une cascade incontrôlée de notifications.

---

# 59. Échec d'authentification

Le système doit distinguer trois situations et ne jamais les confondre dans le message rendu :

```text
Identifiants invalides        faute utilisateur
Compte suspendu ou révoqué    décision de l'organisation
Base de données indisponible  panne technique
```

Better Auth s'appuyant sur notre PostgreSQL (DEC-032), une indisponibilité d'authentification est une indisponibilité de base de données, pas une panne de fournisseur externe.

Une panne technique ne doit jamais être présentée comme une faute utilisateur, et un identifiant invalide ne doit jamais révéler si le compte existe.

---

# 60. Payment Provider Failure

Une panne du fournisseur de paiement ne doit jamais conduire à :

- créer artificiellement une confirmation ;
- perdre la trace d'une transaction ;
- créer un doublon.

---

# 61. Notification Provider Failure

Une panne d'un canal ne doit normalement pas empêcher la création de l'événement métier.

---

# 62. Storage Provider Failure

Le produit doit gérer clairement :

```text
Upload Failed
```

sans créer un document qui semble disponible alors que le fichier n'existe pas réellement.

---

# 63. Provider Change

## MVP-EXT-015

Le code doit limiter le nombre de fichiers métier dépendants du provider.

Un changement de fournisseur doit idéalement concerner principalement :

```text
Adapter
Configuration
Tests d'intégration
```

et non :

```text
Tout le domaine métier
```

---

# 64. Provider de secours

## FUT-EXT-001

Un fournisseur secondaire peut être ajouté ultérieurement pour :

- paiement ;
- SMS ;
- email ;
- stockage.

---

# 65. Multi-provider Payment

## FUT-EXT-002

À terme, le système pourra gérer :

```text
PaymentMethod
↓
Provider Selection
↓
Provider Adapter
```

avec plusieurs fournisseurs.

Cette capacité n'est pas obligatoirement nécessaire dans la première version.

---

# 66. Routage intelligent

## FUT-EXT-003

Le système pourra choisir un fournisseur selon :

- disponibilité ;
- coût ;
- méthode ;
- pays ;
- devise ;
- taux de succès.

---

# 67. Architecture Constraints Related to Future Evolutions

## ARCH-EXT-001 : Interfaces stables

Les modules métier doivent communiquer avec les intégrations via des interfaces internes stables.

---

## ARCH-EXT-002 : Adapter Pattern

Les providers doivent utiliser des adapters afin d'isoler les APIs externes.

---

## ARCH-EXT-003 : Provider-neutral domain

Le domaine métier ne doit pas connaître :

- endpoint fournisseur ;
- headers spécifiques ;
- format propriétaire ;
- codes internes.

---

## ARCH-EXT-004 : Event-driven compatibility

Les intégrations doivent pouvoir évoluer progressivement vers des événements asynchrones lorsque la volumétrie le justifiera.

---

## ARCH-EXT-005 : External reference mapping

Les identifiants fournisseurs doivent être stockés comme références externes et non comme identifiants primaires du système.

Exemple :

```text
internal_payment_id
external_provider
external_transaction_id
```

---

## ARCH-EXT-006 : Secret isolation

Les credentials externes doivent rester dans la configuration d'infrastructure et ne jamais être transportés dans les modèles métier.

---

## ARCH-EXT-007 : Provider capability model

Lorsque plusieurs fournisseurs futurs existent, leurs capacités pourront être décrites explicitement.

Exemple :

```text
supports_mobile_money
supports_cards
supports_webhooks
supports_refunds
supports_international
```

---

# 68. Future Evolutions

## FUT-EXT-004 : Service de paiement multi-provider

Ajouter plusieurs providers simultanément.

---

## FUT-EXT-005 : Fallback automatisé

Basculer vers un fournisseur secondaire selon des règles déterminées.

---

## FUT-EXT-006 : Unified Messaging

Créer une couche permettant de choisir dynamiquement :

```text
WhatsApp
SMS
Email
Push
```

---

## FUT-EXT-007 : Push Notifications

Ajouter les notifications push natives lorsque des applications mobiles dédiées seront disponibles.

---

## FUT-EXT-008 : Open Banking

Une intégration bancaire pourra être étudiée ultérieurement si le contexte et les partenaires le justifient.

---

## FUT-EXT-009 : ERP / Accounting Integrations

Ajouter des intégrations avec des outils comptables ou financiers.

---

# 69. Out of Scope

## OUT-EXT-001

Intégrer plusieurs fournisseurs de paiement dès le MVP sans besoin réel.

---

## OUT-EXT-002

Construire une plateforme interne de messagerie complète.

---

## OUT-EXT-003

Construire une passerelle de paiement propriétaire.

---

## OUT-EXT-004

Créer des intégrations spécifiques sans utilisateur ou besoin métier identifié.

---

## OUT-EXT-005

Rendre les fournisseurs externes obligatoires au fonctionnement des modules qui peuvent fonctionner indépendamment.

---

# 70. Definition of Done d'une intégration

Une intégration MVP est terminée lorsque :

```text
[ ] Provider choisi et documenté
[ ] Adapter créé
[ ] Configuration séparée par environnement
[ ] Secrets protégés
[ ] Timeout défini
[ ] Error mapping défini
[ ] Retry policy définie
[ ] Idempotence vérifiée lorsque nécessaire
[ ] Monitoring configuré
[ ] Tests automatisés
[ ] Tests sandbox si pertinents
[ ] Documentation du runbook
[ ] Fallback ou comportement de panne défini
```

---

# 71. Checklist de revue d'une intégration

Avant mise en production :

```text
## Architecture
[ ] Provider isolé
[ ] Domaine indépendant

## Security
[ ] Secrets protégés
[ ] Webhook sécurisé
[ ] Données minimisées

## Reliability
[ ] Timeout
[ ] Retry
[ ] Idempotence
[ ] Failure state

## Operations
[ ] Logs
[ ] Monitoring
[ ] Alertes

## Testing
[ ] Unit
[ ] Integration
[ ] Sandbox
[ ] Failure scenarios
```

---

# 72. Principe final

Une intégration externe doit être considérée comme une frontière du système.

De ce côté :

```text
SIMANDOU IMMO / Produit
```

la logique métier doit rester stable.

De l'autre côté :

```text
Provider externe
```

les changements sont contrôlés par l'adapter.

La règle directrice est :

> **Le produit doit dépendre des capacités dont il a besoin, pas de l'implémentation particulière du fournisseur qui les fournit.**