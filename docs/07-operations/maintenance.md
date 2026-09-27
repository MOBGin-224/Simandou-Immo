# Post-Launch Operations & Maintenance Specification

## 1. Objet du document

Ce document définit la manière dont le SaaS doit être exploité et maintenu après son lancement.

Il couvre :

- le support utilisateurs ;
- les incidents ;
- la maintenance corrective ;
- la maintenance préventive ;
- la maintenance évolutive ;
- les mises à jour de dépendances ;
- les migrations ;
- les sauvegardes ;
- la sécurité opérationnelle ;
- le monitoring ;
- la gestion de la dette technique ;
- les releases ;
- la documentation ;
- les procédures d'exploitation.

L'objectif est d'éviter qu'après le lancement, le produit devienne simplement un système qui fonctionne "tant qu'on ne le touche pas".

Le produit doit être maintenu comme un système vivant.

---

# 2. Principes fondamentaux

## OPS-001 : Le lancement n'est pas la fin du développement

Après le lancement :

```text id="7yjm7u"
Produit
↓
Observation
↓
Correction
↓
Amélioration
↓
Nouvelle observation
```

---

## OPS-002 : Protéger le fonctionnement avant d'ajouter

Lorsqu'un problème critique apparaît, la priorité est :

```text id="zfs0u1"
Stabilité
>
Sécurité
>
Intégrité des données
>
Expérience
>
Nouvelles fonctionnalités
```

---

## OPS-003 : Les problèmes doivent être tracés

Éviter les corrections uniquement dans :

- WhatsApp ;
- conversations privées ;
- mémoire de l'équipe.

Un incident ou bug important doit devenir un élément traçable.

---

## OPS-004 : Ne pas masquer les problèmes par des interventions manuelles

Une correction manuelle peut restaurer un service, mais elle ne doit pas empêcher l'équipe de documenter la cause du problème.

---

## OPS-005 : Le système doit rester observable

Après chaque évolution importante, il doit rester possible d'identifier :

- erreurs ;
- dégradation ;
- anomalies ;
- échecs d'intégration ;
- problèmes de performance.

---

# 3. Modèle opérationnel

Le fonctionnement post-lancement suit :

```text id="7d25ut"
User
↓
Produit
↓
Monitoring
↓
Incident / Feedback
↓
Triage
↓
Correction
↓
Test
↓
Release
↓
Observation
```

---

# 4. MVP

# 4.1 Support utilisateur

## MVP-OPS-001 : Canal de support

Le produit doit disposer d'un canal identifiable permettant aux utilisateurs de signaler :

- problème ;
- question ;
- incident ;
- difficulté d'utilisation.

Le canal initial peut être simple.

Il n'est pas nécessaire de construire un centre de support complexe au MVP.

---

# 5. Catégories de demandes support

Chaque demande doit être classée :

```text id="vl8qn3"
QUESTION
BUG
INCIDENT
ACCOUNT
PAYMENT
TECHNICAL
FEATURE_REQUEST
```

---

# 6. Support par rôle

Le support doit pouvoir identifier le rôle :

```text id="5w8kwm"
OWNER
MANAGER
TENANT
```

Le problème rencontré par un propriétaire n'est pas nécessairement le même que celui d'un locataire.

---

# 7. Priorité support

## P0 : Critique

Exemples :

- impossibilité générale de se connecter ;
- fuite de données ;
- paiement incorrect ;
- corruption de données ;
- indisponibilité globale.

---

## P1 : Majeur

Exemples :

- fonctionnalité cœur indisponible ;
- nombreux utilisateurs affectés ;
- opération financière fortement dégradée.

---

## P2 : Important

Exemples :

- problème important mais contournable ;
- fonctionnalité secondaire dégradée.

---

## P3 : Mineur

Exemples :

- problème visuel ;
- wording ;
- détail non bloquant.

---

# 8. Ticket d'incident

Chaque incident doit contenir au minimum :

```text id="4nmxh1"
Incident ID
Date
Environnement
Version
Impact
Rôle concerné
Description
Étapes
Résultat attendu
Résultat obtenu
Criticité
Statut
Owner
Resolution
```

---

# 9. Cycle de vie incident

```text id="o93z4u"
Detected
↓
Triaged
↓
Assigned
↓
Investigating
↓
Mitigated
↓
Resolved
↓
Closed
```

---

# 10. Incident majeur

Pour un P0 ou P1 :

1. identifier ;
2. confirmer ;
3. limiter l'impact ;
4. restaurer le service ;
5. corriger ;
6. analyser la cause ;
7. documenter ;
8. vérifier l'absence de régression.

---

# 11. Communication incident

Lorsqu'un incident affecte les utilisateurs, communiquer de manière :

- claire ;
- factuelle ;
- non technique lorsque possible ;
- proportionnée.

Éviter de divulguer des détails sensibles.

---

# 12. Maintenance corrective

La maintenance corrective vise à réparer un comportement incorrect.

Exemple :

```text id="7z6z2e"
Bug paiement partiel
↓
Fix
↓
Tests
↓
Staging
↓
Production
```

---

# 13. Maintenance préventive

La maintenance préventive vise à éviter certains problèmes futurs.

Exemples :

- mise à jour de dépendances ;
- vérification des backups ;
- tests de restauration ;
- contrôle des jobs ;
- vérification de stockage ;
- rotation des credentials lorsque nécessaire.

---

# 14. Maintenance évolutive

Une demande qui ajoute une nouvelle capacité doit être traitée comme une évolution produit.

Elle doit être classée :

```text id="6o0e4f"
MVP
ou
FUTURE
```

et suivre le backlog approprié.

---

# 15. Release Management

Chaque release doit avoir :

- une version ;
- une date ;
- un contenu ;
- un niveau de risque ;
- les migrations éventuelles ;
- les tests réalisés.

---

# 16. Versionnement

Le projet peut utiliser une convention cohérente de versionnement.

Exemple :

```text id="5v7jwb"
v1.0.0
v1.0.1
v1.1.0
```

La convention exacte peut être adaptée au workflow du projet.

---

# 17. Release Types

## Patch

Correction sans changement fonctionnel majeur.

## Minor

Ajout compatible.

## Major

Changement potentiellement incompatible.

---

# 18. MVP : Release Checklist

Avant une release :

```text id="9s2gt2"
[ ] Tests OK
[ ] Build OK
[ ] Migration testée
[ ] Staging validé
[ ] Monitoring prêt
[ ] Rollback identifié
[ ] Release notes prêtes
```

---

# 19. Déploiement

Le workflow reste :

```text id="dxtbaw"
Code
↓
CI
↓
Review
↓
Staging
↓
Validation
↓
Production
```

---

# 20. Smoke Test post-release

Après chaque release importante :

```text id="zg2d2g"
Login
Dashboard
Property
Tenant
Rent
Payment
Notification
Incident
```

doivent être vérifiés selon le périmètre de la release.

---

# 21. Migration post-lancement

Toute modification de schéma doit :

- être versionnée ;
- être testée ;
- avoir un plan de migration ;
- tenir compte des données existantes.

---

# 22. Migration de données

Une migration de données doit préciser :

```text id="dz2iw2"
Source
Destination
Transformation
Volume
Risques
Validation
Rollback / Recovery
```

---

# 23. Sauvegardes

## MVP-OPS-002

Les sauvegardes doivent continuer après le lancement.

Vérifier régulièrement :

- exécution ;
- stockage ;
- rétention ;
- intégrité.

---

# 24. Test de restauration

## MVP-OPS-003

Un test de restauration doit être effectué périodiquement.

Le résultat doit être documenté.

---

# 25. Monitoring quotidien

L'équipe doit pouvoir consulter rapidement :

```text id="ptx6mt"
Application
Database
Jobs
Payments
Notifications
Storage
Errors
```

---

# 26. Error Budget simplifié

Le MVP n'a pas besoin d'un système SRE complexe.

Cependant, l'équipe doit définir un principe :

> Si la stabilité se dégrade fortement, les nouvelles fonctionnalités peuvent être temporairement ralenties pour concentrer l'effort sur la fiabilité.

---

# 27. Surveillance des paiements

Le suivi des paiements doit inclure :

- taux de succès ;
- transactions en attente ;
- échecs ;
- webhooks ;
- doublons ;
- anomalies.

---

# 28. Surveillance des jobs

Surveiller :

- jobs échoués ;
- retries ;
- jobs bloqués ;
- retard d'exécution.

---

# 29. Surveillance des notifications

Suivre :

- envoyées ;
- délivrées lorsque disponible ;
- échouées ;
- retries.

---

# 30. Maintenance des dépendances

Les dépendances critiques doivent être revues régulièrement.

Priorité aux :

- vulnérabilités ;
- dépendances abandonnées ;
- versions incompatibles ;
- problèmes de sécurité.

---

# 31. Processus de mise à jour

```text id="q7y8z7"
Nouvelle version
↓
Évaluation
↓
Tests
↓
Staging
↓
Production
↓
Monitoring
```

---

# 32. Mise à jour critique de sécurité

Lorsqu'une vulnérabilité critique est identifiée :

```text id="a7fml1"
Identifier
↓
Évaluer
↓
Corriger
↓
Tester
↓
Déployer
↓
Vérifier
```

La priorité peut passer devant les fonctionnalités prévues.

---

# 33. Secrets

Les credentials et secrets doivent être régulièrement évalués.

Une rotation peut être nécessaire lorsque :

- secret compromis ;
- fournisseur recommande une rotation ;
- membre de l'équipe quitte un accès sensible ;
- incident de sécurité.

---

# 34. Accès production

Les accès doivent être revus périodiquement.

Supprimer les accès qui ne sont plus nécessaires.

---

# 35. Comptes administratifs

Les comptes inutilisés ou obsolètes doivent être désactivés.

---

# 36. Data Integrity Checks

Des contrôles périodiques peuvent vérifier :

```text id="6f2j1s"
Payments ↔ Allocations
Leases ↔ Apartments
Tenants ↔ Leases
Charges ↔ Allocations
Receipts ↔ Payments
```

L'objectif est de détecter les incohérences avant qu'elles deviennent des incidents utilisateurs.

---

# 37. Contrôle des doublons

Surveiller les données pouvant être dupliquées à tort :

- paiements ;
- échéances ;
- invitations ;
- notifications.

---

# 38. Contrôle des ressources orphelines

Identifier périodiquement :

- documents sans relation ;
- allocations sans paiement ;
- contrats invalides ;
- invitations expirées persistantes ;
- notifications impossibles à délivrer.

---

# 39. Nettoyage contrôlé

Tout nettoyage automatique doit être :

- documenté ;
- testé ;
- réversible lorsque possible ;
- limité à des données clairement identifiées.

---

# 40. Technical Debt

La dette technique doit être explicitement suivie.

Elle peut concerner :

- code ;
- database ;
- architecture ;
- tests ;
- UX ;
- DevOps.

---

# 41. Registre de dette technique

Chaque dette importante peut être documentée :

```text id="a9la4c"
Debt ID
Problem
Impact
Risk
Workaround
Priority
Target
```

---

# 42. Priorité dette technique

## P0

Met en danger :

- sécurité ;
- intégrité ;
- disponibilité.

## P1

Rend une évolution importante difficile.

## P2

Complexifie la maintenance.

## P3

Amélioration souhaitable.

---

# 43. Maintenance du codebase

Préserver :

- architecture ;
- conventions ;
- tests ;
- documentation ;
- modularité.

Éviter l'accumulation de "temporary fixes" sans suivi.

---

# 44. Temporary Fix

Un correctif temporaire doit être explicitement marqué lorsque sa nature le justifie.

Exemple :

```text id="8cds0m"
TODO
TECH-DEBT
FOLLOW-UP
```

Il doit idéalement être associé à un ticket.

---

# 45. Maintenance UX

L'UX doit être réévaluée lorsque :

- une fonctionnalité génère beaucoup de confusion ;
- un parcours crée beaucoup de support ;
- des utilisateurs répètent les mêmes erreurs ;
- le contexte d'utilisation change.

---

# 46. Maintenance Mobile

Puisque le produit est Mobile First, vérifier régulièrement :

- nouvelles tailles d'écran ;
- navigateurs mobiles ;
- performance ;
- clavier ;
- upload ;
- navigation tactile ;
- PWA.

---

# 47. Support locataire

Les problèmes récurrents des locataires doivent être regroupés par catégorie.

Exemples :

```text id="dxw8hp"
Activation
Payment
Receipt
Charge
Incident
Notification
```

Cela permet d'identifier les vrais points de friction.

---

# 48. Support gestionnaire

Même principe :

```text id="z6zqsr"
Property
Tenant
Lease
Rent
Payment
Charge
Maintenance
```

---

# 49. Support propriétaire

Catégories principales :

```text id="d5j4z6"
Property
Managers
Finance
Reports
Permissions
```

---

# 50. Support et sécurité

Une demande utilisateur qui révèle :

- activité suspecte ;
- accès inattendu ;
- paiement inconnu ;
- accès à mauvais document ;

doit être escaladée comme problème de sécurité potentiel.

---

# 51. Support et paiement

Un problème de paiement ne doit pas être corrigé uniquement depuis la base sans comprendre :

- transaction fournisseur ;
- webhook ;
- allocation ;
- quittance ;
- historique.

---

# 52. Correction financière

Toute correction manuelle d'une donnée financière importante doit être :

- autorisée ;
- traçable ;
- documentée.

Éviter les modifications silencieuses.

---

# 53. Data Repair

Une correction de données importante doit idéalement être réalisée par :

```text id="fhq0ed"
Script contrôlé
+
Transaction
+
Backup / protection
+
Audit
+
Validation
```

plutôt qu'une série de modifications manuelles non documentées.

---

# 54. Incident Response

En cas d'incident critique :

```text id="n7gwx9"
Incident
↓
Containment
↓
Recovery
↓
Root Cause
↓
Corrective Action
↓
Postmortem
```

---

# 55. Postmortem

Pour les incidents P0 et les P1 majeurs, documenter :

```text id="kt3xw8"
What happened?
Why?
Impact?
Detection?
Resolution?
What went well?
What failed?
Preventive action?
```

Le postmortem doit être factuel et orienté amélioration.

---

# 56. Monitoring après incident

Après un incident important :

- ajouter une alerte lorsque pertinente ;
- ajouter un test lorsque possible ;
- ajouter une vérification si nécessaire ;
- mettre à jour le runbook.

---

# 57. Runbooks

Les opérations récurrentes doivent disposer de procédures.

Minimum :

```text id="r1pxb4"
Deployment
Rollback
Backup
Restore
Payment Incident
Auth Incident
Storage Incident
Provider Outage
Security Incident
```

---

# 58. Onboarding technique d'un nouveau développeur

Le repository doit permettre à un nouveau développeur de comprendre :

```text id="8sci8v"
Architecture
Setup
Environment
Tests
Deployment
Modules
Security
```

sans dépendre entièrement d'une personne.

---

# 59. Documentation opérationnelle

Maintenir à jour :

- README ;
- architecture ;
- ADR ;
- runbooks ;
- variables ;
- procédures ;
- release notes.

---

# 60. Future Evolutions

## FUT-OPS-001 : Support Desk intégré

Créer un module interne de support :

- tickets ;
- SLA ;
- historique ;
- affectation ;
- macros.

---

## FUT-OPS-002 : Status Page publique

Publier l'état des services externes ou de la plateforme.

---

## FUT-OPS-003 : SLA avancés

Définir des objectifs de disponibilité et de temps de réponse.

---

## FUT-OPS-004 : On-call

Mettre en place une rotation opérationnelle lorsque l'activité le justifie.

---

## FUT-OPS-005 : SRE avancé

Introduire progressivement :

- SLO ;
- SLI ;
- error budgets ;
- observabilité avancée.

---

## FUT-OPS-006 : Automated Data Integrity

Mettre en place des contrôles automatiques plus complets de cohérence.

---

## FUT-OPS-007 : Automated Dependency Management

Automatiser davantage :

- PR de mise à jour ;
- détection de vulnérabilités ;
- tests ;
- validation.

---

# 61. Architecture Constraints Related to Future Evolutions

## ARCH-OPS-001 : Observabilité centralisée

Les composants doivent produire des logs structurés compatibles avec une centralisation future.

---

## ARCH-OPS-002 : Runbook-friendly operations

Les opérations importantes doivent pouvoir être exécutées selon une procédure documentée.

---

## ARCH-OPS-003 : Scripts de maintenance séparés

Les scripts de correction ou de maintenance doivent être séparés du code métier normal lorsque leur finalité est opérationnelle.

---

## ARCH-OPS-004 : Audit des réparations

Les corrections manuelles importantes doivent pouvoir être tracées.

---

## ARCH-OPS-005 : Backup-aware operations

Les opérations destructives ou à risque doivent tenir compte de la récupération.

---

## ARCH-OPS-006 : Provider failure isolation

Une panne d'un fournisseur externe ne doit pas faire tomber l'ensemble du produit lorsqu'un fonctionnement dégradé est possible.

---

# 62. Out of Scope

## OUT-OPS-001

Construire un centre de support complet dès le MVP.

---

## OUT-OPS-002

Mettre en place une équipe d'astreinte 24/7 avant que le niveau d'activité ne le justifie.

---

## OUT-OPS-003

Construire une plateforme SRE complexe au lancement.

---

## OUT-OPS-004

Automatiser toutes les opérations de maintenance avant de comprendre les besoins réels.

---

## OUT-OPS-005

Créer des procédures extrêmement lourdes pour des opérations simples.

---

# 63. Definition of Done Operations

Le produit est correctement exploitable lorsque :

```text id="h6o3ou"
[ ] Support identifié
[ ] Incidents traçables
[ ] Monitoring actif
[ ] Backups actifs
[ ] Restore testé
[ ] Runbooks disponibles
[ ] Releases documentées
[ ] Accès production contrôlés
[ ] Dépendances surveillées
[ ] Dette technique suivie
```

---

# 64. Checklist hebdomadaire

Une vérification périodique peut inclure :

```text id="r1f3ov"
[ ] Errors
[ ] Jobs failures
[ ] Payment failures
[ ] Notification failures
[ ] Database health
[ ] Storage
[ ] Backup status
[ ] Security alerts
[ ] Support issues
[ ] Technical debt
```

La fréquence exacte peut évoluer selon le niveau d'activité.

---

# 65. Checklist mensuelle

Lorsque le produit commence à être utilisé régulièrement :

```text id="k6c7o3"
[ ] Dependency review
[ ] Access review
[ ] Backup restore check
[ ] Cost review
[ ] Performance review
[ ] Product analytics review
[ ] Incident review
[ ] Security review
[ ] Technical debt review
```

---

# 66. Principe de maintenance continue

Après le lancement, chaque problème récurrent doit être transformé autant que possible en amélioration du système :

```text id="f5ytcb"
Incident
↓
Cause
↓
Correction
↓
Test
↓
Monitoring
↓
Prévention
```

---

# 67. Principe final

Un produit SaaS n'est pas terminé lorsqu'il est déployé.

Il est réellement exploitable lorsque l'équipe peut :

- comprendre ce qui se passe ;
- détecter les problèmes ;
- restaurer le service ;
- protéger les données ;
- corriger proprement ;
- éviter la répétition des incidents ;
- faire évoluer le produit sans dégrader son cœur.

Le principe directeur est :

> **Maintenir la stabilité du produit aussi rigoureusement que nous construisons ses fonctionnalités.**