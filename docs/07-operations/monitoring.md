# Product Analytics & Operational Monitoring Specification

## 1. Objet du document

Ce document définit ce que le produit doit mesurer après son lancement afin de comprendre :

- comment les utilisateurs utilisent le produit ;
- où ils abandonnent leurs parcours ;
- quelles fonctionnalités sont réellement utilisées ;
- si les opérations critiques fonctionnent correctement ;
- si le produit rencontre des problèmes techniques ;
- si les notifications, paiements et jobs fonctionnent ;
- quelles données doivent être surveillées sans collecter inutilement des informations personnelles.

Ce document distingue :

```text
Product Analytics
=
Comprendre l'utilisation du produit

Operational Monitoring
=
Comprendre la santé technique du produit
```

L'analytics produit ne doit jamais remplacer les logs, l'audit ou le monitoring technique.

---

# 2. Principes fondamentaux

## ANALYTICS-001 : Mesurer pour décider

Un événement ne doit pas être collecté uniquement parce qu'il est techniquement facile à collecter.

Chaque événement doit répondre à une question produit ou opérationnelle.

---

## ANALYTICS-002 : Minimisation des données

Ne collecter que les données réellement nécessaires.

Éviter de transmettre à l'outil analytics :

- mots de passe ;
- tokens ;
- secrets ;
- documents privés ;
- contenu intégral des incidents ;
- informations financières inutiles ;
- données personnelles non nécessaires.

---

## ANALYTICS-003 : Séparer Analytics, Logs et Audit

### Product Analytics

Comprend l'utilisation du produit.

Exemple :

```text
property_created
tenant_invited
payment_viewed
incident_created
```

### Application Logs

Permettent de diagnostiquer les problèmes techniques.

### Audit Log

Permet de tracer les opérations sensibles et administratives.

Une donnée ne doit pas être envoyée vers les trois systèmes sans raison.

---

## ANALYTICS-004 : Le serveur reste la source des événements critiques

Pour les opérations critiques, l'événement analytics important doit idéalement être déclenché à partir d'une action métier confirmée par le backend.

Exemple :

```text
Frontend
↓
Payment initiated
↓
Backend
↓
Payment confirmed
↓
Analytics event
```

et non :

```text
Click button
↓
Assume payment confirmed
```

---

# 3. MVP

> **Statut au MVP — DEC-008.**
>
> Aucun fournisseur d'analytics ni de monitoring externe n'est intégré : PostHog et Sentry sont **reportés**.
>
> Ce qui est **dans** le périmètre MVP :
>
> - la **taxonomie** d'événements définie ci-dessous ;
> - l'interface `AnalyticsProvider`, avec une implémentation **inerte** ;
> - les **logs structurés** applicatifs ;
> - les logs de la plateforme d'hébergement.
>
> Ce qui est **hors** périmètre MVP : l'envoi effectif vers un outil tiers, les tableaux de bord analytiques et l'error tracking externe.
>
> Définir la taxonomie dès maintenant garantit que le branchement ultérieur d'un fournisseur ne nécessitera aucune reprise du code métier.

# 3.1 Objectifs analytics du MVP

Le MVP doit permettre de répondre à quelques questions fondamentales.

## ANALYTICS-MVP-001

Combien d'utilisateurs activent leur compte ?

## ANALYTICS-MVP-002

Combien de propriétaires créent réellement un immeuble ?

## ANALYTICS-MVP-003

Combien de gestionnaires acceptent leur invitation ?

## ANALYTICS-MVP-004

Combien de locataires activent leur compte ?

## ANALYTICS-MVP-005

Combien de contrats sont créés ?

## ANALYTICS-MVP-006

Combien de loyers sont générés ?

## ANALYTICS-MVP-007

Combien de paiements sont effectués ou enregistrés ?

## ANALYTICS-MVP-008

Combien d'incidents sont déclarés et résolus ?

## ANALYTICS-MVP-009

Quelles étapes du parcours sont abandonnées ?

---

# 4. Identification analytics

## MVP-ANALYTICS-001 : Identifiant utilisateur

Lorsqu'un utilisateur est authentifié, les événements peuvent être associés à un identifiant interne non directement exposé comme donnée personnelle.

Le système doit éviter d'envoyer inutilement :

- numéro de téléphone ;
- adresse email ;
- nom complet.

---

## MVP-ANALYTICS-002 : Rôle

Les événements peuvent contenir un contexte de rôle :

```text
OWNER
MANAGER
TENANT
```

---

## MVP-ANALYTICS-003 : Organisation

Les données analytics doivent pouvoir distinguer les contextes organisationnels lorsque cela est nécessaire à l'analyse, sans exposer inutilement des informations sensibles.

---

# 5. Taxonomie des événements

Les noms d'événements doivent être :

- cohérents ;
- en anglais technique ou dans une convention unique ;
- au présent ou au passé selon une règle définie ;
- sans variation orthographique.

Convention recommandée :

```text
object_action
```

Exemples :

```text
property_created
tenant_invited
payment_created
incident_created
```

---

# 6. Événements d'authentification

## MVP-ANALYTICS-004

Événements :

```text
sign_up_started
sign_up_completed
sign_in_completed
sign_in_failed
sign_out
password_reset_requested
password_reset_completed
```

---

## Données minimales

Exemple :

```json
{
  "role": "OWNER",
  "method": "password"
}
```

Ne jamais envoyer le mot de passe.

---

# 7. Événements d'invitation

## MVP-ANALYTICS-005

Événements :

```text
manager_invitation_created
manager_invitation_opened
manager_invitation_accepted
manager_invitation_expired
tenant_invitation_created
tenant_invitation_opened
tenant_invitation_accepted
tenant_invitation_expired
```

---

# 8. Événements patrimoine

## MVP-ANALYTICS-006

Événements :

```text
property_created
property_updated
property_archived
apartment_created
apartment_updated
```

L'analytics n'a pas besoin de stocker toute la donnée de l'immeuble.

---

# 9. Événements locataires

## MVP-ANALYTICS-007

Événements :

```text
tenant_created
tenant_invited
tenant_activated
tenant_updated
tenant_lease_ended
```

---

# 10. Événements contrats

## MVP-ANALYTICS-008

Événements :

```text
lease_created
lease_activated
lease_ended
```

---

# 11. Événements loyers

## MVP-ANALYTICS-009

Événements :

```text
rent_installment_created
rent_viewed
rent_overdue
rent_paid
```

Pour les événements financiers, le montant complet ne doit être transmis à l'outil analytics que si cela répond à un besoin clairement défini.

---

# 12. Événements paiements

## MVP-ANALYTICS-010

Événements :

```text
payment_started
payment_pending
payment_confirmed
payment_failed
payment_cancelled
payment_allocated
payment_rejected_exceeds_outstanding
```

`payment_allocated` porte le nombre et le type des créances réglées (`RENT`, `CHARGE`), jamais les montants nominatifs.

`payment_rejected_exceeds_outstanding` mesure la fréquence du cas traité par DEC-023.

---

## MVP-ANALYTICS-011 : Ne pas exposer les données sensibles du fournisseur

Ne jamais envoyer :

- numéro de carte ;
- token fournisseur ;
- secret webhook ;
- informations bancaires ;
- données sensibles du compte de paiement.

---

# 13. Événements charges

## MVP-ANALYTICS-012

Événements :

```text
charge_created
charge_previewed
charge_published
charge_receivable_created
charge_receivable_paid
charge_viewed
```

> **DEC-005** — la publication d'une charge crée des **créances payables**. La taxonomie doit permettre de mesurer leur règlement, pas seulement leur affichage.

---

# 14. Événements maintenance

## MVP-ANALYTICS-013

Événements :

```text
incident_created
incident_viewed
incident_assigned
intervention_started
intervention_completed
incident_closed
```

---

# 15. Événements dépenses

## MVP-ANALYTICS-014

Événements :

```text
expense_created
expense_viewed
```

---

# 16. Événements notifications

## MVP-ANALYTICS-015

Événements :

```text
notification_created
notification_delivered
notification_opened
notification_failed
```

Lorsque le canal le permet.

---

# 17. Événements recherche

## MVP-ANALYTICS-016

Mesurer uniquement les informations utiles.

Exemple :

```text
search_executed
search_no_result
```

Éviter de collecter systématiquement le contenu exact de toutes les recherches lorsqu'il pourrait contenir des données personnelles.

---

# 18. Événements UX

## MVP-ANALYTICS-017

Mesurer certains problèmes d'expérience :

```text
form_validation_failed
action_failed
empty_state_viewed
error_state_viewed
```

---

# 19. Funnel d'activation propriétaire

Le MVP doit permettre d'observer :

```text
Sign Up
↓
Account Activated
↓
Organization Created
↓
Property Created
↓
Apartment Created
↓
Manager Invited
```

---

## MVP-ANALYTICS-018

Déterminer le taux de passage entre ces étapes.

L'objectif n'est pas de produire une analyse complexe mais d'identifier où les utilisateurs abandonnent.

---

# 20. Funnel gestionnaire

```text
Invitation
↓
Opened
↓
Accepted
↓
Account Activated
↓
Property Viewed
↓
Tenant Created
↓
Lease Created
```

---

# 21. Funnel locataire

```text
Invitation
↓
Opened
↓
Accepted
↓
Account Activated
↓
Housing Viewed
↓
Rent Viewed
↓
Payment Started
```

---

# 22. Activation produit

Une définition initiale peut être :

```text
Utilisateur activé
+
Premier objet métier créé ou consulté
```

La définition exacte de l'activation doit être réévaluée après observation des usages réels.

---

# 23. Métriques produit

Le MVP doit suivre quelques métriques principales.

## MVP-ANALYTICS-019 : Activation

Nombre et proportion d'utilisateurs ayant activé leur compte.

---

## MVP-ANALYTICS-020 : Onboarding propriétaire

Nombre de propriétaires ayant créé au moins un immeuble.

---

## MVP-ANALYTICS-021 : Gestionnaires actifs

Nombre de gestionnaires ayant effectué au moins une action métier sur une période donnée.

---

## MVP-ANALYTICS-022 : Locataires actifs

Nombre de locataires ayant ouvert leur espace ou effectué une action utile.

---

## MVP-ANALYTICS-023 : Immeubles actifs

Nombre d'immeubles ayant au moins une activité métier sur une période donnée.

---

## MVP-ANALYTICS-024 : Logements occupés

Nombre de logements avec relation locative active.

---

# 24. Métriques financières produit

Les informations financières détaillées doivent principalement provenir de la base métier.

L'outil analytics ne doit pas devenir la source de vérité financière.

---

## MVP-ANALYTICS-025

Suivre éventuellement :

```text
Payments Count
Payments Confirmed
Payments Failed
Payment Success Rate
```

Les montants financiers de référence doivent être calculés depuis la base métier ou les rapports métier.

---

# 25. Métriques maintenance

## MVP-ANALYTICS-026

Suivre :

- incidents créés ;
- incidents ouverts ;
- incidents résolus ;
- temps moyen jusqu'à prise en charge lorsque mesurable ;
- temps moyen jusqu'à résolution lorsque mesurable.

---

# 26. Rétention

Le MVP doit permettre d'observer des indicateurs simples de réutilisation.

Exemple :

```text
Utilisateur actif semaine 1
↓
Utilisateur actif semaine 2
```

La définition d'un utilisateur actif doit être propre à chaque rôle.

---

# 27. Analytics par rôle

## MVP-ANALYTICS-027

Les dashboards analytics internes doivent pouvoir distinguer :

```text
Owner
Manager
Tenant
```

Les comportements de ces profils ne doivent pas être mélangés dans une même métrique lorsqu'ils répondent à des objectifs différents.

---

# 28. Analytics mobile

## MVP-ANALYTICS-028

Le système doit permettre de savoir si une interaction a lieu depuis :

```text
mobile
tablet
desktop
```

sans collecter davantage de données personnelles.

Cette donnée sert notamment à vérifier l'hypothèse mobile first.

---

# 29. Monitoring opérationnel

L'Operational Monitoring est distinct de Product Analytics.

Le système doit surveiller les éléments critiques suivants.

---

# 30. MVP : disponibilité de l'application

## MVP-OPS-001

Surveiller :

- disponibilité ;
- erreurs serveur ;
- réponses HTTP critiques ;
- temps de réponse.

---

# 31. MVP : erreurs applicatives

## MVP-OPS-002

Surveiller :

- erreurs frontend ;
- erreurs backend ;
- erreurs API ;
- erreurs jobs ;
- exceptions non gérées.

---

# 32. MVP : Performance

## MVP-OPS-003

Mesurer :

- latence API ;
- temps de chargement ;
- requêtes lentes ;
- erreurs de timeout.

---

# 33. MVP : Base de données

## MVP-OPS-004

Surveiller :

- disponibilité ;
- connexion ;
- consommation ;
- erreurs ;
- latence ;
- capacité de stockage lorsque le fournisseur le permet.

---

# 34. MVP : Jobs

## MVP-OPS-005

Surveiller :

- jobs en échec ;
- retries ;
- durée ;
- accumulation ;
- jobs bloqués.

---

# 35. MVP : Paiements

## MVP-OPS-006

Surveiller :

```text
Payment Initiated
Payment Pending
Payment Confirmed
Payment Failed
Webhook Failed
Webhook Rejected
```

---

# 36. MVP : Notifications

## MVP-OPS-007

Surveiller :

- envoi ;
- échec ;
- retries ;
- taux d'échec ;
- provider indisponible.

---

# 37. MVP : Stockage

## MVP-OPS-008

Surveiller :

- erreurs upload ;
- erreurs download ;
- disponibilité ;
- consommation lorsque les données sont disponibles.

---

# 38. Health Dashboard

Un dashboard technique interne doit permettre de voir rapidement :

```text
Application
Database
Jobs
Payments
Notifications
Storage
```

Chaque élément peut avoir un état :

```text
Healthy
Degraded
Down
Unknown
```

---

# 39. Alertes opérationnelles

## MVP-OPS-009

Créer des alertes pour les événements nécessitant une intervention.

Exemples :

```text
Application down
Database unavailable
Error spike
Payment webhook failure spike
Job queue blocked
Storage unavailable
```

---

# 40. Seuils d'alerte

Les seuils doivent être définis avec prudence.

Éviter les alertes basées sur une seule erreur isolée lorsque celle-ci ne présente pas de risque opérationnel.

Privilégier :

```text
Volume
+
Fréquence
+
Durée
+
Criticité
```

---

# 41. Monitoring des fournisseurs

## MVP-OPS-010

Lorsque possible, suivre la santé des intégrations externes :

- paiement ;
- SMS ;
- WhatsApp ;
- email ;
- stockage.

Le produit doit distinguer :

```text
Produit en panne
```

de :

```text
Fournisseur externe en panne
```

---

# 42. Correlation technique

## MVP-OPS-011

Les erreurs importantes doivent pouvoir être reliées à un identifiant technique tel que :

```text
requestId
```

ou un identifiant de trace équivalent.

---

# 43. Dashboard opérationnel minimal

Le dashboard interne doit afficher notamment :

```text
Application Status
Error Rate
API Latency
DB Status
Failed Jobs
Payment Failures
Notification Failures
Storage Errors
```

---

# 44. Données à ne pas mesurer dans l'analytics standard

## MVP-ANALYTICS-029

Ne pas collecter systématiquement :

- mots de passe ;
- tokens ;
- documents ;
- contenu intégral des messages privés ;
- données bancaires ;
- secrets ;
- contenu complet des pièces jointes.

---

# 45. Confidentialité des événements

## MVP-ANALYTICS-030

Avant d'envoyer un événement, vérifier :

```text
Quelle question veut-on répondre ?
↓
Quelles données sont nécessaires ?
↓
Peut-on répondre avec moins de données ?
```

---

# 46. Qualité des événements

## MVP-ANALYTICS-031

Chaque événement doit avoir une structure définie.

Exemple :

```json
{
  "event": "payment_confirmed",
  "role": "TENANT",
  "payment_method": "mobile_money",
  "environment": "production"
}
```

Les champs doivent être documentés.

---

# 47. Versionnement du tracking

## MVP-ANALYTICS-032

Les événements importants doivent disposer d'une définition stable.

Lorsqu'une structure change de manière incompatible :

```text
event schema v1
→
event schema v2
```

ou une stratégie équivalente doit être utilisée.

---

# 48. Tracking server-side et client-side

Le tracking peut être effectué depuis :

### Client

Pour :

- interaction UI ;
- vue d'écran ;
- clic ;
- étape de parcours.

### Serveur

Pour :

- opération confirmée ;
- paiement ;
- contrat ;
- création métier ;
- événement critique.

Pour les événements financiers et de sécurité, privilégier la confirmation serveur.

---

# 49. Environment Separation

Les événements de :

```text
Development
Staging
Production
```

doivent être séparables.

Les données de développement ne doivent pas contaminer les métriques de production.

---

# 50. Test du tracking

## MVP-ANALYTICS-033

Le tracking critique doit être testé.

Exemple :

```text
Payment confirmed
↓
Database updated
↓
payment_confirmed event
```

Le système doit éviter de produire un événement faux lorsque la transaction métier échoue.

---

# 51. Monitoring et tests

## MVP-OPS-012

Les alertes doivent elles-mêmes être testées.

Un système d'alerte non testé ne doit pas être considéré comme opérationnel.

---

# 52. Incident observability

En cas d'incident, il doit être possible de corréler :

```text
User Action
↓
Request
↓
Backend
↓
Database / Provider
↓
Error
```

sans exposer les données sensibles.

---

# 53. Product Health Review

Une revue périodique doit analyser :

- activation ;
- adoption ;
- rétention ;
- erreurs ;
- paiements ;
- notifications ;
- incidents ;
- performances.

Le but est d'identifier les problèmes récurrents et les fonctionnalités sous-utilisées.

---

# 54. Future Evolutions

## FUT-ANALYTICS-001 : Analytics avancés

Ajouter :

- cohortes ;
- segmentation avancée ;
- funnels complexes ;
- parcours détaillés ;
- analyses de rétention avancées.

---

## FUT-ANALYTICS-002 : Product Experiments

Mettre en place :

- A/B testing ;
- expérimentation produit ;
- feature experimentation.

---

## FUT-ANALYTICS-003 : Analytics prédictifs

Introduire éventuellement :

- prédiction de retard ;
- prévision d'activité ;
- estimation de charge ;
- détection d'anomalies.

---

## FUT-ANALYTICS-004 : Data Warehouse

Créer un entrepôt analytique lorsque la volumétrie et les besoins le justifient.

---

## FUT-ANALYTICS-005 : Business Intelligence

Construire des tableaux de bord avancés pour :

- gestionnaires ;
- propriétaires ;
- équipe interne.

---

# 55. Architecture Constraints Related to Future Evolutions

## ARCH-ANALYTICS-001 : Événements standardisés

Les événements doivent pouvoir être exportés ou transformés vers une autre plateforme plus tard.

---

## ARCH-ANALYTICS-002 : Ne pas dépendre de l'outil analytics

Le produit ne doit jamais dépendre de la réussite d'un appel analytics pour terminer une opération métier.

Exemple :

```text
payment_confirmed
```

doit être enregistré dans la base même si l'outil analytics est indisponible.

---

## ARCH-ANALYTICS-003 : Analytics asynchrone lorsque pertinent

L'envoi analytics ne doit pas ralentir inutilement une opération utilisateur.

---

## ARCH-ANALYTICS-004 : Source de vérité métier

La base transactionnelle reste la source de vérité pour :

- paiements ;
- loyers ;
- contrats ;
- charges ;
- dépenses.

Analytics ne doit être qu'une couche d'analyse.

---

## ARCH-ANALYTICS-005 : Observabilité indépendante

Le monitoring technique doit continuer à fonctionner même si l'outil Product Analytics est indisponible.

---

# 56. Out of Scope

## OUT-ANALYTICS-001

Construire un data warehouse complet pour le MVP.

---

## OUT-ANALYTICS-002

Mettre en place du machine learning prédictif au lancement.

---

## OUT-ANALYTICS-003

Construire un système d'A/B testing complet au lancement.

---

## OUT-ANALYTICS-004

Collecter toutes les interactions possibles simplement pour avoir plus de données.

---

## OUT-ANALYTICS-005

Utiliser l'outil analytics comme source de vérité des données financières.

---

## OUT-ANALYTICS-006

Construire un système de monitoring distribué extrêmement complexe avant que le niveau de trafic ne le justifie.

---

# 57. Definition of Done Analytics

Le système analytics MVP est considéré comme correctement implémenté lorsque :

```text
[ ] Taxonomie définie
[ ] Événements critiques implémentés
[ ] Rôles identifiables
[ ] Environnements séparés
[ ] Données sensibles exclues
[ ] Événements financiers confirmés serveur
[ ] Tracking testé
[ ] Documentation disponible
```

---

# 58. Definition of Done Monitoring

Le monitoring MVP est considéré comme prêt lorsque :

```text
[ ] Application monitorée
[ ] Database monitorée
[ ] Jobs monitorés
[ ] Paiements monitorés
[ ] Notifications monitorées
[ ] Storage monitoré
[ ] Error tracking actif
[ ] Alertes critiques actives
[ ] Runbook incident disponible
```

---

# 59. Checklist de lancement

```text
## Product Analytics

[ ] Sign up
[ ] Sign in
[ ] Invitation
[ ] Property
[ ] Tenant
[ ] Lease
[ ] Rent
[ ] Payment
[ ] Charge
[ ] Incident
[ ] Intervention

## Operational Monitoring

[ ] Application
[ ] API
[ ] Database
[ ] Jobs
[ ] Payments
[ ] Notifications
[ ] Storage

## Privacy

[ ] No passwords
[ ] No secrets
[ ] No payment credentials
[ ] No unnecessary personal data
[ ] Production separated

## Reliability

[ ] Error tracking
[ ] Alerts
[ ] Request correlation
[ ] Backup
[ ] Restore
```

---

# 60. Principe final

Le produit ne doit pas être instrumenté pour collecter le maximum de données.

Il doit être instrumenté pour comprendre les bons problèmes.

La logique est :

```text
Question
↓
Événement utile
↓
Donnée minimale
↓
Mesure fiable
↓
Décision
```

Pour la partie opérationnelle :

```text
Signal
↓
Détection
↓
Alerte
↓
Diagnostic
↓
Action
```

Le principe directeur est :

> **Mesurer suffisamment pour comprendre le produit et garantir sa fiabilité, sans transformer l'analytics en complexité inutile ni compromettre les données des utilisateurs.**