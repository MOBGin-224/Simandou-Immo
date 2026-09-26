# ADR-006 : Better Auth pour l'authentification

## Status

Accepted

## Date

2026-09-26

## Context

L'authentification devait satisfaire quatre contraintes simultanées, dont trois étaient déjà des décisions verrouillées du produit :

1. PostgreSQL reste la source de vérité (ADR-003).
2. Aucune adhérence aux APIs propriétaires de Supabase (ADR-005).
3. Aucun fournisseur SMS n'est intégré au MVP, ce qui exclut tout parcours reposant sur un code à usage unique.
4. L'identification doit se faire prioritairement par **numéro de téléphone**, l'adresse email étant souvent absente sur le marché visé.

Une implémentation entièrement sur mesure était exclue : le hachage des mots de passe, la gestion des sessions et la limitation des tentatives sont des sujets où une erreur est coûteuse.

## Decision

**Better Auth**, avec son adaptateur **Drizzle**.

### Modèle d'identité

Aucune seconde identité n'est introduite.

```text
users          table métier, sert également de modèle utilisateur
accounts       identifiants de connexion, dont le hash du mot de passe
sessions       sessions actives, révocables individuellement
verifications  jetons de vérification et de réinitialisation
```

1. `users.id` reste la **clé métier unique**. Aucun identifiant d'authentification parallèle.
2. Aucun secret ne figure dans `users` : les identifiants sont isolés dans `accounts`.
3. Les champs métier (`full_name`, `phone`, `status`, `archived_at`) sont des champs additionnels du modèle utilisateur.

### Identification au MVP

Téléphone et mot de passe. Email optionnel. Pas de code à usage unique.

### Encapsulation

Le code métier n'appelle **jamais** Better Auth directement :

```text
getCurrentUser()
getSession()
requireAuthenticatedUser()
signOut()
```

## Alternatives

**Supabase Auth.** Écartée : crée exactement l'adhérence propriétaire que ADR-005 interdit, et place les utilisateurs dans un store distinct des tables métier.

**Clerk.** Écartée : les utilisateurs vivraient hors de notre PostgreSQL, avec un coût récurrent et une dépendance externe sur le chemin critique de chaque requête. Son OTP SMS inclus était son principal atout, mais le produit n'en a pas besoin au MVP.

**Auth.js, anciennement NextAuth.** Écartée, sans reproche technique : l'identification par téléphone et mot de passe y demande davantage de code maison, et la révocation individuelle de session y est moins directe.

**Implémentation sur mesure.** Écartée : risque disproportionné pour un gain nul.

## Reasons

1. Better Auth est une **bibliothèque**, pas un service : elle écrit dans notre PostgreSQL via Drizzle. Il n'y a ni appel réseau sortant, ni store séparé, ni API propriétaire.
2. Les tables d'authentification sont versionnées par nos propres migrations, donc sauvegardées et restaurées avec le reste des données.
3. La révocation de session est native, ce qui sert directement l'exigence de révocation immédiate d'un accès.
4. Le téléphone comme identifiant principal est supporté sans dépendance à un fournisseur SMS.

## Consequences

Avantages : aucune identité dupliquée, aucune dépendance réseau à l'authentification, portabilité préservée.

Compromis : la disponibilité de l'authentification devient celle de la base de données. Une indisponibilité PostgreSQL empêche toute connexion. C'est accepté : la base est de toute façon indispensable à chaque opération du produit.

Compromis : la mise à jour de la bibliothèque est à notre charge, y compris ses migrations de schéma éventuelles.

## Security Impact

Hachage des mots de passe, gestion des sessions et limitation des tentatives sont délégués à une bibliothèque spécialisée plutôt que réimplémentés.

Le blocage temporaire et le rate limiting applicatif restent de notre responsabilité.

Un message d'échec de connexion ne doit jamais révéler si le compte existe.

Les tables d'authentification contiennent des secrets : elles ne doivent jamais apparaître dans un export, un journal ou un jeu de données de test.

## Data Impact

Trois tables ajoutées, `accounts`, `sessions` et `verifications`, créées après `users` dans l'ordre des migrations.

`users` porte des champs additionnels requis par la bibliothèque. Sa structure reste gouvernée par `docs/04-technical/database.md`.

## Operational Impact

Deux variables d'environnement actives : `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL`.

Une rotation de `BETTER_AUTH_SECRET` invalide les sessions en cours. C'est un levier de sécurité utile, à utiliser sciemment.

## Migration

Sans objet : décision initiale.

La compatibilité de la version installée avec Next.js 16 et React 19 doit être vérifiée au lot Authentification. Une incompatibilité bloquante constitue une nouvelle décision à porter au registre, jamais un contournement silencieux.

### Limite assumée au MVP

La récupération autonome de compte dépend d'un canal de communication, donc d'un fournisseur non intégré. Au MVP, un utilisateur autorisé régénère un lien d'activation selon le mécanisme des invitations (ADR-008).

## Related Documents

- `docs/00-decisions/decision-register.md` (DEC-032)
- `docs/04-technical/integrations.md`
- `docs/05-security/security.md`
- `docs/04-technical/database.md`

## Related ADRs

- ADR-003, ADR-005, ADR-007, ADR-008, ADR-009
