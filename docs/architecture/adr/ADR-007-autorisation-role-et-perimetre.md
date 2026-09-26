# ADR-007 : Autorisation par rôle et périmètre

## Status

Accepted

## Date

2026-09-19

## Context

Le produit sert trois rôles aux besoins disjoints, dans un contexte multi-tenant. Un propriétaire supervise son patrimoine, un gestionnaire agit sur un sous-ensemble d'immeubles, un locataire ne voit que son propre logement.

Deux risques dominent :

1. **Fuite inter-organisations.** Un utilisateur d'une organisation atteignant les données d'une autre.
2. **IDOR.** Un utilisateur légitime atteignant une ressource hors de son périmètre simplement en connaissant son identifiant.

La documentation initiale prévoyait en outre des permissions granulaires attribuables gestionnaire par gestionnaire, avec des tables dédiées et un écran à cases à cocher.

Formalisation rétroactive le 2026-09-26.

## Decision

L'autorisation est évaluée **côté serveur**, sur **deux dimensions et deux seulement** :

```text
rôle       OWNER | MANAGER | TENANT
périmètre  organisation, et liste d'immeubles pour un MANAGER
```

Point de décision unique :

```text
can(user, permission, resource)
```

Évaluation :

```text
le rôle possède la permission
ET la ressource appartient à l'organisation de l'utilisateur
ET si MANAGER : la ressource est rattachée à un immeuble de son périmètre
```

Le catalogue des permissions au format `resource.action` est défini **en code** et associé **statiquement** à chaque rôle.

Les tables `permissions` et `access_permissions` **ne sont pas créées** au MVP.

Un même utilisateur peut détenir plusieurs rôles dans une organisation, ce qui permet à un propriétaire d'agir aussi comme gestionnaire sans second compte.

## Alternatives

**Permissions granulaires par gestionnaire dès le MVP.** Écartée : deux tables, un écran de délégation et un champ supplémentaire dans les invitations, pour un besoin non démontré. La différenciation réelle observée porte sur le **périmètre d'immeubles**, pas sur les capacités. Classée Future Evolution.

**Politiques RLS PostgreSQL.** Écartée : déplace la décision dans la base, la rend difficile à tester unitairement, et crée une adhérence contraire à ADR-005.

**Vérification au cas par cas dans chaque route.** Écartée : garantit l'oubli. Une seule route non protégée suffit à ouvrir le produit.

## Reasons

1. Deux dimensions suffisent à couvrir tous les parcours du périmètre MVP.
2. Un point de décision unique est testable exhaustivement, ce qu'une vérification dispersée ne permet pas.
3. Un catalogue en code est vérifié par le compilateur, contrairement à des lignes en base.
4. L'ajout futur de permissions granulaires est **additif** : deux tables et une étape d'intersection supplémentaire, sans modifier la signature de `can()`.

## Consequences

Avantages : modèle simple, testable, sans état de configuration à administrer.

Compromis : tous les gestionnaires d'une organisation disposent du même ensemble de capacités. Un propriétaire qui voudrait un gestionnaire limité à la maintenance devra attendre l'évolution.

Exigence permanente : les **tests de refus** précèdent les fonctionnalités. Organisation A vers organisation B : refus. Gestionnaire hors périmètre : refus. Locataire vers un immeuble : refus.

Une fonctionnalité non sécurisée ne fait pas partie du MVP.

## Security Impact

C'est l'objet même de l'ADR.

L'absence de RLS (ADR-005) fait de ce service la **barrière unique** d'isolation. Sa couverture de tests n'est donc pas négociable.

Connaître un UUID ne doit jamais donner accès à une ressource. Une ressource hors périmètre se comporte comme une ressource inexistante.

## Data Impact

Le rôle est un enum porté par `user_access`. Aucune table `roles`.

Le périmètre est porté par `manager_property_access`.

Les tables métier dénormalisent `organization_id` et `property_id` afin de permettre les vérifications **sans jointure**.

La révocation d'un accès renseigne `revoked_at` et ne supprime jamais l'historique.

## Operational Impact

Une révocation doit prendre effet immédiatement. Les sessions actives sont révocables individuellement (ADR-006).

## Migration

Sans objet : décision initiale.

Passage futur aux permissions granulaires : créer les deux tables, initialiser chaque gestionnaire avec l'ensemble complet de son rôle afin de ne modifier aucun comportement existant, puis ajouter l'intersection dans `can()`.

## Related Documents

- `docs/05-security/security.md`
- `docs/03-domain/roles-permissions.md`
- `docs/01-product/mvp-scope.md`
- `docs/00-decisions/decision-register.md` (DEC-025)

## Related ADRs

- ADR-005, ADR-006, ADR-008
