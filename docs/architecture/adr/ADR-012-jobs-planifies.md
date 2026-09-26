# ADR-012 : Jobs planifiés via Cron de plateforme

## Status

Accepted

## Date

2026-09-19

## Context

Plusieurs traitements du produit doivent s'exécuter sans intervention humaine :

```text
génération des échéances de loyer de la période
passage des créances échues au statut OVERDUE
rappels avant échéance
relances de retard
```

Ces traitements ont trois caractéristiques communes : ils sont périodiques, peu fréquents, et doivent être **idempotents**, puisqu'une double exécution ne doit jamais produire deux échéances ni deux relances.

Formalisation rétroactive le 2026-09-26.

## Decision

Les traitements planifiés sont déclenchés par le **Cron de la plateforme d'hébergement**, qui appelle des **routes internes protégées**.

```text
Cron de plateforme
    ↓
/internal/<traitement>    protégée par INTERNAL_JOB_SECRET
    ↓
service applicatif
```

Règles :

1. Toute route interne exige un secret partagé et refuse tout appel non authentifié.
2. Tout traitement planifié est **idempotent**. Le rejouer ne produit aucun effet supplémentaire.
3. L'idempotence est garantie par une **contrainte de base**, pas par une vérification applicative. Une créance de loyer est unique par contrat et par période ; une créance de charge est unique par charge et par appartement.
4. Une relance dispose d'une protection anti-répétition : une même créance ne déclenche pas plusieurs relances identiques rapprochées.
5. Un traitement planifié ne contient aucune logique métier propre : il appelle un service qui doit aussi pouvoir être déclenché manuellement.

Aucun système de files externe n'est introduit au MVP.

## Alternatives

**Système de files ou d'orchestration externe.** Écartée pour le MVP : apporte relances, observabilité et durabilité, mais ajoute une dépendance et un coût pour une charge qui se compte en dizaines d'exécutions par mois. Reste l'évolution naturelle si le volume ou la complexité l'exigent.

**Processus de travail permanent.** Écartée : impose un hébergement à processus durable, contraire au modèle de déploiement retenu, pour un besoin purement périodique.

**Calcul paresseux à la lecture.** Écartée explicitement pour le passage en retard. Calculer le statut au moment de l'affichage rendrait l'état dépendant de l'observateur, empêcherait de notifier sans consultation, et fausserait les tableaux de bord. Le passage en retard est un **écrit**, pas une lecture.

## Reasons

1. Le volume réel ne justifie aucune infrastructure dédiée.
2. Une route interne est du code applicatif ordinaire : testable, déployé et versionné avec le reste.
3. L'idempotence garantie par contrainte de base rend le mécanisme de déclenchement peu critique. Un rejeu est sans conséquence, ce qui est précisément ce qui permet de se passer d'un système de files.

## Consequences

Avantages : aucune dépendance supplémentaire, aucun coût additionnel, traitements testables comme des fonctions ordinaires.

Compromis : pas de file d'attente, donc pas de relance automatique en cas d'échec. Un échec est rattrapé par l'exécution suivante ou par un déclenchement manuel, ce qui est acceptable pour des traitements quotidiens.

Compromis : pas d'observabilité dédiée. Le suivi repose sur les journaux structurés et les journaux de plateforme.

Une route interne mal protégée exposerait la génération d'échéances. La protection par secret n'est donc pas optionnelle.

## Security Impact

Les routes internes constituent une surface d'attaque réelle : elles écrivent des données financières.

Elles doivent être refusées sans secret valide, ne jamais accepter de paramètre définissant un montant, et ne jamais figurer dans une documentation publique.

Le secret est une variable d'environnement, jamais versionnée, et rotative.

## Data Impact

Contraintes d'unicité rendant les traitements rejouables sans risque :

```text
UNIQUE (lease_id, period_start)      créances de loyer
UNIQUE (charge_id, apartment_id)     créances de charge
```

Le passage en retard est un écrit idempotent : une créance déjà payée ou annulée n'y est jamais éligible.

## Operational Impact

L'échec d'un traitement doit être visible dans les journaux et rattrapable manuellement.

Le fuseau horaire de référence doit être explicite et documenté : une date d'échéance interprétée dans un fuseau différent décalerait les retards d'un jour.

## Migration

Passage futur à un système de files : conserver les services, remplacer le déclencheur. Les routes internes restent utiles comme point de déclenchement manuel.

## Related Documents

- `docs/07-operations/deployment.md`
- `docs/03-domain/business-rules.md`
- `docs/05-security/security.md`
- `docs/00-decisions/decision-register.md` (DEC-028)

## Related ADRs

- ADR-003, ADR-009, ADR-010
