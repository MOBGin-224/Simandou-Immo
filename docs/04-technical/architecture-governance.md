# Technical Decision Records & Architecture Governance Specification

## 1. Objet du document

Ce document définit la manière dont les décisions techniques et architecturales du SaaS doivent être prises, documentées, validées et maintenues dans le temps.

Il sert à éviter un problème fréquent dans les projets développés progressivement avec Claude Code :

```text
Petite décision
↓
Modification locale
↓
Nouvelle exception
↓
Nouvelle abstraction
↓
Nouvelle dépendance
↓
Architecture incohérente
```

L'objectif est de conserver une architecture compréhensible et cohérente même lorsque le projet grandit.

Ce document définit notamment :

- les décisions nécessitant une documentation ;
- le format des ADR ;
- les niveaux de décision ;
- le processus de validation ;
- les responsabilités ;
- la gestion des exceptions ;
- la gestion des changements d'architecture ;
- les règles applicables à Claude Code ;
- le lien entre décisions techniques et codebase.

---

# 2. Principes fondamentaux

## ARCH-GOV-001 : Une décision importante doit laisser une trace

Une décision structurante ne doit pas exister uniquement :

- dans une conversation ;
- dans la mémoire d'un développeur ;
- dans une Pull Request ;
- dans un commentaire de code.

Elle doit être documentée lorsqu'elle a un impact durable.

---

## ARCH-GOV-002 : Documenter la décision, pas uniquement le résultat

Une bonne documentation doit expliquer :

```text
Pourquoi cette solution ?
Pourquoi pas les alternatives ?
Quelles contraintes ?
Quel compromis ?
```

---

## ARCH-GOV-003 : Le code reste la source d'exécution

L'ADR explique la décision.

Le code implémente la décision.

L'ADR ne doit jamais être considéré comme une preuve que le code respecte réellement l'architecture.

---

## ARCH-GOV-004 : Les décisions peuvent être révisées

Une décision technique n'est pas éternelle.

Elle peut être :

```text
Proposed
↓
Accepted
↓
Superseded
```

ou :

```text
Proposed
↓
Rejected
```

---

## ARCH-GOV-005 : Préférer les changements explicites

Une modification importante de l'architecture ne doit pas être introduite progressivement par une série de petits contournements sans décision documentée.

---

# 3. MVP

# 3.1 Architecture de référence

Les décisions actuellement structurantes comprennent :

```text
Next.js (App Router)
React
TypeScript strict
Tailwind CSS
shadcn/ui
PostgreSQL
Drizzle ORM
Zod
React Hook Form
TanStack Query (lorsque nécessaire)
Modular Monolith
Repository unique
PWA
Mobile First
External Provider Adapters
```

Infrastructure :

```text
Local                    PostgreSQL via Docker
Development / Staging /
Production               Supabase PostgreSQL
Hébergement applicatif   Vercel
```

Ces choix sont enregistrés dans le **Product & Technical Decision Register** (DEC-006, DEC-007) et constituent la référence actuelle.

Ils ne peuvent être modifiés que par une décision explicite du fondateur.

> **Relation entre le registre et les ADR**
>
> Le **registre** enregistre qu'une décision a été prise et quel est son statut.
>
> Une **ADR** documente le raisonnement : contexte, alternatives, conséquences, migration.
>
> Une décision structurante entre d'abord au registre, puis reçoit une ADR lorsque son impact le justifie.

---

# 4. Qu'est-ce qu'une ADR ?

ADR signifie :

> Architecture Decision Record

Une ADR documente une décision technique importante.

Exemple :

```text
ADR-001
Choix d'une architecture modular monolith
```

---

# 5. Quand créer une ADR ?

Une ADR est recommandée lorsque la décision concerne notamment :

- architecture ;
- base de données ;
- authentification ;
- paiement ;
- stockage ;
- système de jobs ;
- déploiement ;
- sécurité ;
- API ;
- structure des modules ;
- dépendance externe majeure ;
- changement de framework ;
- changement de stratégie de données.

---

# 6. Cas ne nécessitant pas d'ADR

Il n'est pas nécessaire de créer une ADR pour :

- correction d'un bug courant ;
- changement de texte ;
- amélioration CSS locale ;
- renommage sans impact architectural ;
- ajout d'un test ;
- refactor local sans changement de contrat ;
- changement purement esthétique.

---

# 7. Niveaux de décision

Les décisions peuvent être classées :

## Niveau 1 : Local

Impact limité à un module.

Aucune ADR obligatoire.

---

## Niveau 2 : Module

Impact sur une partie importante du produit.

Documentation recommandée.

---

## Niveau 3 : Système

Impact sur plusieurs modules.

ADR obligatoire.

---

## Niveau 4 : Architecture

Impact sur l'ensemble du système.

ADR obligatoire et validation humaine obligatoire.

---

# 8. Template ADR

Toutes les ADR doivent utiliser une structure cohérente.

```markdown
# ADR-XXX : Titre

## Status

Proposed | Accepted | Rejected | Superseded

## Date

YYYY-MM-DD

## Context

Quel problème devons-nous résoudre ?

## Decision

Quelle décision avons-nous prise ?

## Alternatives

Quelles autres solutions ont été étudiées ?

## Reasons

Pourquoi cette solution ?

## Consequences

Quels avantages et compromis ?

## Security Impact

Quel impact sur la sécurité ?

## Data Impact

Quel impact sur les données ?

## Operational Impact

Quel impact sur l'exploitation ?

## Migration

Comment passer de l'existant à la nouvelle solution ?

## Related Documents

Quels documents sont concernés ?

## Related ADRs

Quelles autres décisions sont liées ?
```

---

# 9. Naming des ADR

Convention :

```text id="88rv3s"
ADR-001
ADR-002
ADR-003
```

Le numéro reste stable.

Le titre doit être explicite.

Exemple :

```text
ADR-004 : Architecture modular monolith
ADR-005 : Choix PostgreSQL
ADR-006 : Abstraction des fournisseurs de paiement
```

---

# 10. Emplacement

Les ADR doivent être regroupées dans un dossier dédié.

Exemple :

```text
docs/
└── architecture/
    └── adr/
        ├── ADR-001-...
        ├── ADR-002-...
        └── ADR-003-...
```

La structure exacte peut être adaptée au repository.

---

# 11. Status

Les statuts autorisés sont :

```text
PROPOSED
ACCEPTED
REJECTED
SUPERSEDED
```

Une décision supprimée de l'architecture actuelle ne doit pas être effacée.

Elle doit être conservée avec son historique.

---

# 12. Superseded

Lorsqu'une nouvelle décision remplace une ancienne :

```text
ADR-003
Status: SUPERSEDED

Superseded by:
ADR-017
```

La nouvelle ADR doit expliquer le changement.

---

# 13. Décisions techniques structurantes

Ces décisions sont prises, appliquées dans la documentation, et documentées par les ADR listées en section 14.

## MVP-ARCH-GOV-001

Architecture modular monolith.

---

## MVP-ARCH-GOV-002

Next.js + React + TypeScript.

---

## MVP-ARCH-GOV-003

PostgreSQL comme source de vérité.

---

## MVP-ARCH-GOV-004

Drizzle ORM.

---

## MVP-ARCH-GOV-005

PWA responsive mobile first.

---

## MVP-ARCH-GOV-006

External service adapters.

---

## MVP-ARCH-GOV-007

RBAC + Scope.

---

## MVP-ARCH-GOV-008

Invitation-based onboarding des gestionnaires et locataires.

---

## MVP-ARCH-GOV-014

Supabase comme fournisseur PostgreSQL managé, sans adhérence aux APIs propriétaires (DEC-007).

---

## MVP-ARCH-GOV-015

Créance de charge distincte de la créance de loyer, avec allocation multi-créances (DEC-005, DEC-022).

---

## MVP-ARCH-GOV-016

Autorisation rôle + périmètre, sans permissions granulaires par gestionnaire au MVP (DEC-025).

---

## MVP-ARCH-GOV-017

Jobs planifiés via Cron de plateforme et routes internes protégées, sans fournisseur de files externe (DEC-028).

---

# 14. ADR rédigées

Les décisions structurantes de la section 13 sont documentées dans `docs/architecture/adr/`.

Chaque ADR porte le raisonnement complet : contexte, décision, alternatives écartées, raisons, conséquences, impacts sécurité, données et exploitation, migration, documents et ADR liées.

Le présent document ne reproduit pas ce contenu. Il indique seulement quelle ADR couvre quelle décision.

| ADR | Décision couverte | Gouvernance |
|---|---|---|
| ADR-001 | Architecture modular monolith | MVP-ARCH-GOV-001 |
| ADR-002 | Next.js, React et TypeScript strict | MVP-ARCH-GOV-002 |
| ADR-003 | PostgreSQL comme source de vérité | MVP-ARCH-GOV-003 |
| ADR-004 | Drizzle ORM | MVP-ARCH-GOV-004 |
| ADR-005 | Supabase comme fournisseur PostgreSQL managé, et hébergement Vercel | MVP-ARCH-GOV-014 |
| ADR-006 | Better Auth pour l'authentification | DEC-032 |
| ADR-007 | Autorisation par rôle et périmètre | MVP-ARCH-GOV-007, MVP-ARCH-GOV-016 |
| ADR-008 | Onboarding par invitation | MVP-ARCH-GOV-008 |
| ADR-009 | Adapters pour les services externes | MVP-ARCH-GOV-006 |
| ADR-010 | Créance de charge distincte et allocation multi-créances | MVP-ARCH-GOV-015 |
| ADR-011 | PWA responsive mobile first | MVP-ARCH-GOV-005 |
| ADR-012 | Jobs planifiés via Cron de plateforme | MVP-ARCH-GOV-017 |

## Numéros réservés

Deux décisions restent ouvertes. Leurs numéros sont réservés afin que la numérotation reste stable.

| ADR | Sujet | Décision bloquante |
|---|---|---|
| ADR-013 | Fournisseur de stockage objet | DEC-033 |
| ADR-014 | Fournisseur de paiement | DEC-034 |

Ces deux ADR devront documenter les fournisseurs étudiés, les critères, les contraintes, le coût, la disponibilité, la qualité de l'API, les webhooks, l'environnement de test et la décision finale.

Pour le stockage : accès privé, URLs signées, validation des fichiers, stratégie de migration.

Les informations commerciales ou contractuelles sensibles ne doivent pas être versionnées dans Git.

---

# 15. Décisions temporaires

Certaines décisions peuvent être explicitement temporaires.

Exemple :

```text
Decision:
Utiliser Provider X pour le MVP.

Status:
Accepted

Review:
Après validation de 500 utilisateurs actifs
```

Cela évite de confondre une solution MVP avec une architecture définitive.

---

# 16. Architecture Fitness Functions

Le projet peut utiliser certaines règles automatisables afin de vérifier l'architecture.

Exemples :

```text id="szo5om"
UI
→ ne doit pas accéder directement à PostgreSQL

Domain
→ ne doit pas dépendre d'un provider externe concret

Payment Domain
→ ne doit pas importer une SDK fournisseur directement
```

---

# 17. MVP-ARCH-GOV-009 : Dependency Boundaries

Les modules doivent respecter des frontières.

Exemple :

```text id="q1paoo"
Presentation
↓
Application
↓
Domain
↓
Infrastructure
```

Éviter :

```text id="6f3x8m"
React Component
↓
Drizzle Query directe
```

pour les opérations métier importantes.

---

# 18. Architecture Boundary Tests

Lorsque pertinent, automatiser certains contrôles :

```text id="rb2fgb"
No direct DB access from UI
No provider imports from Domain
No unauthorized module dependency
```

---

# 19. Exceptions architecturales

Une exception peut être nécessaire.

Exemple :

```text
Une fonctionnalité urgente nécessite temporairement un accès direct à un service.
```

Cette exception doit être :

- documentée ;
- limitée ;
- justifiée ;
- idéalement temporaire ;
- suivie jusqu'à sa résolution.

---

# 20. Architecture Exception Record

Une exception peut être documentée sous la forme :

```markdown
# Exception-XXX

## Rule Violated

Quelle règle est violée ?

## Reason

Pourquoi ?

## Scope

Quels fichiers / modules ?

## Risk

Quel risque ?

## Temporary or Permanent

Quelle nature ?

## Removal Plan

Comment supprimer l'exception ?
```

---

# 21. MVP-ARCH-GOV-010 : Pas d'exception silencieuse

Une exception architecturale ne doit pas être introduite discrètement dans le code.

---

# 22. Changement architectural

Lorsqu'un changement architectural est proposé :

```text id="mm28ji"
Problem
↓
Proposal
↓
Alternatives
↓
Impact
↓
ADR
↓
Approval
↓
Implementation
↓
Validation
```

---

# 23. Évaluation de l'impact

Avant une modification importante, analyser :

### Code

Quels modules changent ?

### Data

Quelles tables changent ?

### API

Quels contrats changent ?

### Security

Quels accès changent ?

### UX

Quels parcours changent ?

### DevOps

Quels déploiements changent ?

### Tests

Quels tests doivent changer ?

---

# 24. Breaking Change

Un changement est considéré comme breaking lorsqu'il modifie un contrat existant de manière incompatible.

Exemples :

- suppression d'un endpoint ;
- modification incompatible d'un payload ;
- suppression d'un champ utilisé ;
- changement de comportement métier ;
- changement d'authentification.

Les breaking changes doivent être explicitement identifiés.

---

# 25. Migration d'architecture

Une migration importante doit suivre :

```text id="ny9e3z"
Current State
↓
Transition State
↓
Target State
```

Éviter autant que possible les migrations "big bang" pour les composants critiques.

---

# 26. Architecture Decision Review

Les décisions importantes doivent être revues à certains moments :

- lancement ;
- changement de fournisseur ;
- changement de volume ;
- nouvelle application cliente ;
- nouveau pays ;
- nouveau domaine fonctionnel.

---

# 27. Revue après MVP

Après le MVP, réaliser une revue :

```text id="8lc4sa"
Architecture actuelle
vs
Architecture documentée
```

Identifier :

- dérives ;
- exceptions ;
- dette technique ;
- décisions obsolètes.

---

# 28. Architecture Drift

L'architecture drift correspond à la divergence entre l'architecture prévue et le code réel.

Exemples :

```text id="qbd1sy"
Document:
Payment Adapter

Code:
Payment SDK importé dans 8 modules
```

ou :

```text
Document:
Mobile First

Code:
Composants conçus uniquement desktop
```

---

# 29. MVP-ARCH-GOV-011 : Détection du drift

La revue de code et les tests architecturaux doivent chercher régulièrement les dérives significatives.

---

# 30. Documentation des dépendances

Le repository doit pouvoir répondre à :

```text id="bveo9w"
Pourquoi cette dépendance ?
Quelle version ?
Quel module l'utilise ?
Peut-on la supprimer ?
```

---

# 31. Ajout d'une dépendance

Avant d'ajouter une nouvelle bibliothèque importante, évaluer :

```text id="z0du6i"
Need
↓
Existing capability
↓
Maintenance
↓
Security
↓
Bundle impact
↓
License
↓
Community
↓
Alternative
```

---

# 32. MVP-ARCH-GOV-012 : Pas de dépendance pour une fonction triviale

Ne pas ajouter une bibliothèque lourde pour résoudre un problème pouvant être traité proprement avec l'écosystème déjà présent.

---

# 33. Dépendances critiques

Pour les dépendances critiques :

- suivre les versions ;
- surveiller les vulnérabilités ;
- documenter leur rôle ;
- éviter les dépendances inutiles.

---

# 34. Compatibilité

Une modification de dépendance importante doit être testée avec :

- application ;
- API ;
- database ;
- auth ;
- paiements ;
- tests ;
- build.

---

# 35. Documentation des contrats

Les contrats suivants doivent rester cohérents :

```text id="ezo54u"
Database
API
Domain
UI
External Providers
```

Une modification dans l'un peut nécessiter une mise à jour des autres.

---

# 36. API Governance

Toute modification importante d'API doit préciser :

```text id="50qucu"
Endpoint
Method
Input
Output
Errors
Authorization
Compatibility
```

---

# 37. Database Governance

Toute modification importante du modèle doit préciser :

```text id="nq4yss"
Table
Column
Constraint
Index
Migration
Data Impact
Rollback
```

---

# 38. Security Governance

Toute modification de :

- permission ;
- rôle ;
- session ;
- accès document ;
- paiement ;
- données personnelles ;

doit inclure une analyse de sécurité.

---

# 39. Product Governance

Une décision technique ne doit pas modifier implicitement une règle produit.

Exemple :

Changer le système de paiement ne doit pas modifier silencieusement :

- montant ;
- échéance ;
- allocation ;
- statut métier.

---

# 40. Claude Code Governance

Claude Code est autorisé à :

- explorer le code ;
- implémenter les tickets ;
- créer les tests ;
- effectuer des refactors limités ;
- proposer des améliorations.

Claude Code ne doit pas décider silencieusement :

- d'une nouvelle architecture ;
- d'un nouveau provider critique ;
- d'un changement de schéma majeur ;
- d'une nouvelle règle métier ;
- d'un contournement de sécurité.

---

# 41. MVP-ARCH-GOV-013 : Détection des changements structurants

Si Claude Code découvre qu'une tâche nécessite une décision structurante non documentée :

```text
Stop changement structurel
↓
Décrire le problème
↓
Proposer options
↓
Créer ou demander une ADR
↓
Puis implémenter
```

Le terme "Stop" signifie ici ne pas implémenter silencieusement le changement architectural.

Une modification locale permettant de poursuivre sans compromettre l'architecture peut toutefois être réalisée.

---

# 42. Claude Code : pas de refactor opportuniste massif

Claude Code ne doit pas profiter d'une tâche pour réécrire massivement :

- architecture ;
- composants ;
- services ;
- database ;

sans que cela soit dans le scope.

---

# 43. Claude Code : architecture existante prioritaire

Avant de proposer une nouvelle architecture, vérifier si le besoin peut être résolu dans l'architecture actuelle.

---

# 44. Claude Code : documenter les compromis

Lorsqu'un choix est nécessaire entre plusieurs solutions raisonnables, la réponse ou la PR doit préciser :

- choix retenu ;
- raison ;
- compromis.

Une ADR est créée si le choix a un impact durable.

---

# 45. Revue d'architecture

Une revue architecturale doit répondre :

```text
Le code respecte-t-il les frontières ?
Les modules restent-ils découplés ?
Les providers sont-ils isolés ?
La sécurité est-elle centralisée ?
Les données restent-elles cohérentes ?
Le mobile first est-il respecté ?
Les tests couvrent-ils les changements ?
```

---

# 46. Future Evolutions

## FUT-ARCH-GOV-001 : Architecture Review Board

Lorsque l'équipe et le produit grandiront, une gouvernance formelle pourra être mise en place.

---

## FUT-ARCH-GOV-002 : Architecture Metrics

Introduire des métriques :

- coupling ;
- cycle dependencies ;
- module size ;
- test coverage ;
- technical debt.

---

## FUT-ARCH-GOV-003 : Automated Architecture Enforcement

Mettre en place des outils automatisant davantage les règles d'architecture.

---

## FUT-ARCH-GOV-004 : Dependency Graph

Générer automatiquement :

```text id="jgz1dl"
Module A
↓
Module B
↓
Module C
```

afin de détecter les dépendances anormales.

---

## FUT-ARCH-GOV-005 : Formal Technical Debt Register

Maintenir un registre complet de :

- dette technique ;
- exceptions ;
- migrations ;
- composants obsolètes.

---

# 47. Architecture Constraints Related to Future Evolutions

## ARCH-GOV-001

Conserver des frontières de modules explicites.

---

## ARCH-GOV-002

Conserver des adapters autour des fournisseurs externes.

---

## ARCH-GOV-003

Conserver une logique métier indépendante de la couche UI.

---

## ARCH-GOV-004

Conserver des migrations versionnées.

---

## ARCH-GOV-005

Conserver des tests de régression permettant de sécuriser les évolutions.

---

## ARCH-GOV-006

Conserver les ADR historiques même lorsqu'elles sont remplacées.

---

# 48. Out of Scope

## OUT-ARCH-GOV-001

Mettre en place une gouvernance bureaucratique pour chaque petite modification.

---

## OUT-ARCH-GOV-002

Créer une ADR pour chaque bug.

---

## OUT-ARCH-GOV-003

Bloquer le développement sur des décisions purement cosmétiques.

---

## OUT-ARCH-GOV-004

Transformer le MVP en organisation d'architecture d'entreprise lourde.

---

# 49. Definition of Done d'une décision architecturale

Une décision importante est considérée comme correctement intégrée lorsque :

```text id="8h6lmx"
[ ] Problème documenté
[ ] Alternatives étudiées
[ ] Décision explicitée
[ ] Conséquences identifiées
[ ] Sécurité analysée
[ ] Data impact analysé
[ ] Migration définie si nécessaire
[ ] Code aligné
[ ] Tests alignés
[ ] Documentation liée
```

---

# 50. Checklist de changement architectural

```text id="w0qs0l"
[ ] Est-ce réellement architectural ?
[ ] Existe-t-il déjà une solution ?
[ ] Quel est l'impact ?
[ ] Existe-t-il une alternative plus simple ?
[ ] Faut-il une ADR ?
[ ] Y a-t-il un impact sécurité ?
[ ] Y a-t-il un impact database ?
[ ] Y a-t-il un impact API ?
[ ] Y a-t-il un impact DevOps ?
[ ] Quels tests doivent changer ?
[ ] Comment migrer ?
```

---

# 51. Registre des ADR

Le registre des ADR est maintenu en un seul endroit :

```text
docs/architecture/adr/README.md
```

Il liste les ADR existantes, leur statut, et les numéros réservés aux décisions encore ouvertes.

Aucune table d'ADR n'est dupliquée ailleurs, y compris dans le présent document : une seconde table divergerait de la première.

Les douze ADR de la section 14 ont été rédigées pendant le Lot 0.

---

# 52. Principe de stabilité

Une bonne architecture ne signifie pas une architecture qui ne change jamais.

Elle signifie une architecture qui change volontairement.

```text id="1ag6fy"
Besoin
↓
Analyse
↓
Décision
↓
Documentation
↓
Implémentation
↓
Validation
```

---

# 53. Principe final

L'architecture du produit doit rester compréhensible même lorsque :

- de nouvelles fonctionnalités apparaissent ;
- de nouveaux développeurs rejoignent le projet ;
- Claude Code intervient sur plusieurs mois ;
- les fournisseurs changent ;
- le volume augmente ;
- de nouvelles applications sont ajoutées.

La règle directrice est :

> **Aucune décision technique structurante ne doit devenir une règle cachée dans le code. Lorsqu'une décision change durablement l'architecture, elle doit être visible, justifiée et traçable.**