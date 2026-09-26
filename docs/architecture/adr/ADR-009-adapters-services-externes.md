# ADR-009 : Adapters pour les services externes

## Status

Accepted

## Date

2026-09-19

## Context

Le produit a besoin, à terme, de plusieurs services externes : paiement mobile, SMS, WhatsApp, email, stockage objet, supervision, analytics.

Au moment du cadrage, la plupart de ces fournisseurs ne sont pas sélectionnés. Certains le seront tard, notamment le paiement, dont le marché guinéen impose des contraintes locales.

Le risque est connu : laisser un nom de fournisseur pénétrer le code métier rend son remplacement coûteux et contamine le domaine avec un vocabulaire externe.

Formalisation rétroactive le 2026-09-26.

## Decision

Tout service externe est accédé **exclusivement** à travers une **abstraction interne**, définie par nos besoins et non par l'API du fournisseur.

```text
PaymentProvider       createPayment, getPaymentStatus, verifyWebhook
StorageProvider       upload, delete, createSignedUrl
NotificationProvider  send
```

Règles :

1. Aucun module métier n'importe un SDK tiers.
2. Aucun nom de fournisseur n'apparaît dans le domaine, ni dans un type, ni dans un message d'erreur métier.
3. L'abstraction est définie par nos besoins. Si un fournisseur expose davantage, l'excédent reste dans l'adapter.
4. Un fournisseur non sélectionné dispose malgré tout de son abstraction, avec une implémentation **inerte et journalisée**.
5. Aucun nom de fournisseur ne doit être inventé ou supposé tant que la décision correspondante est ouverte.

### Statut au MVP

| Service | Interface | Implémentation MVP |
|---|---|---|
| Paiement | Définie | Paiement manuel uniquement, fournisseur non sélectionné |
| Stockage objet | Définie | Fournisseur non sélectionné |
| SMS | Définie | Adapter inerte journalisé |
| WhatsApp | Définie | Adapter inerte journalisé |
| Email | Définie | Adapter inerte journalisé |
| Supervision | Définie | Journaux structurés et journaux de plateforme |
| Analytics | Définie | Taxonomie définie, envoi désactivé |

L'authentification ne figure pas dans cette liste : Better Auth est une bibliothèque qui écrit dans notre base, non un service externe. Elle reste néanmoins encapsulée derrière un service interne, selon la même exigence de remplaçabilité (ADR-006).

## Alternatives

**Appeler directement les SDK.** Écartée : impose de choisir tous les fournisseurs avant de commencer, et rend chaque remplacement ultérieur un chantier transverse.

**Attendre la sélection des fournisseurs avant de développer.** Écartée : bloquerait l'ensemble du MVP sur des décisions commerciales qui ne dépendent pas de la technique.

**Bibliothèque d'abstraction générique tierce.** Écartée : remplace une dépendance par une autre, plus large, et impose son vocabulaire au domaine.

## Reasons

1. Le produit peut être construit et testé intégralement avant qu'un fournisseur ne soit choisi.
2. Une abstraction définie par nos besoins reste stable même si le fournisseur change complètement de modèle.
3. Un adapter inerte permet d'écrire et de tester la logique métier de notification sans envoyer quoi que ce soit.

## Consequences

Avantages : décisions commerciales et développement découplés ; remplacement d'un fournisseur limité à un fichier.

Compromis : une couche d'indirection supplémentaire, et le risque d'une abstraction mal calibrée si elle est conçue pour un seul fournisseur imaginaire. Elle doit donc être dérivée des besoins du domaine, pas d'une documentation d'API.

Conséquence produit assumée : les invitations sont diffusées par lien copié (ADR-008) et les notifications sont uniquement internes au MVP.

## Security Impact

Point de contrôle unique par service : validation des fichiers dans l'adapter de stockage, vérification de signature dans l'adapter de paiement.

Les secrets de fournisseur restent confinés à leur adapter et ne circulent jamais dans le domaine.

Un webhook de paiement doit être vérifié dans son adapter avant toute écriture métier, et son traitement doit être idempotent.

## Data Impact

Le domaine stocke `provider` et `provider_transaction_id` comme **références opaques**. Aucune structure propre à un fournisseur n'est persistée.

La table des clés d'idempotence protège contre le rejeu, indépendamment du fournisseur.

## Operational Impact

Les variables d'environnement d'un fournisseur non activé sont déclarées mais non requises au démarrage. Elles ne deviennent obligatoires qu'avec l'activation de l'intégration.

Une panne de fournisseur doit être distinguée d'une faute utilisateur dans les journaux comme dans l'interface.

## Migration

Activation d'un fournisseur : implémenter son adapter, renseigner ses variables, activer l'intégration. Aucun module métier n'est touché.

## Related Documents

- `docs/04-technical/integrations.md`
- `docs/01-product/mvp-scope.md`
- `docs/00-decisions/decision-register.md` (DEC-008)

## Related ADRs

- ADR-006, ADR-008, ADR-012
