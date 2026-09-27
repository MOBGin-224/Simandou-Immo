# ADR-011 : PWA responsive mobile first

## Status

Accepted

## Date

2026-09-19

## Context

Sur le marché visé, le smartphone est l'appareil principal, souvent le seul. Un locataire consultera son solde depuis son téléphone. Un gestionnaire enregistrera un paiement ou déclarera un incident sur le terrain, parfois avec une connexion médiocre.

Une application native imposerait deux bases de code supplémentaires, une soumission en magasin et un cycle de mise à jour subi, pour un produit dont le périmètre n'est pas encore validé auprès d'utilisateurs réels.

Formalisation rétroactive le 2026-09-26.

## Decision

Une **application web responsive, conçue mobile first**, avec les capacités d'une **PWA**.

Règle non négociable : tout écran est conçu **d'abord pour smartphone**, puis adapté au responsive tablette et desktop.

**Concevoir pour desktop puis comprimer est interdit.**

Contraintes d'interface associées :

```text
cible tactile minimum   44 x 44 px
typographie             Manrope pour titres et chiffres, Inter pour le contenu
icônes                  Lucide
```

Aucune application native iOS ou Android n'est développée au MVP.

## Alternatives

**Applications natives iOS et Android.** Écartée : deux bases de code de plus, dépendance aux magasins pour chaque correction, et coût disproportionné avant validation du périmètre.

**Framework multiplateforme comme React Native.** Écartée pour le MVP : une base de code au lieu de deux, mais toujours un cycle de distribution et un pipeline de build distincts.

**Application web desktop first, adaptée ensuite.** Écartée formellement. C'est l'erreur exacte que la décision interdit : une interface pensée pour un grand écran puis comprimée produit une densité et des cibles tactiles inadaptées, et un locataire en est le premier pénalisé.

## Reasons

1. L'usage réel est majoritairement mobile, y compris pour les gestionnaires.
2. Le déploiement web permet de corriger en heures ce qu'un magasin d'applications ferait attendre des jours.
3. Concevoir d'abord pour la contrainte la plus forte force la hiérarchisation de l'information. L'inverse ne la force jamais.
4. Une PWA couvre les besoins réels du produit : accès depuis l'écran d'accueil et robustesse d'affichage. Le produit n'a pas besoin des capacités natives profondes.

## Consequences

Avantages : une seule base de code, un seul déploiement, corrections immédiates.

Compromis : pas d'accès aux notifications natives ni à l'intégration système d'une application installée. Les notifications sont internes au produit au MVP (ADR-009).

Compromis : la contrainte mobile first limite la densité d'information affichable simultanément. C'est un choix de conception, pas une limite technique.

Toute revue d'interface se fait d'abord sur une largeur de smartphone. Une interface validée uniquement sur grand écran n'est pas validée.

## Security Impact

Aucune surface d'attaque native ajoutée.

Le produit étant accessible depuis un navigateur quelconque, les sessions, les en-têtes de sécurité et la protection contre les requêtes forgées prennent une importance accrue.

Les documents privés restent accessibles uniquement par URL signée à durée limitée, y compris depuis un mobile.

## Data Impact

Aucun. La décision porte sur la couche de présentation.

Point d'attention : les vues mobiles doivent demander **moins** de données, pas les mêmes filtrées côté client. La pagination et la sélection de colonnes se décident côté serveur.

## Operational Impact

La performance sur réseau lent et sur appareil modeste devient un critère de recette, non une optimisation ultérieure.

Aucune dépendance à un magasin d'applications, donc aucun délai de validation externe.

## Migration

Sans objet : décision initiale.

Une application native ultérieure consommerait la même API, sans réécriture du backend.

## Related Documents

- `docs/02-ux/ux-specification.md`
- `docs/02-ux/design-system.md`
- `docs/02-ux/visual-identity.md`
- `docs/05-security/accessibility.md`
- `docs/07-operations/performance.md`

## Related ADRs

- ADR-002, ADR-009
