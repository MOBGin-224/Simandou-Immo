# Deployment & DevOps Specification

## 1. Objet du document

Ce document définit l'architecture et les procédures nécessaires pour développer, tester, déployer, superviser et maintenir le SaaS de gestion d'immeubles.

Il couvre :

- les environnements ;
- l'infrastructure ;
- le CI/CD ;
- les déploiements ;
- la gestion des variables et secrets ;
- les migrations ;
- les sauvegardes ;
- la restauration ;
- les logs ;
- le monitoring ;
- les alertes ;
- les rollbacks ;
- la gestion des incidents ;
- la sécurité opérationnelle ;
- les règles de production.

L'objectif est de disposer d'une infrastructure suffisamment robuste pour le MVP sans introduire prématurément une complexité inutile.

---

# 2. Principes fondamentaux

## DEVOPS-001 : Simplicité opérationnelle

L'infrastructure du MVP doit rester simple à comprendre, déployer et maintenir.

Éviter sans nécessité :

- Kubernetes ;
- microservices ;
- infrastructure distribuée complexe ;
- systèmes de déploiement multiples ;
- services externes non indispensables.

---

## DEVOPS-002 : Production séparée

La production doit être isolée du développement et du staging.

Aucune action courante de développement ne doit pouvoir modifier directement les données de production.

---

## DEVOPS-003 : Infrastructure reproductible

La configuration critique doit être documentée et, lorsque possible, versionnée.

Le système ne doit pas dépendre d'une configuration manuelle inconnue présente uniquement sur une machine.

---

## DEVOPS-004 : Déploiement contrôlé

Un changement doit suivre :

```text id="6a0v8a"
Code
↓
Review
↓
CI
↓
Staging
↓
Validation
↓
Production
```

---

## DEVOPS-005 : Production observable

Une fonctionnalité critique ne doit pas être mise en production sans possibilité raisonnable de détecter :

- les erreurs ;
- les dégradations ;
- les échecs de jobs ;
- les anomalies de paiement ;
- les problèmes de performance.

---

# 3. Architecture d'infrastructure du MVP

> **Infrastructure validée : DEC-007.**

Architecture cible :

```text id="i3n7v0"
Utilisateur
    ↓
Internet
    ↓
Vercel Edge / CDN
    ↓
Next.js / Application  (Vercel)
    ├── PostgreSQL          Docker en local, Supabase ailleurs
    ├── Object Storage      DEC-033 OUVERTE
    ├── Jobs                Cron plateforme + routes internes
    ├── Auth                Better Auth, tables dans notre PostgreSQL
    ├── Payment Provider    DEC-034 OUVERTE
    ├── WhatsApp / SMS      adapters inertes au MVP
    └── Email               adapter inerte au MVP
```

## Décisions verrouillées

| Élément | Choix |
|---|---|
| Hébergement applicatif | **Vercel** |
| Base de données local | **PostgreSQL via Docker** |
| Base de données dev / staging / prod | **Supabase PostgreSQL** |
| ORM | **Drizzle** |
| Authentification | **Better Auth** avec adaptateur Drizzle (DEC-032) |

## Contrainte de portabilité

Supabase est utilisé comme **fournisseur PostgreSQL managé**, pas comme framework applicatif.

En conséquence :

- l'accès aux données passe **exclusivement** par Drizzle ;
- l'authentification repose sur **Better Auth**, pas sur Supabase Auth ;
- l'autorisation est implémentée dans le **service applicatif**, jamais via des politiques RLS Supabase ;
- aucune fonctionnalité métier ne dépend d'une capacité propre à Supabase ;
- la chaîne de connexion est la seule surface d'adhérence au fournisseur.

Cette contrainte permet de changer d'hébergeur PostgreSQL sans réécrire l'application.

## Intégrations non implémentées au MVP

Règle applicable, DEC-008 :

> **Fournisseur non sélectionné, abstraction définie, intégration réelle ultérieure.**

Ne sont **pas implémentés** au MVP : WhatsApp Business API, SMS, paiements réels, monitoring externe, analytics externe, domaine personnalisé, VPS, Kubernetes.

**Aucun fournisseur n'est écarté.** « Non implémenté » signifie que la capacité n'est pas branchée maintenant, pas que le fournisseur a été rejeté.

Pour le stockage objet, **Cloudflare R2 et les solutions compatibles S3 restent des candidats valides** (DEC-033).

---

# 4. MVP : Environnements

> **DEC-007.**

| Environnement | Base de données | Application |
|---|---|---|
| Local | PostgreSQL via Docker | Next.js local |
| Development | Supabase PostgreSQL | Vercel |
| Staging | Supabase PostgreSQL | Vercel |
| Production | Supabase PostgreSQL | Vercel |

```text id="qlh1kc"
Local
↓
Development
↓
Staging
↓
Production
```

Chaque environnement dispose de son **propre projet Supabase** et de ses propres secrets.

Une clé de production n'est jamais utilisée ailleurs.

Development ne doit jamais être confondu avec Staging : Staging reproduit la configuration de Production.

---

# 5. MVP : Environnement local

L'environnement local sert au développement quotidien.

La base PostgreSQL locale est fournie par **Docker** (DEC-007).

Il doit permettre :

- démarrage rapide, y compris de la base ;
- migrations ;
- seed, incluant une **seconde organisation** pour les tests d'isolation ;
- tests sur une base isolée ;
- exécution manuelle des jobs ;
- développement frontend.

Les secrets de production ne doivent jamais être utilisés localement.

Le développement local ne doit jamais pointer vers la base de production ni de staging.

---

# 6. MVP : Environnement Development

L'environnement Development partagé, lorsqu'il est utilisé, sert à :

- intégrer plusieurs branches ;
- tester des fonctionnalités en cours ;
- vérifier les intégrations ;
- reproduire certains problèmes.

Les données doivent être synthétiques.

---

# 7. MVP : Environnement Staging

Staging doit être aussi proche que possible de Production concernant :

- version Node ;
- framework ;
- base de données ;
- stockage ;
- variables structurelles ;
- jobs ;
- configuration réseau ;
- observabilité.

Les clés et ressources restent cependant distinctes.

---

# 8. MVP : Environnement Production

Production contient :

- application réelle ;
- base réelle ;
- stockage réel ;
- jobs réels ;
- intégrations réelles ;
- données utilisateurs.

L'accès doit être strictement limité.

---

# 9. MVP : Variables d'environnement

Les variables doivent être séparées par environnement.

Exemple :

## Variables actives au MVP

```text id="wivfsl"
DATABASE_URL            PostgreSQL (Docker en local, Supabase ailleurs)
APP_URL                 URL de base de l'application
INTERNAL_JOB_SECRET     protection des routes /internal/*
BETTER_AUTH_SECRET      signature des sessions (DEC-032)
BETTER_AUTH_URL         URL canonique utilisée par Better Auth
```

## Variables préparées mais inactives

Déclarées et validées au démarrage seulement lorsque l'intégration correspondante est activée :

```text
STORAGE_ENDPOINT        DEC-033
STORAGE_BUCKET          DEC-033
STORAGE_KEY             DEC-033
STORAGE_SECRET          DEC-033
PAYMENT_SECRET          DEC-034
PAYMENT_WEBHOOK_SECRET  DEC-034
SMS_SECRET              reporté (DEC-008)
WHATSAPP_SECRET         reporté (DEC-008)
EMAIL_SECRET            reporté (DEC-008)
```

## Variables explicitement absentes du MVP

```text
SENTRY_DSN        monitoring reporté (DEC-008)
POSTHOG_KEY       analytics reporté (DEC-008)
```

Les noms exacts des variables liées aux décisions ouvertes seront figés au moment de la décision.

La configuration obligatoire doit être **validée au démarrage** : une variable requise manquante produit une erreur explicite, jamais un comportement dégradé silencieux.

---

# 10. MVP : Gestion des secrets

Les secrets :

- ne doivent jamais être commités ;
- ne doivent pas être écrits dans le code ;
- ne doivent pas être exposés dans les logs ;
- ne doivent pas être partagés dans les tickets ;
- doivent être différents entre staging et production lorsque nécessaire.

---

# 11. MVP : Gestion Git

Le repository doit disposer au minimum de :

```text id="m7xk8n"
main
```

et de branches temporaires de travail.

Exemple :

```text id="13emw4"
feature/...
fix/...
chore/...
```

La branche principale doit être protégée.

---

# 12. MVP : Pull Requests

Une Pull Request doit :

- avoir une description ;
- identifier le changement ;
- mentionner les migrations ;
- mentionner les impacts ;
- passer les contrôles CI ;
- être revue avant fusion lorsque le workflow de l'équipe le permet.

---

# 13. MVP : Continuous Integration

Chaque Pull Request doit déclencher automatiquement les contrôles disponibles.

Pipeline minimal :

```text id="o3q2ar"
Install
↓
Lint
↓
Typecheck
↓
Unit Tests
↓
Integration Tests
↓
Build
```

Les tests E2E critiques peuvent être ajoutés selon le coût et la stabilité du pipeline.

---

# 14. MVP : Build

Le build de production doit être reproductible.

Le build doit échouer si :

- erreurs TypeScript critiques ;
- dépendances manquantes ;
- erreurs de compilation ;
- configuration obligatoire absente.

---

# 15. MVP : Déploiement Staging

Après validation CI, le déploiement staging peut être automatique.

Exemple :

```text id="rhvx3y"
Pull Request
↓
Merge
↓
CI
↓
Deploy Staging
```

Le comportement exact dépendra de la plateforme d'hébergement choisie.

---

# 16. MVP : Déploiement Production

Le déploiement production doit être contrôlé.

Workflow recommandé :

```text id="nqdtv7"
Merge main
↓
CI
↓
Build
↓
Validation release
↓
Deploy Production
↓
Smoke Tests
↓
Monitoring
```

Un déploiement automatique complet peut être utilisé si les garde-fous sont suffisants.

---

# 17. MVP : Smoke Tests

Après un déploiement, vérifier rapidement :

- application accessible ;
- authentification ;
- base de données accessible ;
- dashboard ;
- API critique ;
- stockage lorsque pertinent ;
- jobs ;
- intégrations essentielles.

---

# 18. MVP : Health Checks

L'application doit exposer des mécanismes internes permettant de déterminer si les services critiques fonctionnent.

Exemple conceptuel :

```text id="2z1npr"
GET /api/health
```

La réponse ne doit pas divulguer de secrets ni de détails internes inutiles.

---

# 19. MVP : Readiness et Liveness

Lorsque l'infrastructure le justifie, distinguer :

### Liveness

L'application est-elle en mesure de fonctionner ?

### Readiness

L'application est-elle prête à recevoir du trafic ?

Ces mécanismes peuvent rester simples au début.

---

# 20. MVP : Migrations de base de données

Toute modification du schéma doit passer par une migration versionnée.

Exemple :

```text id="rj2e8q"
Migration 001
Migration 002
Migration 003
...
```

Une modification directe manuelle en production doit être exceptionnelle et contrôlée.

---

# 21. MVP : Procédure de migration

Avant une migration de production :

1. tester en local ;
2. tester en staging ;
3. vérifier la compatibilité ;
4. sauvegarder lorsque nécessaire ;
5. appliquer la migration ;
6. vérifier les données ;
7. surveiller l'application.

---

# 22. MVP : Migrations destructives

Les migrations pouvant supprimer ou modifier irréversiblement des données doivent être particulièrement contrôlées.

Lorsque possible, privilégier :

```text id="4pbd2f"
Add
↓
Migrate data
↓
Switch usage
↓
Remove old structure later
```

plutôt qu'une destruction immédiate.

---

# 23. MVP : Seed

Le système doit disposer d'un mécanisme de seed pour les environnements non productifs.

Le seed peut créer :

- utilisateurs ;
- organisations ;
- immeubles ;
- appartements ;
- locataires ;
- contrats ;
- loyers ;
- paiements ;
- charges ;
- incidents ;
- interventions ;
- dépenses.

Les seeds de démonstration ne doivent jamais s'exécuter automatiquement en production.

---

# 24. MVP : Base de données PostgreSQL

PostgreSQL est la source de vérité des données métier.

Elle doit être configurée avec :

- stockage persistant ;
- sauvegardes ;
- accès sécurisé ;
- paramètres adaptés à l'environnement ;
- monitoring.

---

# 25. MVP : Connexions à la base

L'application doit utiliser un mécanisme de connexion adapté à l'environnement hébergé.

Éviter les ouvertures de connexions excessives.

La configuration doit tenir compte :

- du pool ;
- des limites du fournisseur ;
- de la concurrence ;
- des jobs.

---

# 26. MVP : Stockage objet

> **DEC-033 OUVERTE** : aucun fournisseur n'est sélectionné.
>
> **Cloudflare R2 et les solutions compatibles S3 restent des candidats valides.** Aucun fournisseur n'est écarté.

L'interface `StorageProvider` est définie dès le Lot 1 :

```text
upload(...)
delete(...)
createSignedUrl(...)
```

Exigences quel que soit le fournisseur retenu :

- bucket **privé**, aucune URL publique permanente ;
- accès par URL signée à durée limitée, générée après vérification des permissions ;
- validation de taille, type MIME et extension ;
- indépendance totale du filesystem local.

Le lot **Documents** ne peut pas démarrer tant que cette décision est ouverte.

---

# 27. MVP : Structure du stockage

Les fichiers doivent être organisés selon une structure cohérente.

Exemple :

```text id="8ubk0w"
organizations/
  {organizationId}/
    properties/
      {propertyId}/
        apartments/
          {apartmentId}/
            incidents/
            documents/
```

La structure exacte peut évoluer.

---

# 28. MVP : Sécurité du stockage

Le bucket privé doit :

- ne pas être publiquement accessible ;
- utiliser des credentials séparés ;
- permettre l'accès contrôlé ;
- supporter les URLs temporaires lorsque nécessaire.

---

# 29. MVP : Jobs et tâches planifiées

Les opérations asynchrones doivent utiliser un système de jobs adapté.

Cas d'usage :

- rappels ;
- notifications ;
- traitements différés ;
- génération d'échéances ;
- synchronisations ;
- tâches de maintenance.

> **DEC-028** : au MVP, les tâches planifiées utilisent les **Cron Jobs de la plateforme d'hébergement**, déclenchant des routes internes protégées.

```text
Cron plateforme
↓
POST /internal/jobs/<nom>   (secret interne obligatoire)
↓
Service de job idempotent
```

Aucun fournisseur de files d'attente externe n'est introduit au MVP.

Jobs du MVP :

```text
generateRentInstallments
sendRentReminders
markOverdueReceivables
expireInvitations
retryNotifications
```

---

# 30. MVP : Gestion des échecs des jobs

Un job doit prévoir :

- retry ;
- backoff lorsque nécessaire ;
- limite de tentatives ;
- journalisation ;
- état d'échec ;
- mécanisme de reprise.

---

# 31. MVP : Idempotence des jobs

Un même job ne doit pas produire plusieurs effets métier lorsque son exécution est répétée.

Exemple :

```text id="13cj5w"
Reminder job
↓
execution 1
↓
execution 2
```

Le système doit éviter l'envoi de deux rappels lorsqu'ils correspondent au même événement métier.

---

# 32. MVP : Monitoring

Le produit doit disposer d'un système de monitoring applicatif.

Sentry ou une solution équivalente peut couvrir notamment :

- exceptions ;
- erreurs frontend ;
- erreurs backend ;
- traces pertinentes ;
- contexte technique.

---

# 33. MVP : Error Tracking

Les erreurs critiques doivent être :

- collectées ;
- regroupées ;
- contextualisées ;
- surveillées.

Les données personnelles inutiles doivent être exclues du tracking.

---

# 34. MVP : Analytics produit

Un outil tel que PostHog peut être utilisé pour comprendre l'utilisation du produit.

Les événements doivent rester compatibles avec les règles de protection des données.

Exemples :

```text id="qkm3mz"
property_created
tenant_invited
payment_created
incident_created
```

Les événements ne doivent pas contenir inutilement des informations personnelles sensibles.

---

# 35. MVP : Logs applicatifs

Les logs doivent permettre de diagnostiquer :

- erreurs ;
- jobs ;
- intégrations ;
- migrations ;
- événements techniques.

Éviter :

- mots de passe ;
- tokens ;
- secrets ;
- données financières inutiles ;
- données personnelles inutiles.

---

# 36. MVP : Correlation ID

Lorsque possible, les requêtes et opérations importantes doivent pouvoir être corrélées par un identifiant technique.

Exemple :

```text id="r2h2n7"
requestId
```

Cela facilite l'investigation d'un incident.

---

# 37. MVP : Monitoring des paiements

Les événements critiques doivent pouvoir être observés :

```text id="o4r2v3"
Payment initiated
Payment pending
Payment confirmed
Payment failed
Webhook received
Webhook rejected
```

Les informations sensibles du fournisseur ne doivent pas être exposées inutilement.

---

# 38. MVP : Monitoring des jobs

Surveiller au minimum :

- nombre d'échecs ;
- retries ;
- jobs bloqués ;
- temps d'exécution anormal ;
- accumulation de jobs.

---

# 39. MVP : Monitoring de la base

Surveiller lorsque les outils disponibles le permettent :

- disponibilité ;
- connexions ;
- CPU ;
- mémoire ;
- stockage ;
- erreurs ;
- latence des requêtes importantes.

---

# 40. MVP : Monitoring des performances

Suivre notamment :

- temps de réponse API ;
- temps de chargement des pages ;
- erreurs frontend ;
- taille des assets ;
- temps des requêtes critiques.

---

# 41. MVP : Alertes

Les alertes doivent être réservées aux événements nécessitant une action.

Exemples :

- application indisponible ;
- augmentation importante des erreurs ;
- base indisponible ;
- job critique en échec ;
- webhook de paiement en échec répété ;
- espace disque critique ;
- erreur de déploiement.

Éviter les alertes excessives qui créent de la fatigue opérationnelle.

---

# 42. MVP : Sauvegardes PostgreSQL

Les sauvegardes doivent être :

- automatiques ;
- régulières ;
- protégées ;
- séparées des données opérationnelles ;
- testables.

La fréquence exacte sera définie selon le fournisseur et le niveau de criticité retenu.

---

# 43. MVP : Rétention des sauvegardes

Une politique de rétention doit être définie.

Exemple conceptuel :

```text id="2yk6hs"
Backups récents
+
Backups historiques
```

La politique exacte dépendra des capacités du fournisseur.

---

# 44. MVP : Test de restauration

Une sauvegarde non testée ne doit pas être considérée comme garantie de récupération.

Prévoir périodiquement :

```text id="3ikvqt"
Backup
↓
Restore
↓
Validation
```

---

# 45. MVP : Objectifs de reprise

Définir avant production :

### RPO

Quantité maximale de données pouvant être perdue après incident.

### RTO

Durée cible pour rétablir le service.

Les valeurs exactes doivent être décidées selon :

- infrastructure ;
- coût ;
- criticité ;
- niveau de service attendu.

---

# 46. MVP : Rollback applicatif

Un déploiement doit pouvoir être annulé lorsque la plateforme le permet.

Exemple :

```text id="cpqj56"
Version N
↓
Déploiement N+1
↓
Problème
↓
Rollback
↓
Version N
```

---

# 47. MVP : Rollback de base de données

Un rollback de code et un rollback de base ne sont pas nécessairement symétriques.

Il faut privilégier les migrations compatibles avec l'ancienne et la nouvelle version lorsque cela est raisonnablement possible.

Une migration destructrice ne doit jamais être considérée comme facilement réversible par défaut.

---

# 48. MVP : Stratégie de release

Les releases doivent rester petites autant que possible.

Préférer :

```text id="gwrwub"
Petit changement
↓
Test
↓
Déploiement
↓
Observation
```

plutôt qu'un gros lot de modifications difficile à diagnostiquer.

---

# 49. MVP : Feature Flags

Les feature flags peuvent être utilisés pour :

- tester une fonctionnalité ;
- limiter temporairement un accès ;
- effectuer un déploiement progressif.

Ils ne sont pas obligatoires pour chaque fonctionnalité du MVP.

---

# 50. MVP : Gestion des incidents

En cas d'incident :

```text id="0s0eqs"
Détecter
↓
Classifier
↓
Contenir
↓
Restaurer
↓
Analyser
↓
Corriger
↓
Documenter
```

---

# 51. MVP : Classification des incidents

## P0

Service indisponible ou incident de sécurité critique.

Exemples :

- fuite inter-organisation ;
- corruption financière ;
- compromission de secrets ;
- indisponibilité générale.

## P1

Fonction majeure fortement dégradée.

## P2

Problème important mais contournable.

## P3

Impact faible.

---

# 52. MVP : Procédure d'urgence

En cas d'incident critique :

1. identifier le problème ;
2. limiter l'impact ;
3. désactiver une intégration compromise si nécessaire ;
4. protéger les données ;
5. restaurer le service ;
6. analyser la cause ;
7. corriger ;
8. documenter.

---

# 53. MVP : Accès à la production

Les accès production doivent être limités.

Il faut éviter :

- comptes partagés ;
- credentials permanents non nécessaires ;
- accès administratifs généralisés ;
- secrets copiés sur des machines personnelles.

---

# 54. MVP : Comptes d'administration

Les comptes administratifs doivent être :

- nominatifs ;
- protégés ;
- limités ;
- surveillés lorsque nécessaire.

---

# 55. MVP : Accès Claude Code

Claude Code doit travailler principalement sur :

```text id="9ud2g1"
Code
Tests
Configuration non sensible
Environnements non productifs
```

L'accès direct aux ressources de production doit être strictement contrôlé.

---

# 56. MVP : Production et données réelles

Claude Code ne doit pas pouvoir modifier automatiquement les données de production comme conséquence d'une simple tâche de développement.

Toute opération sensible doit être explicitement contrôlée.

---

# 57. MVP : Dépendances

Les dépendances doivent être :

- verrouillées via le lockfile ;
- surveillées ;
- mises à jour régulièrement ;
- supprimées lorsqu'elles ne sont plus utilisées.

---

# 58. MVP : Mises à jour de sécurité

Les mises à jour de sécurité critiques doivent être traitées avec priorité.

Avant mise en production :

- vérifier compatibilité ;
- lancer les tests ;
- déployer staging ;
- observer les éventuels effets.

---

# 59. MVP : Configuration du domaine

Le déploiement de production doit utiliser le domaine officiel retenu pour le produit.

Prévoir :

- HTTPS ;
- certificats ;
- redirection HTTP vers HTTPS ;
- DNS correctement configuré.

Le domaine et les fournisseurs DNS définitifs seront configurés lors de la mise en production.

---

# 60. MVP : CDN et Edge

La plateforme d'hébergement peut fournir :

- CDN ;
- compression ;
- caching ;
- distribution des assets.

Les données privées et réponses sensibles ne doivent pas être mises en cache publiquement par défaut.

---

# 61. MVP : Cache

Toute stratégie de cache doit distinguer :

### Données publiques

Peuvent être mises en cache selon leur nature.

### Données privées

Doivent respecter la session et les permissions.

### Données financières

Doivent privilégier la cohérence sur la performance lorsqu'un conflit existe.

---

# 62. MVP : Timeouts

Les appels vers les services externes doivent disposer de timeouts raisonnables.

Services concernés :

- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage.

Une requête externe bloquée ne doit pas immobiliser indéfiniment le serveur.

---

# 63. MVP : Retries externes

Les retries ne doivent être appliqués que lorsque cela est sûr.

Pour certaines opérations financières, un retry aveugle peut provoquer des doublons.

La règle d'idempotence doit toujours être évaluée avant un retry.

---

# 64. MVP : Dépendances externes indisponibles

Le produit doit gérer proprement les pannes de fournisseurs.

Exemple :

```text id="kz8w4z"
Payment Provider indisponible
↓
Payment = PENDING
↓
Utilisateur informé
↓
Retry / vérification ultérieure
```

Le système ne doit pas transformer une indisponibilité externe en paiement confirmé.

---

# 65. MVP : Maintenance planifiée

Lorsqu'une intervention importante nécessite une indisponibilité :

- prévenir lorsque possible ;
- limiter la durée ;
- afficher une page de maintenance ;
- protéger les opérations en cours ;
- vérifier le service après intervention.

---

# 66. MVP : Documentation opérationnelle

Le repository doit contenir une documentation permettant de comprendre :

- comment lancer le projet ;
- comment lancer les tests ;
- comment créer une migration ;
- comment déployer staging ;
- comment déployer production ;
- comment restaurer ;
- comment consulter les logs ;
- comment gérer un incident.

---

# 67. MVP : Runbook

Créer un runbook minimal contenant :

```text
Déploiement
Rollback
Migration
Backup
Restore
Incident
Secrets
Logs
Jobs
Paiements
```

---

# 68. MVP : Checklist de déploiement

Avant production :

```text id="j1c4k5"
[ ] CI verte
[ ] Tests critiques verts
[ ] Build valide
[ ] Migration testée
[ ] Backup vérifié
[ ] Variables d'environnement vérifiées
[ ] Secrets vérifiés
[ ] Monitoring actif
[ ] Alertes configurées
[ ] Smoke tests préparés
[ ] Rollback identifié
```

---

# 69. MVP : Checklist post-déploiement

Après production :

```text id="p9v5dg"
[ ] Application accessible
[ ] Connexion OK
[ ] Dashboard OK
[ ] API critiques OK
[ ] Database OK
[ ] Jobs OK
[ ] Paiements surveillés
[ ] Logs OK
[ ] Erreurs normales
[ ] Smoke tests OK
```

---

# 70. Future Evolutions

Les éléments suivants pourront être introduits après validation du MVP.

## FUT-DEVOPS-001 : Infrastructure as Code complète

Introduire Terraform ou une solution équivalente pour gérer de manière déclarative une infrastructure plus importante.

---

## FUT-DEVOPS-002 : Environnements éphémères

Créer automatiquement un environnement de test par Pull Request.

Exemple :

```text id="fq4j9j"
PR #128
↓
Preview Environment
```

---

## FUT-DEVOPS-003 : Déploiement canary

Déployer une version à une fraction du trafic avant généralisation.

---

## FUT-DEVOPS-004 : Blue/Green Deployment

Utiliser deux environnements de production afin de réduire certains risques de déploiement.

---

## FUT-DEVOPS-005 : Autoscaling avancé

Mettre en place une montée en capacité automatique selon :

- trafic ;
- CPU ;
- mémoire ;
- files de jobs ;
- requêtes.

---

## FUT-DEVOPS-006 : Observabilité avancée

Ajouter :

- OpenTelemetry ;
- distributed tracing ;
- dashboards avancés ;
- corrélation multi-services.

---

## FUT-DEVOPS-007 : Disaster Recovery multi-région

Prévoir plusieurs régions ou fournisseurs pour les niveaux de résilience supérieurs.

---

## FUT-DEVOPS-008 : Infrastructure multi-pays

Lorsque le produit évoluera sur plusieurs marchés, l'infrastructure pourra être adaptée pour :

- localisation ;
- conformité ;
- résilience régionale ;
- fournisseurs locaux.

---

# 71. Architecture Constraints Related to Future Evolutions

## ARCH-DEVOPS-001 : Ne pas coupler le produit à une seule plateforme

Même si le MVP utilise une plateforme simple comme Vercel, l'application doit éviter autant que raisonnablement possible de dépendre de mécanismes propriétaires pour sa logique métier centrale.

---

## ARCH-DEVOPS-002 : Services externes interchangeables

Les fournisseurs doivent être encapsulés derrière des interfaces ou adapters.

Cela concerne notamment :

```text
PaymentProvider
NotificationProvider
StorageProvider
EmailProvider
```

---

## ARCH-DEVOPS-003 : Configuration par environnement

Le code doit utiliser des paramètres d'environnement plutôt que des valeurs spécifiques à une plateforme.

---

## ARCH-DEVOPS-004 : Jobs indépendants de l'interface

Les tâches programmées doivent rester indépendantes du cycle de rendu frontend.

---

## ARCH-DEVOPS-005 : Logs structurés

Les logs doivent être structurés de manière à permettre plus tard une centralisation et une analyse avancée.

---

## ARCH-DEVOPS-006 : Monitoring évolutif

Le système de monitoring doit pouvoir évoluer sans réécrire l'application.

---

# 72. Out of Scope

## OUT-DEVOPS-001 : Kubernetes

Pas requis pour le MVP.

---

## OUT-DEVOPS-002 : Service Mesh

Pas requis.

---

## OUT-DEVOPS-003 : Microservices distribués

Pas requis.

---

## OUT-DEVOPS-004 : Multi-région obligatoire

Pas requis au lancement.

---

## OUT-DEVOPS-005 : Infrastructure militaire ou hypersécurisée

Le MVP n'a pas besoin d'une infrastructure disproportionnée par rapport à son niveau de trafic et de risque.

---

## OUT-DEVOPS-006 : Pipeline CI/CD extrêmement complexe

Le pipeline doit rester simple tant que le produit reste sur une architecture modulaire monolithique.

---

# 73. Definition of Done DevOps

L'infrastructure MVP est considérée comme prête lorsque :

### Environnements

- Local fonctionnel ;
- Staging fonctionnel ;
- Production fonctionnelle.

### Déploiement

- CI fonctionnelle ;
- déploiement contrôlé ;
- migrations versionnées ;
- rollback identifié.

### Sécurité

- secrets protégés ;
- accès production limités ;
- HTTPS actif ;
- stockage privé.

### Données

- backups actifs ;
- restauration testée ;
- migrations contrôlées.

### Monitoring

- erreurs collectées ;
- logs accessibles ;
- alertes critiques configurées.

### Opérations

- runbook disponible ;
- procédure incident disponible ;
- documentation de déploiement disponible.

---

# 74. Architecture cible simplifiée

Le MVP doit tendre vers :

```text id="vbcb2o"
                    INTERNET
                       │
                       ▼
                 CDN / EDGE
                       │
                       ▼
              ┌────────────────┐
              │   Next.js App  │
              │                │
              │ Presentation   │
              │ Application    │
              │ Domain         │
              │ Infrastructure │
              └───────┬────────┘
                      │
          ┌───────────┼────────────┐
          │           │            │
          ▼           ▼            ▼
      PostgreSQL   Object Store   Jobs
          │           │            │
          └───────────┼────────────┘
                      │
             ┌────────┼─────────┐
             ▼        ▼         ▼
          Payment   Messaging   Email
          Provider  Providers   Provider
```

---

# 75. Principe final

L'infrastructure du produit doit évoluer avec le produit.

Le MVP ne doit ni :

- négliger les fondamentaux opérationnels ;
- ni être surdimensionné inutilement.

La priorité est :

```text
Fiable
↓
Sécurisé
↓
Observable
↓
Reproductible
↓
Évolutif
```

Le principe directeur est :

> **Déployer simplement aujourd'hui, sans empêcher de devenir robuste demain.**