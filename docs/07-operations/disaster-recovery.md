# Disaster Recovery & Business Continuity Specification

## 1. Objet du document

Ce document définit les mesures nécessaires pour maintenir ou restaurer le service après un incident majeur.

Il couvre :

- perte de base de données ;
- corruption de données ;
- panne d'infrastructure ;
- indisponibilité d'un fournisseur ;
- compromission de credentials ;
- erreur de déploiement ;
- suppression accidentelle ;
- incident de sécurité ;
- panne prolongée ;
- restauration ;
- reprise d'activité.

L'objectif est de garantir que le produit puisse revenir à un état opérationnel sans improvisation lors d'un incident grave.

---

# 2. Principes fondamentaux

## DR-001 : La récupération doit être préparée avant l'incident

Une sauvegarde ne suffit pas.

Il faut également savoir :

```text id="x4j7qk"
Quoi restaurer
↓
Depuis quelle source
↓
Comment restaurer
↓
Dans quel ordre
↓
Comment vérifier
```

---

## DR-002 : La base de données est critique

La base PostgreSQL contient les principales données métier :

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
- dépenses ;
- historique.

Elle doit donc disposer des protections les plus importantes.

---

## DR-003 : Les fichiers privés sont également critiques

Les documents et photos ne doivent pas être considérés comme secondaires.

La stratégie de récupération doit couvrir :

- base de données ;
- stockage objet ;
- configurations nécessaires ;
- secrets lorsque leur récupération est possible et appropriée.

---

## DR-004 : Prioriser l'intégrité

En cas d'incident :

```text id="7zq4jw"
Intégrité des données
>
Rapidité de retour
```

Un système restauré rapidement mais avec des paiements incohérents n'est pas considéré comme correctement récupéré.

---

# 3. Définitions

## RPO

**Recovery Point Objective**

Quantité maximale de données pouvant être perdue après un incident.

Exemple :

```text id="c0y4xz"
RPO = 24h
```

signifie qu'en théorie jusqu'à 24 heures de données pourraient être perdues.

---

## RTO

**Recovery Time Objective**

Durée cible pour restaurer le service.

Exemple :

```text id="x1v6sz"
RTO = 8h
```

signifie que le service doit viser un retour dans les huit heures.

Les valeurs exactes doivent être validées selon l'infrastructure retenue.

---

# 4. MVP

## MVP-DR-001 : Backup PostgreSQL

La base de données doit disposer de sauvegardes automatiques.

---

## MVP-DR-002 : Rétention

Définir une politique de conservation des sauvegardes.

La politique doit distinguer autant que possible :

```text id="c7h8h3"
Backups récents
+
Backups historiques
```

---

## MVP-DR-003 : Isolation des backups

Les sauvegardes doivent être stockées dans un environnement suffisamment séparé de la base principale.

Une suppression accidentelle de la base ne doit pas automatiquement supprimer toutes les sauvegardes disponibles.

---

# 5. Test de restauration

## MVP-DR-004

Une restauration réelle doit être testée périodiquement dans un environnement contrôlé.

Flux :

```text id="t4g0bq"
Backup
↓
Restore
↓
Database available
↓
Application connected
↓
Integrity checks
```

---

# 6. Critères de validation d'une restauration

Une restauration n'est pas terminée simplement parce que PostgreSQL démarre.

Vérifier notamment :

```text id="h8v6dr"
Organizations
Users
User Access
Properties
Apartments
Tenants
Leases
Rent Installments        créances de loyer
Charges
Charge Allocations       créances de charge
Payments
Payment Allocations
Receipts
Incidents
Interventions
Expenses
Documents
Audit
```

---

# 7. Tests d'intégrité après restore

Vérifier :

```text id="4qylpa"
Payment
↔
Payment Allocation

Payment Allocation
↔
Rent Installment      (exclusif)

Payment Allocation
↔
Charge Allocation     (exclusif)

Lease
↔
Apartment

Tenant
↔
Lease

Charge
↔
Charge Allocation

Receipt
↔
Payment
```

Les relations importantes doivent rester cohérentes.

## Contrôles de soldes obligatoires

> **DEC-005 / DEC-022** : le modèle financier comporte **deux types de créance**. Une restauration qui ne vérifie que les loyers est incomplète.

Pour **chaque** créance, de loyer comme de charge :

```text
amount_paid  =  somme des allocations rattachées
                à des paiements CONFIRMED

balance      =  amount_due - amount_paid

balance      >=  0
```

Et pour chaque charge publiée :

```text
somme(charge_allocations.amount_due)  =  charges.total_amount
```

Toute divergence doit bloquer la déclaration de fin de récupération et déclencher une analyse avant remise en service.

## Contrainte d'exclusion

Vérifier qu'aucune ligne de `payment_allocations` ne porte simultanément `rent_installment_id` et `charge_allocation_id`, ni aucun des deux.

---

# 8. MVP-DR-005 : Object Storage Backup

Les documents critiques doivent bénéficier d'une stratégie de récupération adaptée au fournisseur choisi.

---

# 9. Fichiers prioritaires

Les catégories suivantes sont prioritaires :

- contrats ;
- justificatifs ;
- photos d'incidents ;
- documents financiers ;
- documents métier importants.

---

# 10. Configuration de récupération

La récupération doit pouvoir reconstruire :

```text id="b43x6t"
Application
+
Database
+
Storage
+
Jobs
+
External Integrations
```

---

# 11. Infrastructure Recovery

L'infrastructure applicative doit être suffisamment reproductible pour permettre de redéployer l'application après une perte d'environnement.

---

# 12. Code Repository

Le repository Git constitue une partie essentielle de la stratégie de récupération.

Il doit contenir :

- code ;
- migrations ;
- configuration non sensible ;
- scripts ;
- documentation ;
- runbooks.

---

# 13. Secrets

Les secrets ne doivent pas être commités.

La procédure de récupération doit indiquer où retrouver ou recréer :

- secrets d'authentification ;
- credentials de stockage ;
- credentials de paiement ;
- credentials messaging ;
- credentials email ;
- monitoring.

---

# 14. Secrets compromis

En cas de compromission :

```text id="ceoyp7"
Revoke
↓
Rotate
↓
Deploy new credentials
↓
Verify
```

---

# 15. Compromission d'une clé de paiement

Si une clé ou credential de paiement est compromis :

1. révoquer ;
2. générer un nouveau credential ;
3. mettre à jour l'environnement ;
4. vérifier les webhooks ;
5. surveiller les transactions ;
6. documenter l'incident.

---

# 16. Compromission d'un compte administrateur

En cas de compromission :

- révoquer les sessions ;
- désactiver l'accès ;
- changer les credentials nécessaires ;
- examiner les logs ;
- vérifier les opérations sensibles ;
- évaluer les données accessibles.

---

# 17. Rollback applicatif

Après un déploiement défectueux :

```text id="h5t0m6"
Detect
↓
Classify
↓
Rollback
↓
Smoke Test
↓
Monitor
```

---

# 18. Rollback et données

Un rollback du code ne signifie pas automatiquement qu'une migration de base peut être annulée.

Les migrations doivent donc être conçues pour limiter les situations où :

```text id="f2m8x0"
Version N+1
↓
Schema incompatible
↓
Rollback impossible
```

---

# 19. Stratégie de migration sûre

Lorsque possible :

```text id="cb5v0b"
Add New Structure
↓
Deploy Compatible Code
↓
Migrate Data
↓
Switch Usage
↓
Remove Old Structure Later
```

---

# 20. Corruption de données

Si des données semblent corrompues :

1. arrêter les opérations pouvant aggraver le problème lorsque nécessaire ;
2. identifier la période concernée ;
3. déterminer la source ;
4. préserver les preuves et logs ;
5. restaurer ou corriger ;
6. vérifier l'intégrité ;
7. reprendre les opérations.

---

# 21. Correction plutôt que restauration complète

Lorsque seule une partie des données est affectée, une restauration complète n'est pas toujours préférable.

Possibilités :

```text id="2hzzd5"
Restore backup
+
Extract affected data
+
Controlled repair
```

ou :

```text id="hbt7wq"
Targeted Data Repair
```

selon le cas.

---

# 22. Data Repair

Les corrections de données importantes doivent utiliser :

- script contrôlé ;
- transaction ;
- logs ;
- audit ;
- validation.

Éviter les modifications manuelles non documentées dans la base.

---

# 23. Incident de suppression accidentelle

Exemple :

```text id="i7o9di"
Manager
↓
Erreur
↓
Données supprimées / archivées
```

Le système doit permettre autant que possible de :

- identifier ;
- restaurer ;
- corriger ;
- auditer.

---

# 24. Suppression logique

Le modèle métier doit privilégier lorsque possible :

```text id="4hw6e9"
Archive
Deactivate
Revoke
End
```

plutôt qu'une suppression physique immédiate.

Cela réduit le risque de perte irréversible.

---

# 25. Panne de fournisseur de paiement

Si le fournisseur de paiement est indisponible :

```text id="4y2j75"
Digital Payment
= Degraded
```

mais :

```text id="u2m1sb"
Product Core
= Available
```

lorsque c'est possible.

Le paiement manuel peut continuer si cette capacité est disponible.

---

# 26. Panne SMS

Si le SMS est indisponible :

- l'événement métier ne doit pas être annulé ;
- la notification peut rester en attente ;
- retry selon la politique.

---

# 27. Panne WhatsApp

Même principe :

```text id="5aegkr"
Business Event
=
Success

WhatsApp Delivery
=
Failed / Pending
```

---

# 28. Panne Email

Les emails peuvent être mis en attente ou retentés.

L'indisponibilité du provider email ne doit pas empêcher une opération métier sans rapport.

---

# 29. Panne Storage

Si le stockage est indisponible :

- les uploads échouent proprement ;
- l'utilisateur est informé ;
- les ressources métier ne doivent pas afficher un document qui n'existe pas ;
- retry contrôlé si approprié.

---

# 30. Panne Analytics

L'analytics n'est pas critique pour le fonctionnement métier.

```text id="zgwy8z"
Analytics down
↓
Product continues
```

---

# 31. Panne Monitoring

La panne du monitoring réduit la visibilité mais ne doit pas interrompre le produit.

Des mécanismes d'observation secondaires peuvent être nécessaires.

---

# 32. Panne de base de données

C'est un incident critique.

Le comportement doit éviter :

- écritures incohérentes ;
- confirmations fictives ;
- corruption ;
- opérations partiellement exécutées.

---

# 33. Database Failover

Le MVP ne nécessite pas obligatoirement une architecture de haute disponibilité complexe.

Toutefois, le fournisseur PostgreSQL retenu doit offrir un mécanisme raisonnable de récupération ou de restauration.

---

# 34. Perte complète de l'environnement applicatif

Le plan de récupération doit permettre :

```text id="3w9hqc"
New Environment
↓
Deploy Application
↓
Configure Secrets
↓
Connect Database
↓
Connect Storage
↓
Run Migrations
↓
Start Jobs
↓
Smoke Tests
```

---

# 35. Recovery Order

Ordre recommandé :

```text id="2r7xlf"
1. Infrastructure
2. Database
3. Storage
4. Secrets / configuration
5. Application
6. Jobs
7. External Integrations
8. Monitoring
9. Smoke Tests
```

L'ordre exact peut être ajusté selon l'infrastructure réelle.

---

# 36. Recovery Validation

Avant de déclarer la récupération terminée :

```text id="h5f5yn"
[ ] Login
[ ] Organization
[ ] Property
[ ] Tenant
[ ] Lease
[ ] Rent
[ ] Payment
[ ] Receipt
[ ] Charge
[ ] Incident
[ ] Document
[ ] Notifications
```

---

# 37. Recovery des jobs

Après restauration, les jobs doivent être évalués.

Attention aux jobs déjà exécutés avant l'incident.

Éviter de générer :

- deux rappels ;
- deux notifications ;
- deux échéances ;
- deux allocations.

---

# 38. Recovery des paiements

Une restauration de base doit être corrélée avec les références externes de paiement.

Exemple :

```text id="0v7hyb"
Provider Transaction
↓
Internal Payment
```

Les deux doivent pouvoir être réconciliés.

---

# 39. Payment Reconciliation after Disaster

Après un incident affectant les paiements :

1. récupérer les transactions provider pertinentes ;
2. identifier les paiements internes correspondants ;
3. détecter les écarts ;
4. corriger de manière contrôlée ;
5. auditer les corrections.

---

# 40. Recovery des notifications

Après reprise, éviter que tous les événements historiques déclenchent automatiquement de nouvelles notifications.

Les jobs de notification doivent pouvoir distinguer :

```text id="h1o5zu"
Pending
Already Sent
Already Delivered
Cancelled
```

---

# 41. Recovery des invitations

Les invitations doivent rester valides ou être invalidées selon leur contexte.

Une restauration ne doit pas permettre de réutiliser involontairement un token déjà consommé.

---

# 42. Recovery des sessions

Après un incident de sécurité ou une restauration importante, il peut être nécessaire d'invalider certaines sessions.

La stratégie dépend du niveau d'incident.

---

# 43. Recovery après incident de sécurité

Pour un incident impliquant une compromission :

```text id="9dfj5c"
Contain
↓
Revoke
↓
Rotate
↓
Restore / Repair
↓
Validate
↓
Monitor
```

La restauration d'un état vulnérable ne doit pas être considérée comme suffisante.

---

# 44. Disaster Severity

## P0 : Catastrophique

Exemples :

- perte complète de base ;
- corruption majeure ;
- compromission importante ;
- indisponibilité généralisée.

---

## P1 : Critique

Exemples :

- service fortement dégradé ;
- paiement indisponible ;
- panne majeure d'infrastructure.

---

## P2 : Significatif

Exemples :

- fonctionnalité importante indisponible ;
- fournisseur secondaire en panne.

---

## P3 : Mineur

Impact limité.

---

# 45. Incident Commander

Pour les incidents importants, une personne doit être désignée pour coordonner.

Responsabilités :

- décider ;
- prioriser ;
- communiquer ;
- documenter ;
- coordonner la récupération.

Le rôle peut être exercé par une personne différente selon l'organisation future.

---

# 46. Communication interne

Pendant un P0 ou P1 :

```text id="d5i3vy"
What
Impact
Action
Owner
Next Check
```

doivent être connus de l'équipe.

---

# 47. Communication utilisateur

Lorsqu'un incident affecte fortement le service :

- informer ;
- expliquer simplement ;
- éviter les détails sensibles ;
- ne pas annoncer une résolution avant vérification.

---

# 48. Post-Incident Review

Après récupération :

```text id="4pk4ks"
What happened?
↓
Root Cause
↓
Impact
↓
How detected?
↓
How recovered?
↓
How prevent recurrence?
```

---

# 49. Recovery Drill

## MVP-DR-006

Réaliser périodiquement au moins un exercice contrôlé de récupération.

Exemple :

```text id="j9j0a6"
Backup PostgreSQL
↓
Restore Staging
↓
Application
↓
Validation
```

Le but est de vérifier que la documentation fonctionne réellement.

---

# 50. Recovery Documentation

Le runbook doit contenir :

- contacts ;
- accès nécessaires ;
- ordre de restauration ;
- commandes ou étapes ;
- vérifications ;
- rollback ;
- critères de succès.

Aucun secret ne doit être stocké directement dans le runbook.

---

# 51. RTO / RPO du MVP

Des cibles initiales peuvent être définies, puis réévaluées après observation.

Exemple :

```text id="2f0q1j"
RPO cible : ≤ 24 heures
RTO cible : ≤ 8 heures
```

Ces valeurs sont des objectifs opérationnels initiaux, pas des garanties contractuelles.

---

# 52. Critical Data Priority

En récupération, prioriser :

## Niveau 1

- organisations ;
- users ;
- properties ;
- apartments ;
- leases ;
- rents ;
- payments.

## Niveau 2

- receipts ;
- charges ;
- incidents ;
- interventions ;
- expenses.

## Niveau 3

- analytics ;
- données temporaires ;
- caches.

---

# 53. Cache Recovery

Les caches ne doivent pas être considérés comme des données à restaurer.

Ils doivent pouvoir être reconstruits.

---

# 54. Analytics Recovery

Une perte limitée de données analytics peut être acceptable si les données métier restent intactes.

---

# 55. Monitoring Recovery

Le monitoring doit être reconnecté rapidement après restauration afin de vérifier la santé du service.

---

# 56. Cost Awareness

La stratégie DR doit tenir compte :

- coût des backups ;
- stockage ;
- fréquence ;
- rétention ;
- niveau de disponibilité.

Le MVP ne doit pas financer une stratégie de reprise disproportionnée par rapport au niveau d'activité réel.

---

# 57. Future Evolutions

## FUT-DR-001 : Point-in-Time Recovery avancée

Mettre en place une restauration à un instant précis lorsque l'infrastructure et le volume le justifient.

---

## FUT-DR-002 : Réplication multi-région

Répliquer les données dans une autre région.

---

## FUT-DR-003 : Multi-provider disaster recovery

Préparer une capacité de reprise avec un second fournisseur d'infrastructure.

---

## FUT-DR-004 : Hot Standby

Maintenir une infrastructure secondaire active ou semi-active.

---

## FUT-DR-005 : Automated Disaster Recovery

Automatiser davantage :

- détection ;
- provisioning ;
- restore ;
- validation.

---

## FUT-DR-006 : Business Continuity avancée

Définir des procédures opérationnelles complètes pour maintenir les fonctions prioritaires pendant une panne prolongée.

---

# 58. Architecture Constraints Related to Future Evolutions

## ARCH-DR-001 : Infrastructure Reproducible

Le système doit pouvoir être redéployé à partir d'une configuration versionnée.

---

## ARCH-DR-002 : Database Recoverability

Les données doivent être récupérables sans dépendre d'un seul environnement éphémère.

---

## ARCH-DR-003 : Object Storage Independence

Les fichiers ne doivent pas dépendre du disque local de l'application.

---

## ARCH-DR-004 : External Provider Isolation

La récupération doit pouvoir désactiver temporairement une intégration sans rendre impossible le démarrage de toute l'application lorsque cela est techniquement raisonnable.

---

## ARCH-DR-005 : Migration Safety

Les migrations doivent limiter les opérations irréversibles.

---

## ARCH-DR-006 : Data Repair Scripts

Les corrections importantes doivent pouvoir être automatisées et rejouées de manière contrôlée lorsque nécessaire.

---

# 59. Out of Scope

## OUT-DR-001

Multi-région obligatoire au lancement.

---

## OUT-DR-002

Hot standby complet pour le MVP.

---

## OUT-DR-003

Infrastructure de secours totalement indépendante au lancement.

---

## OUT-DR-004

Automatisation complète de la récupération sans validation humaine.

---

## OUT-DR-005

Garantie contractuelle de disponibilité avant définition d'un véritable SLA.

---

# 60. Definition of Done Disaster Recovery

La stratégie MVP est considérée comme opérationnelle lorsque :

```text id="8v0smc"
[ ] Backups actifs
[ ] Rétention définie
[ ] Restore testé
[ ] Runbook disponible
[ ] RTO défini
[ ] RPO défini
[ ] Recovery order défini
[ ] Payment reconciliation prévue
[ ] Incident process défini
[ ] Secrets recovery process défini
[ ] Monitoring recovery prévu
```

---

# 61. Checklist de récupération

```text id="2w5qu5"
## Detection
[ ] Incident confirmé
[ ] Impact évalué
[ ] Severity définie

## Containment
[ ] Source isolée
[ ] Accès suspendus si nécessaire
[ ] Integrations contrôlées

## Recovery
[ ] Database
[ ] Storage
[ ] Application
[ ] Jobs
[ ] Providers
[ ] Monitoring

## Validation
[ ] Authentication
[ ] Properties
[ ] Tenants
[ ] Leases
[ ] Rents
[ ] Payments
[ ] Receipts
[ ] Charges
[ ] Documents

## After
[ ] Logs
[ ] Audit
[ ] Reconciliation
[ ] Postmortem
[ ] Preventive actions
```

---

# 62. Principe final

La continuité du produit repose sur trois capacités :

```text id="1k1cd0"
Prévenir
↓
Récupérer
↓
Vérifier
```

Une sauvegarde seule ne constitue pas un plan de reprise.

Un véritable plan de reprise doit permettre :

```text id="3r7j83"
Incident
↓
Protection des données
↓
Restauration
↓
Validation métier
↓
Retour contrôlé au service
```

Le principe directeur est :

> **En cas d'incident grave, nous devons savoir quoi restaurer, comment le restaurer et comment prouver que le produit est redevenu fiable.**