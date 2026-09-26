# ADR-001 : Architecture modular monolith

## Status

Accepted

## Date

2026-09-19

## Context

SIMANDOU IMMO couvre plusieurs domaines nettement séparés : patrimoine, contrats, finances, maintenance, documents, notifications. Cette séparation invite naturellement à découper le système en services indépendants.

Le contexte réel s'y oppose. L'équipe est réduite, le produit n'a pas encore de trafic, et la majorité des opérations critiques traversent plusieurs domaines dans une **même transaction** : confirmer un paiement met à jour des créances de loyer et de charge, génère une quittance, crée des notifications et écrit dans le journal d'audit.

Cette ADR est une formalisation rétroactive : la décision était déjà appliquée dans la documentation avant la rédaction des ADR, le 2026-09-26.

## Decision

Le produit est un **modular monolith** dans un **repository unique**.

Les domaines sont séparés par des **modules** applicatifs, pas par des frontières réseau.

Chaque module respecte la même stratification :

```text
Presentation → Application → Domain → Infrastructure
```

Un module n'importe pas l'implémentation interne d'un autre module : il passe par son interface publique.

## Alternatives

**Microservices dès le départ.** Écartée : chaque opération financière deviendrait une transaction distribuée, avec compensation à écrire à la main, pour un produit qui n'a pas encore d'utilisateur.

**Monolithe non modulaire.** Écartée : sans frontières explicites, les domaines se mélangent et l'extraction ultérieure d'un module devient impossible.

**Modules en paquets séparés dans un monorepo.** Écartée au MVP : coût d'outillage immédiat sans bénéfice à cette taille. Reste une évolution possible.

## Reasons

1. Les invariants financiers du produit exigent des transactions ACID locales. PostgreSQL les fournit gratuitement dans un monolithe.
2. Les frontières de modules donnent la discipline recherchée sans le coût opérationnel du réseau.
3. Un module correctement isolé peut être extrait plus tard. L'inverse, recoller des services, est beaucoup plus coûteux.

## Consequences

Avantages : transactions simples, déploiement unique, débogage local complet, coût d'exploitation minimal.

Compromis : la discipline de modularité n'est pas garantie par l'infrastructure, elle doit être tenue par la revue de code. Le franchissement d'une frontière de module est un défaut à signaler, pas une commodité.

Montée en charge : verticale d'abord, puis extraction ciblée du module qui le justifie réellement.

## Security Impact

Positif. L'autorisation est évaluée en un point unique, dans le processus applicatif. Il n'existe pas de trafic interservices à authentifier, donc pas de surface d'attaque entre services.

Risque à surveiller : un monolithe rend techniquement possible le contournement du service d'autorisation par un accès direct au repository. La règle d'appel obligatoire de `can()` compense ce risque.

## Data Impact

Une base PostgreSQL unique. Aucune donnée dupliquée entre domaines, aucune cohérence à terme à gérer.

Les clés étrangères entre domaines sont réelles et vérifiées par la base.

## Operational Impact

Un seul artefact à déployer, un seul jeu de logs, une seule base à sauvegarder. Une panne affecte l'ensemble du produit : la fiabilité repose donc sur la qualité du déploiement et la procédure de restauration, pas sur l'isolation des services.

## Migration

Sans objet : décision initiale.

Extraction future d'un module : exposer son interface publique, remplacer les appels directs par cette interface, puis déplacer le module derrière le réseau. L'ordre est contraignant.

## Related Documents

- `docs/01-product/master-product-specification.md`
- `docs/04-technical/engineering-standards.md`
- `docs/04-technical/architecture-governance.md` (MVP-ARCH-GOV-001)

## Related ADRs

- ADR-002, ADR-003, ADR-004
