# ADR-008 : Onboarding par invitation

## Status

Accepted

## Date

2026-09-19

## Context

Le produit ne s'adresse pas à un public qui s'inscrit spontanément. Un locataire n'a aucune raison de créer un compte de son propre chef : c'est le gestionnaire ou le propriétaire qui l'intègre, parce qu'un bail existe.

Une inscription libre créerait par ailleurs un problème d'autorisation immédiat : à quelle organisation rattacher un compte auto-créé, et avec quel périmètre.

Formalisation rétroactive le 2026-09-26.

## Decision

**Aucune inscription libre.** L'accès au produit se fait exclusivement **sur invitation**.

Une invitation est émise par un utilisateur autorisé, et porte son contexte complet : organisation, rôle, périmètre pour un gestionnaire, logement et bail pour un locataire.

Propriétés de sécurité obligatoires :

```text
token imprévisible
stocké sous forme hachée
expirant
à usage unique
révocable
lié à son contexte
```

### Diffusion au MVP

Le système génère l'invitation et son lien. L'inviteur **copie le lien** depuis l'interface et le transmet par son propre moyen, WhatsApp, SMS ou en personne.

Aucun envoi automatique n'a lieu au MVP, faute de fournisseur de messagerie intégré (ADR-009).

L'invité active son accès en définissant son mot de passe. Les informations déjà connues du système sont préremplies.

## Alternatives

**Inscription libre avec rattachement ultérieur.** Écartée : crée des comptes orphelins sans organisation ni périmètre, et une surface d'abus évidente.

**Envoi automatique par SMS ou WhatsApp dès le MVP.** Écartée pour le MVP seulement : suppose un fournisseur sélectionné, donc une décision non prise et un coût non engagé. Le modèle d'invitation est conçu pour que cet envoi devienne un simple ajout derrière l'abstraction de notification, sans rien changer au reste.

**Envoi par email.** Écartée comme canal principal : sur le marché visé, l'adresse email est souvent absente. Elle reste un identifiant secondaire optionnel.

## Reasons

1. Le rattachement à une organisation et à un périmètre est connu au moment de l'invitation, pas après.
2. La diffusion par lien copié ne réduit en rien la sécurité du jeton : c'est le canal de transport qui change, pas le mécanisme.
3. Le gestionnaire connaît déjà ses locataires et dispose déjà d'un canal pour les joindre. Le produit n'a pas besoin de le remplacer pour être utile.

## Consequences

Avantages : chaque compte a une origine identifiable, une organisation, un rôle et un périmètre depuis sa création.

Compromis : la diffusion manuelle du lien est une friction réelle pour un gestionnaire qui intègre plusieurs locataires. Elle est assumée au MVP et disparaîtra avec l'activation d'un canal automatique.

Le départ d'un locataire met fin à son accès opérationnel sans supprimer l'historique du bail, des paiements, des incidents et des documents.

## Security Impact

Le lien d'invitation est un **secret de fait** : il permet la création d'un accès. D'où l'expiration, l'usage unique et la révocabilité.

Le jeton est stocké haché : une fuite de la base ne permet pas de rejouer une invitation en attente.

Une invitation consommée ou révoquée ne doit pas révéler laquelle des deux situations s'applique.

Le contexte d'une invitation ne doit jamais être modifiable par l'invité, notamment ni le rôle ni le périmètre.

## Data Impact

Table `invitations`, avec les statuts `PENDING`, `SENT`, `ACCEPTED`, `EXPIRED` et `REVOKED`.

L'invitation conserve sa trace après acceptation : elle documente l'origine de l'accès.

Au MVP, l'invitation d'un gestionnaire ne porte **pas** de champ de permissions (ADR-007).

## Operational Impact

Un utilisateur autorisé doit pouvoir régénérer une invitation expirée ou perdue.

C'est aussi, au MVP, le mécanisme de récupération de compte, faute de canal automatisé (ADR-006).

## Migration

Sans objet : décision initiale.

Activation future de l'envoi automatique : implémenter l'adapter de notification correspondant. Aucune modification du modèle d'invitation n'est nécessaire.

## Related Documents

- `docs/02-ux/user-flows.md`
- `docs/05-security/security.md`
- `docs/01-product/mvp-scope.md`
- `docs/00-decisions/decision-register.md` (DEC-026)

## Related ADRs

- ADR-006, ADR-007, ADR-009
