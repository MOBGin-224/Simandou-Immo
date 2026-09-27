# Performance & Reliability Specification

## 1. Objet du document

Ce document définit les exigences de performance et de fiabilité du SaaS de gestion d'immeubles.

Il couvre notamment :

- temps de chargement ;
- temps de réponse API ;
- performance mobile ;
- performance des dashboards ;
- requêtes base de données ;
- cache ;
- images ;
- jobs ;
- intégrations externes ;
- réseau faible ;
- concurrence ;
- résilience ;
- dégradation contrôlée ;
- limites ;
- surveillance ;
- tests de performance.

L'objectif n'est pas de rendre le produit artificiellement optimisé dès le premier jour.

L'objectif est de garantir une expérience suffisamment rapide et fiable pour les usages réels du MVP, tout en évitant une architecture surdimensionnée.

---

# 2. Principes fondamentaux

## PERF-001 : Mobile first implique performance first

Le smartphone constitue la référence de performance.

Une interface rapide sur desktop mais lente sur smartphone n'est pas considérée comme suffisamment performante.

---

## PERF-002 : La perception utilisateur compte

La performance doit être évaluée selon :

```text id="9r6l98"
Temps technique
+
Temps perçu
+
Clarté du chargement
```

Une opération qui prend du temps doit expliquer son état plutôt que laisser l'utilisateur penser que l'application est bloquée.

---

## PERF-003 : Mesurer avant d'optimiser

Toute optimisation importante doit partir d'une mesure réelle.

Éviter les optimisations fondées uniquement sur des intuitions.

---

## PERF-004 : La fiabilité prime sur quelques millisecondes

Pour les opérations financières :

```text id="a6t8pk"
Intégrité
>
Fiabilité
>
Performance
```

Une optimisation qui augmente le risque de double paiement ou de données incohérentes est interdite.

---

## PERF-005 : Une panne externe ne doit pas faire tomber tout le produit

Lorsque cela est possible :

```text id="o1w7nk"
Provider indisponible
↓
Fonction concernée dégradée
↓
Produit principal continue
```

---

# 3. MVP

# 4. Objectifs de performance

Les objectifs doivent être considérés comme des cibles opérationnelles et non comme des garanties absolues indépendantes du réseau de l'utilisateur.

## MVP-PERF-001 : Navigation

Les écrans courants doivent apparaître rapidement sur une connexion mobile raisonnable.

Priorités :

- dashboard ;
- liste immeubles ;
- liste locataires ;
- paiements ;
- incidents.

---

## MVP-PERF-002 : API

Les endpoints courants doivent répondre rapidement dans des conditions normales.

Une première cible de développement peut être :

```text id="ch9d3m"
P50 < 300 ms
P95 < 800 ms
```

pour les opérations API simples, hors appels externes lents.

Les objectifs réels devront être ajustés selon l'infrastructure et les mesures de production.

---

# 5. API lentes par nature

Certaines opérations ne doivent pas être contraintes au même niveau :

- paiement externe ;
- génération complexe ;
- export ;
- traitement de fichier ;
- job asynchrone.

Dans ces cas :

```text id="0f1x9r"
Request
↓
Accepted
↓
Processing
↓
Result / Notification
```

peut être préférable à une requête interactive longue.

---

# 6. MVP : Core Web Performance

Les écrans critiques doivent être surveillés selon les métriques web pertinentes.

Suivre notamment :

- chargement initial ;
- Largest Contentful Paint lorsque mesurable ;
- interaction ;
- stabilité visuelle ;
- poids des assets.

Les seuils exacts doivent être définis avec les outils de mesure retenus.

---

# 7. MVP : Performance mobile

Tester sur plusieurs profils :

### Mobile rapide

Connexion stable et appareil relativement récent.

### Mobile moyen

Appareil courant avec ressources limitées.

### Réseau lent

Connexion mobile dégradée.

L'objectif est de détecter les problèmes qui n'apparaissent pas sur un ordinateur puissant connecté à un réseau rapide.

---

# 8. Taille du JavaScript

## MVP-PERF-003

Éviter de charger inutilement toutes les fonctionnalités dans chaque écran.

Utiliser lorsque pertinent :

- code splitting ;
- lazy loading ;
- imports ciblés ;
- composants dynamiques.

---

# 9. Images

## MVP-PERF-004

Les images utilisateur doivent être optimisées.

Éviter :

- images originales gigantesques ;
- téléchargement d'images hors écran ;
- plusieurs copies inutiles ;
- images non adaptées au contexte mobile.

---

# 10. Photos d'incidents

Le workflow recommandé :

```text id="u8t5ot"
Photo smartphone
↓
Compression / validation
↓
Upload
↓
Storage
↓
Version adaptée à l'affichage
```

L'original peut être conservé lorsque les règles métier le justifient.

---

# 11. Lazy Loading

Les contenus non immédiatement nécessaires peuvent être chargés plus tard.

Exemples :

- détails secondaires ;
- historique long ;
- documents ;
- images hors écran.

---

# 12. Navigation

La navigation courante ne doit pas déclencher inutilement de nouveaux chargements complets.

Lorsque l'architecture le permet, privilégier les mécanismes de navigation et de mise à jour appropriés à Next.js.

---

# 13. Dashboard

Les dashboards doivent éviter de charger toutes les données historiques en une seule requête.

Préférer :

```text id="41r0uo"
KPIs essentiels
+
Données récentes
+
Chargement secondaire
```

---

# 14. Agrégations

Les agrégations importantes doivent être calculées efficacement.

Éviter :

```text id="d3lpnf"
Load all payments
↓
Calculate total in JavaScript
```

Préférer lorsque pertinent :

```text id="x7q5z0"
Database aggregation
↓
Return result
```

---

# 15. Pagination

## MVP-PERF-005

Les listes potentiellement importantes doivent utiliser :

- pagination ;
- pagination cursor lorsque nécessaire ;
- chargement progressif.

Exemples :

- paiements ;
- locataires ;
- incidents ;
- activité.

---

# 16. Limites de requêtes

Chaque endpoint listant des ressources doit avoir des limites.

Exemple :

```text id="x7c95p"
pageSize <= 100
```

La valeur exacte dépend du cas d'utilisation.

---

# 17. Recherche

La recherche doit rester rapide sur les ensembles de données attendus du MVP.

Prévoir :

- index adaptés ;
- recherche limitée au périmètre ;
- pagination des résultats.

---

# 18. Index database

## MVP-PERF-006

Les colonnes utilisées régulièrement pour :

- organisation ;
- property ;
- apartment ;
- tenant ;
- lease ;
- payment ;
- status ;
- date ;

doivent être indexées lorsque les patterns d'accès le justifient.

---

# 19. N+1 Queries

## MVP-PERF-007

Les parcours critiques doivent être vérifiés contre les problèmes N+1.

Exemple à éviter :

```text id="qjq4p0"
Load 100 apartments
↓
100 queries for tenants
```

Préférer une stratégie de requête adaptée.

---

# 20. Database Query Performance

Les requêtes lentes doivent pouvoir être identifiées.

Surveiller notamment :

- paiements ;
- dashboard ;
- recherche ;
- historique ;
- allocations.

---

# 21. Transactions

Une transaction doit être aussi courte que raisonnablement possible.

Éviter de conserver une transaction ouverte pendant :

- appel API externe ;
- upload long ;
- attente utilisateur.

---

# 22. Paiement et transaction database

Le système ne doit pas maintenir une transaction PostgreSQL ouverte pendant l'attente d'un fournisseur externe de paiement.

Préférer :

```text id="o8gx0z"
Create Payment Intent
↓
External Provider
↓
Provider Response / Webhook
↓
Database Transaction
```

---

# 23. Concurrence

Les opérations pouvant être exécutées simultanément doivent être protégées.

Cas importants :

- deux paiements ;
- deux modifications d'un contrat ;
- deux publications de charge ;
- génération d'échéance ;
- allocation simultanée.

---

# 24. Optimistic UI

Une interface peut afficher immédiatement certains changements non critiques.

Mais pour les opérations financières importantes, l'état final doit provenir du backend.

Exemple :

```text id="jpbe1x"
Payment clicked
↓
UI = Processing
↓
Backend confirms
↓
UI = Confirmed
```

---

# 25. Cache

## MVP-PERF-008

Le cache peut être utilisé lorsque :

- les données sont peu volatiles ;
- leur cohérence peut être maîtrisée ;
- le cache réduit réellement le coût.

---

# 26. Données financières et cache

Les données comme :

- solde ;
- paiement ;
- reste à payer ;

doivent privilégier la fraîcheur et la cohérence.

Un cache agressif ne doit pas afficher un ancien solde après confirmation d'un paiement.

---

# 27. Cache invalidation

Lorsqu'une modification rend un cache obsolète, il faut prévoir son invalidation ou son rafraîchissement.

---

# 28. Cache frontend

Le cache côté client doit être contrôlé.

Il doit notamment gérer correctement :

- changement de rôle ;
- changement d'organisation ;
- changement de logement ;
- révocation d'accès ;
- modification financière.

---

# 29. Session et cache

Une donnée accessible avant révocation ne doit pas continuer à être utilisable uniquement parce qu'elle reste dans un cache local.

Le backend reste l'autorité.

---

# 30. PWA

La PWA peut utiliser certaines stratégies de cache pour :

- assets statiques ;
- interface ;
- ressources publiques.

Les données privées ne doivent pas être mises en cache sans stratégie appropriée.

---

# 31. Offline

## MVP-PERF-009

Le MVP n'a pas besoin d'un mode offline complet pour toutes les opérations.

Il doit cependant gérer correctement une déconnexion temporaire.

---

# 32. Réseau faible

Sur réseau lent :

- afficher les états de chargement ;
- éviter les requêtes répétées ;
- prévenir les doubles actions ;
- conserver les données déjà chargées lorsque c'est sûr.

---

# 33. Double clic / double tap

Les actions pouvant déclencher une opération importante doivent être protégées contre les répétitions rapides.

Exemple :

```text id="wp2z0z"
Tap "Payer"
↓
Button disabled / Processing
```

Le backend doit également assurer l'idempotence.

---

# 34. Retry frontend

Le frontend ne doit pas réessayer automatiquement toutes les opérations importantes.

Pour les paiements :

```text id="n5xj7m"
Retry automatique
=
autorisé seulement si le cas est sûr
```

---

# 35. Timeout

Tout appel externe important doit avoir un timeout.

Une interface ne doit pas rester indéfiniment dans :

> Chargement...

sans fournir un moyen de comprendre ou de reprendre l'action.

---

# 36. Dégradation contrôlée

Lorsque le service externe est indisponible :

### Paiement

```text
Paiement en vérification
```

### Notification

```text
Événement enregistré
Notification en cours de traitement
```

### Analytics

Le produit continue normalement.

---

# 37. Jobs asynchrones

Les traitements longs doivent utiliser les jobs.

Exemples :

- rappels ;
- notifications ;
- traitement d'images ;
- exports ;
- tâches périodiques.

---

# 38. Job Queue

Le système doit pouvoir détecter :

- queue en retard ;
- jobs bloqués ;
- retries excessifs.

---

# 39. Priorité des jobs

Les jobs critiques peuvent avoir une priorité supérieure lorsque l'infrastructure le permet.

Exemple :

```text id="cxw5p8"
Payment verification
>
Analytics tracking
```

---

# 40. Retry et Backoff

Les jobs doivent utiliser lorsque pertinent :

```text id="bg6v0e"
Attempt 1
↓
Wait
↓
Attempt 2
↓
Wait longer
↓
Attempt 3
```

Les paiements nécessitent une stratégie particulière pour éviter les doubles opérations.

---

# 41. Dead Letter / Failed Jobs

Les jobs définitivement échoués doivent être identifiables.

Ils ne doivent pas disparaître silencieusement.

---

# 42. Reliability : disponibilité

Le MVP doit viser une disponibilité suffisante pour les opérations réelles.

Une cible opérationnelle initiale peut être :

```text id="1v3w5j"
99.5% monthly availability
```

Cette cible pourra être ajustée selon le niveau de trafic et l'infrastructure.

---

# 43. Maintenance

Les fenêtres de maintenance doivent être :

- rares ;
- planifiées ;
- contrôlées ;
- communiquées lorsque nécessaire.

---

# 44. Health Checks

Prévoir au minimum un mécanisme permettant de vérifier :

```text id="2qxjdd"
Application
Database
Critical dependencies
```

---

# 45. Monitoring Performance

Surveiller :

- P50 ;
- P95 ;
- taux d'erreur ;
- timeouts ;
- erreurs provider ;
- requêtes lentes.

---

# 46. Alertes performance

Déclencher des alertes en cas de dégradation significative :

```text id="edl2sh"
Latency Spike
Error Spike
Database Saturation
Job Backlog
```

Les seuils doivent être ajustés selon les données réelles.

---

# 47. Fiabilité des fournisseurs externes

Chaque fournisseur important doit disposer d'un comportement défini en cas de panne.

| Service | Impact possible | Comportement |
|---|---|---|
| Auth | Accès indisponible | Message clair, retry contrôlé |
| Payment | Paiement dégradé | Pending / verification |
| SMS | Notification retardée | Retry |
| WhatsApp | Notification retardée | Retry / autre canal si prévu |
| Email | Notification retardée | Retry |
| Storage | Upload indisponible | Error + retry |
| Analytics | Mesure perdue | Produit continue |
| Monitoring | Observabilité réduite | Produit continue |

---

# 48. Données financières

La fiabilité financière est prioritaire sur la performance.

Le système doit garantir :

- aucune perte silencieuse ;
- aucune double allocation ;
- historique ;
- cohérence du solde.

---

# 49. Transactions métier critiques

Les opérations suivantes doivent utiliser une logique transactionnelle appropriée :

```text id="8wb4a2"
Payment Allocation
Receipt creation
Charge publication
Critical permission update
```

selon les règles précises du domaine.

---

# 50. Performance des dashboards

Les dashboards doivent privilégier :

- indicateurs essentiels ;
- période raisonnable ;
- données agrégées ;
- chargement progressif.

Ne pas charger plusieurs années de données détaillées lorsque seuls quelques KPIs sont nécessaires.

---

# 51. Performance des listes

Les listes doivent :

- paginer ;
- éviter le chargement de colonnes inutiles ;
- charger les détails à la demande.

---

# 52. Performance des détails

Une fiche détaillée ne doit pas automatiquement charger tous les historiques liés si l'utilisateur ne les consulte pas.

Exemple :

```text id="qgh6py"
Tenant Detail
↓
Basic data
↓
Contracts tab
↓
Payments tab
↓
Incidents tab
```

---

# 53. Performance de la recherche

Le système doit éviter de chercher dans toutes les tables à chaque requête sans stratégie.

La recherche doit être :

- contextualisée ;
- limitée ;
- indexée ;
- paginée.

---

# 54. Performance des uploads

Les fichiers volumineux doivent être envoyés de manière à éviter de bloquer inutilement l'application.

Lorsque pertinent :

```text id="5zsd65"
Client
↓
Signed Upload
↓
Object Storage
```

plutôt que :

```text id="odli6y"
Client
↓
Application Server
↓
Storage
```

pour des fichiers importants.

---

# 55. Performance des notifications

Les envois de :

- SMS ;
- WhatsApp ;
- email ;

doivent être asynchrones lorsque l'utilisateur n'a pas besoin d'une réponse immédiate.

---

# 56. Performance des analytics

Le tracking analytics ne doit pas ralentir un parcours utilisateur critique.

---

# 57. Performance des logs

Les logs doivent rester suffisamment légers pour ne pas devenir eux-mêmes une source de dégradation.

---

# 58. Limites du MVP

Définir des limites raisonnables pour éviter les abus.

Exemples :

- taille fichier ;
- taille page ;
- nombre d'upload ;
- fréquence d'envoi ;
- fréquence de recherche ;
- taille payload API.

---

# 59. Protection contre les charges accidentelles

Un utilisateur ou un script ne doit pas pouvoir générer par erreur une quantité illimitée de :

- notifications ;
- invitations ;
- jobs ;
- exports ;
- requêtes.

---

# 60. Performance sous charge

Le MVP n'exige pas une architecture distribuée, mais il doit être possible de tester :

- nombre d'utilisateurs simultanés ;
- requêtes simultanées ;
- création simultanée de paiements ;
- jobs simultanés.

---

# 61. Tests de charge minimaux

Tester les endpoints et parcours critiques avec une charge réaliste par rapport au pilote.

L'objectif est de détecter :

- goulots d'étranglement ;
- erreurs ;
- saturation ;
- problèmes de concurrence.

---

# 62. Test de récupération

Simuler :

```text id="w0y3vs"
Application restart
Database connection interruption
Provider timeout
Job failure
```

et vérifier le comportement.

---

# 63. Restart Safety

Après redémarrage :

- les données persistées doivent rester intactes ;
- les opérations idempotentes ne doivent pas être dupliquées ;
- les jobs doivent pouvoir reprendre selon leur état.

---

# 64. Data Durability

La base de données et le stockage doivent utiliser des solutions disposant d'une persistance adaptée au niveau de criticité du produit.

---

# 65. Future Evolutions

## FUT-PERF-001 : Autoscaling

Mettre en place une capacité d'adaptation automatique lorsque le trafic le justifie.

---

## FUT-PERF-002 : CDN avancé

Optimiser davantage :

- assets ;
- images ;
- contenu distribué.

---

## FUT-PERF-003 : Cache distribué

Ajouter éventuellement Redis ou une solution équivalente lorsque le besoin est réel.

---

## FUT-PERF-004 : Read Replicas

Utiliser des réplicas de lecture lorsque la base principale devient un goulot d'étranglement.

---

## FUT-PERF-005 : Queue infrastructure avancée

Introduire une infrastructure de jobs plus importante lorsque le volume augmente fortement.

---

## FUT-PERF-006 : Multi-region

Déployer sur plusieurs régions selon les besoins de disponibilité.

---

## FUT-PERF-007 : Advanced Load Testing

Mettre en place des tests de charge réguliers et automatisés.

---

# 66. Architecture Constraints Related to Future Evolutions

## ARCH-PERF-001 : Statlessness applicatif

L'application web doit éviter autant que possible de dépendre de l'état local d'un seul serveur.

---

## ARCH-PERF-002 : Externalized storage

Les fichiers ne doivent pas dépendre du filesystem local du serveur applicatif.

---

## ARCH-PERF-003 : Async-friendly architecture

Les traitements longs doivent pouvoir migrer vers des workers indépendants si nécessaire.

---

## ARCH-PERF-004 : Pagination dès le départ

Ne pas construire les interfaces importantes autour du principe :

```text id="4q0a2o"
SELECT everything
```

---

## ARCH-PERF-005 : Provider isolation

La latence d'un fournisseur externe ne doit pas bloquer inutilement l'ensemble de l'application.

---

## ARCH-PERF-006 : Database-aware design

Les nouvelles fonctionnalités doivent considérer :

- indexes ;
- cardinalité ;
- pagination ;
- volume futur.

---

## ARCH-PERF-007 : Observability

Les métriques de performance doivent être mesurables sans refonte majeure.

---

# 67. Out of Scope

## OUT-PERF-001

Kubernetes pour le seul objectif de performance.

---

## OUT-PERF-002

Microservices pour résoudre un problème de performance non démontré.

---

## OUT-PERF-003

Redis obligatoire au lancement.

---

## OUT-PERF-004

Multi-région au MVP.

---

## OUT-PERF-005

Optimisation extrême avant observation du trafic réel.

---

## OUT-PERF-006

Tests de charge à une échelle très supérieure au besoin réel du MVP.

---

# 68. Definition of Done Performance

Une fonctionnalité importante est considérée comme suffisamment performante lorsque :

```text id="g10n8j"
[ ] Temps de réponse mesuré
[ ] Requêtes critiques vérifiées
[ ] Pas de N+1 majeur
[ ] Pagination si nécessaire
[ ] Images optimisées
[ ] Mobile testé
[ ] Error states
[ ] Loading states
[ ] Timeout externe
[ ] Retry défini si nécessaire
```

---

# 69. Definition of Done Reliability

Une fonctionnalité critique est considérée comme suffisamment fiable lorsque :

```text id="ljxnt0"
[ ] Failure case défini
[ ] Retry défini si nécessaire
[ ] Idempotence vérifiée
[ ] Concurrence considérée
[ ] Monitoring
[ ] Logs
[ ] Recovery possible
[ ] Tests
```

---

# 70. Checklist avant production

```text id="u8zvgn"
## Performance
[ ] Mobile test
[ ] API latency
[ ] DB queries
[ ] Pagination
[ ] Images
[ ] Bundle

## Reliability
[ ] Timeouts
[ ] Retry
[ ] Idempotence
[ ] Concurrency
[ ] Failure states

## Infrastructure
[ ] Health checks
[ ] Monitoring
[ ] Alerts
[ ] Backups

## Finance
[ ] Payment integrity
[ ] Allocation integrity
[ ] No duplicate payment

## Mobile
[ ] Slow network
[ ] Double tap
[ ] Offline transition
[ ] Reconnection
```

---

# 71. Principe final

La performance du produit doit être pensée comme une expérience complète :

```text id="9j7sy2"
Fast enough
+
Predictable
+
Resilient
+
Observable
```

La fiabilité signifie qu'un problème externe ou technique ne doit pas transformer une situation récupérable en perte de données.

Le principe directeur est :

> **Un système performant n'est pas seulement rapide : il reste rapide, cohérent et compréhensible lorsque le réseau, les fournisseurs ou les utilisateurs ne se comportent pas comme prévu.**