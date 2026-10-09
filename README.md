# SIMANDOU IMMO

SaaS de gestion opérationnelle des immeubles et biens locatifs, adapté au contexte guinéen.

> **Complexe technologiquement. Simple humainement.**

Produit **mobile first** : tout parcours est conçu d'abord pour smartphone, puis adapté au responsive tablette et desktop.

SIMANDOU IMMO est un projet **distinct de SIMANDOU SEJOUR**. Les deux ne partagent ni code, ni base de données, ni périmètre.

---

## État du projet

|                  |                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Phase            | Lot 10 terminé : les charges communes, seconde créance du modèle financier               |
| Documentation    | 33 documents consolidés dans `docs/`, plus 12 ADR                                        |
| Base de données  | Sept migrations, de `0000_initial_schema` à `0006_charges`                               |
| Authentification | Téléphone et mot de passe, session, déconnexion                                          |
| Patrimoine       | Immeubles, appartements, gestionnaires et leur périmètre, locataires, baux               |
| Finance          | Loyers générés par job, charges réparties et publiées, total dû loyers et charges réunis |
| Tests            | 1365, dont les migrations réellement appliquées sur PostgreSQL                           |

La documentation est la **source de vérité** fonctionnelle, produit, UX, technique et opérationnelle. Elle précède le code, et non l'inverse.

---

## Stack

| Couche           | Choix                               |
| ---------------- | ----------------------------------- |
| Framework        | Next.js 16, App Router              |
| UI               | React 19, Tailwind CSS 4, shadcn/ui |
| Langage          | TypeScript strict                   |
| Base de données  | PostgreSQL                          |
| ORM              | Drizzle                             |
| Validation       | Zod                                 |
| Formulaires      | React Hook Form                     |
| Authentification | Better Auth                         |
| Tests            | Vitest                              |
| Hébergement      | Vercel                              |

Architecture : **modular monolith**, un seul repository, pas de microservices.

PostgreSQL est la source de vérité. Supabase n'est utilisé que comme **hébergeur PostgreSQL managé** : l'accès aux données passe exclusivement par Drizzle, jamais par une API propriétaire Supabase.

---

## Prérequis

- Node.js 24 ou supérieur
- npm 11 ou supérieur
- Docker, pour le PostgreSQL local

---

## Démarrage

```bash
npm install
cp .env.example .env
npm run db:start      # PostgreSQL local dans Docker
npm run db:migrate    # applique les migrations
npm run db:seed       # données de développement, deux organisations
npm run dev
```

L'application démarre sur http://localhost:3000.

Le seed crée trois comptes actifs, dont le mot de passe est `simandou-dev-2026`. Le propriétaire de la première organisation se connecte avec `+224620000001`, son gestionnaire avec `+224620000002`. Ces identifiants sont fictifs et ne servent qu'au développement local.

Les variables requises sont validées au démarrage, avec un message qui les nomme toutes en une fois. Voir `.env.example`.

### Sans Docker

Si Docker ne démarre pas, par exemple parce que la virtualisation est désactivée dans le
microprogramme de la machine, une base de secours sert le même moteur que les tests sur le
port 5432 (DEC-038) :

```bash
npm run db:pglite     # laisser tourner dans son propre terminal
npm run db:migrate
npm run db:seed
npm run dev
```

Cette base ne sert **qu'une connexion à la fois** : arrêter le serveur de développement avant
de lancer `db:seed` ou `db:studio`. Les données vivent dans `.pglite/`, ignoré par git.

### Vérifier le rendu mobile

Tout lot qui produit des écrans se vérifie à **360 et 390 px** (DEC-040), avec un Chrome sans
interface piloté par `scripts/mobile/` :

```bash
npm run dev           # dans un terminal, PAS `npm run start`
npm run db:pglite     # dans un autre, si la base locale est PGlite
npm run mobile -- immeubles immeubles/<id>/appartements
```

Pour chaque écran et chaque largeur, l'outil mesure le débordement, les cibles tactiles sous
44 px (en mesurant la zone réellement atteignable) et le texte coupé, capture la page entière,
puis se termine en code 1 si un défaut est relevé. Il est en **lecture seule** et ne vise que
`localhost`. Les captures et `results.json` vont dans le dossier temporaire du système.
`npm run mobile -- --help` détaille les options.

Sous Git Bash, écrire les chemins sans `/` initial : le shell déforme les autres.

L'audit est en lecture seule. Les actions qui engagent quelque chose se vérifient par un
**parcours**, qui les touche vraiment au doigt à 360 px :

```bash
npx tsx scripts/mobile/parcours-loyers.ts    # génération des loyers, idempotente
npx tsx scripts/mobile/parcours-charges.ts   # publication d'une charge, non rejouable
```

---

**Les tests n'ont besoin d'aucun serveur.** Ils utilisent PGlite, PostgreSQL compilé en WebAssembly, et appliquent la vraie migration (DEC-035).

---

## Commandes

| Commande               | Rôle                                    |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Serveur de développement                |
| `npm run build`        | Build de production                     |
| `npm run start`        | Serveur de production                   |
| `npm run lint`         | ESLint                                  |
| `npm run typecheck`    | Vérification des types, sans émission   |
| `npm run test`         | Tests, une passe                        |
| `npm run test:watch`   | Tests en observation continue           |
| `npm run format`       | Formatage Prettier                      |
| `npm run format:check` | Vérification du formatage               |
| `npm run mobile`       | Vérifie le rendu mobile à 360 et 390 px |
| `npm run db:start`     | Démarre le PostgreSQL local dans Docker |
| `npm run db:stop`      | Arrête le PostgreSQL local              |
| `npm run db:generate`  | Génère une migration depuis le schéma   |
| `npm run db:migrate`   | Applique les migrations                 |
| `npm run db:seed`      | Charge les données de développement     |
| `npm run db:studio`    | Explorateur de base Drizzle             |

La CI exécute `lint`, `typecheck`, `format:check`, `test` puis `build`. Une Pull Request qui échoue sur l'une de ces étapes est bloquée.

---

## Structure

Structure actuelle :

```text
docs/                 documentation de référence
src/app/              App Router : écrans et routes d'API
src/components/       composants d'interface, primitives et métier
src/modules/          modules métier, un par domaine
src/db/               schéma Drizzle, migrations, seed
src/lib/              utilitaires transverses
scripts/              scripts d'exploitation
tests/                tests
.github/workflows/    CI
```

Structure cible, créée **au fur et à mesure** des besoins réels :

```text
src/
├── app/              routes et écrans
├── components/       composants partagés
├── modules/          modules métier, un par domaine
├── lib/              utilitaires transverses
└── db/               schéma Drizzle et migrations
```

Règle appliquée : aucun dossier n'est créé avant d'avoir un contenu réel. Pas de squelette vide.

---

## Documentation

Point d'entrée obligatoire : **`docs/00-decisions/decision-register.md`**.

Ce registre indique, pour chaque décision produit ou technique, si elle est **verrouillée**, **consolidée** ou **encore ouverte**. Il fait autorité sur le statut d'une décision.

| Dossier                  | Contenu                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `docs/00-decisions/`     | Registre des décisions                                                                |
| `docs/01-product/`       | Vision, PRD, spécification maîtresse, périmètre MVP                                   |
| `docs/02-ux/`            | Parcours, architecture de l'information, design system, identité visuelle, composants |
| `docs/03-domain/`        | Rôles et permissions, règles métier, glossaire                                        |
| `docs/04-technical/`     | API, base de données, standards, gouvernance d'architecture, intégrations             |
| `docs/05-security/`      | Sécurité, protection des données, accessibilité                                       |
| `docs/06-quality/`       | Tests, recette, traçabilité                                                           |
| `docs/07-operations/`    | Déploiement, supervision, performance, reprise, maintenance                           |
| `docs/08-execution/`     | Plan de développement, backlog, dossier de passation                                  |
| `docs/architecture/adr/` | Architecture Decision Records                                                         |

### Ordre d'autorité

En cas de contradiction entre deux documents :

```text
1. Product & Technical Decision Register
2. Master Product Specification
3. MVP Scope & Feature Matrix
4. Business Rules
5. Security & Access Control
6. Database Schema & Migration
7. API & Backend
8. UX, architecture de l'information, design system, composants
9. Standards, implémentation, QA, DevOps, exploitation
```

Un document de rang inférieur ne peut jamais contredire un document de rang supérieur. Toute contradiction constatée se corrige dans le document de rang inférieur.

---

## Règles non négociables

Ces règles sont détaillées dans `docs/`. Elles sont rappelées ici parce qu'aucune contribution ne peut s'en écarter.

1. **Le backend décide.** Le frontend ne détermine jamais une permission, un montant, un statut ou une allocation.
2. **Autorisation systématique côté serveur**, sur le rôle et le périmètre. Connaître un identifiant ne donne jamais accès à une ressource.
3. **Isolation stricte entre organisations.**
4. **Archiver, terminer, révoquer : jamais détruire.** Aucun historique n'est supprimé.
5. **Montants en entier**, dans la plus petite unité de la devise, avec devise explicite. Jamais de nombre à virgule flottante dans un calcul financier.
6. **Idempotence financière.** Une opération répétée ne crée jamais deux paiements.
7. **Fournisseurs externes derrière un adapter.** Aucun module métier n'appelle directement un SDK tiers, authentification comprise.
8. **Mobile first.** Concevoir pour desktop puis comprimer est interdit.

---

## Périmètre

Le périmètre du MVP est fixé par `docs/01-product/mvp-scope.md`.

Toute capacité qui n'y figure pas est hors périmètre, même utile. Une demande isolée ne modifie pas le périmètre : elle passe par le registre de décisions.

---

## Note sur Next.js

Ce projet utilise Next.js 16. Les conventions de cette version peuvent différer des exemples génériques. Consulter `node_modules/next/dist/docs/` avant d'écrire du code Next.js, comme l'indique `AGENTS.md`.
