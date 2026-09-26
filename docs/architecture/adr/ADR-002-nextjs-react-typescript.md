# ADR-002 : Next.js, React et TypeScript strict

## Status

Accepted

## Date

2026-09-19

## Context

Le produit est une application web mobile first destinée à trois rôles aux besoins très différents, avec une forte logique serveur : autorisation, calculs financiers, génération de documents.

Il faut une solution qui rende le serveur naturel plutôt qu'accessoire, et qui n'impose pas de maintenir deux bases de code et deux jeux de types.

Formalisation rétroactive le 2026-09-26.

## Decision

**Next.js avec l'App Router**, **React** et **TypeScript en mode strict**, sur un typage **de bout en bout**.

Version de travail : Next.js 16 et React 19.

Le mode strict est renforcé au-delà du défaut, avec notamment `noUncheckedIndexedAccess` et `noFallthroughCasesInSwitch`.

`any` n'est pas une solution acceptable pour contourner un typage manquant.

## Alternatives

**SPA React plus API séparée.** Écartée : deux déploiements, deux définitions de types, et une tentation permanente de déplacer de la logique d'autorisation vers le client.

**Remix, SvelteKit, Nuxt.** Écartées pour disponibilité de l'écosystème et de la documentation, non sur un défaut technique. shadcn/ui, déjà retenu, cible l'écosystème React.

**JavaScript sans typage.** Écartée sans discussion : un produit financier ne peut pas se permettre l'absence de types.

## Reasons

1. Les Server Components et les Server Actions rendent le calcul serveur le chemin par défaut, ce qui sert directement l'invariant « le backend décide ».
2. Un seul langage du schéma de base jusqu'à l'interface supprime les erreurs de traduction entre couches.
3. `noUncheckedIndexedAccess` et l'interdiction des cascades de `switch` protègent précisément les zones les plus sensibles du produit : boucles d'allocation de paiement et machines à états de statut.

## Consequences

Avantages : un dépôt, un langage, des types partagés entre la base et l'écran.

Compromis : Next.js évolue vite, et ses conventions changent entre versions majeures. La documentation embarquée dans `node_modules/next/dist/docs/` prime sur les exemples génériques, y compris sur ceux de notre propre documentation.

Le mode strict renforcé produit des erreurs de compilation là où un code plus permissif aurait laissé passer un `undefined`. C'est l'effet recherché.

## Security Impact

Positif : la frontière entre serveur et client est explicite dans le modèle de programmation, ce qui réduit le risque d'exposer accidentellement une donnée ou une décision d'autorisation.

Point de vigilance : la frontière étant fine, une donnée sensible peut être transmise au client par inadvertance. Toute réponse destinée au client doit être filtrée explicitement.

## Data Impact

Les types métier sont dérivés d'une source unique partagée avec le schéma Drizzle. Aucune redéfinition manuelle d'un type de base de données.

## Operational Impact

Déploiement natif sur Vercel. Build et vérification des types exécutés en CI avant toute fusion.

## Migration

Sans objet : décision initiale.

Les montées de version majeures de Next.js passent par les guides officiels et les codemods, et font l'objet d'une vérification complète de la CI.

## Related Documents

- `docs/04-technical/engineering-standards.md`
- `docs/01-product/master-product-specification.md`
- `AGENTS.md`

## Related ADRs

- ADR-001, ADR-004, ADR-011
