/**
 * Vérification du rendu mobile d'une liste d'écrans (DEC-040).
 *
 *   npm run dev            # dans un terminal (PAS `npm run start`, voir plus bas)
 *   npm run db:pglite      # dans un autre, si la base locale est PGlite
 *   npm run mobile -- /immeubles /immeubles/<id>/appartements
 *
 * Pour chaque adresse et chaque largeur de référence, 360 et 390 px : charge la
 * page dans un Chrome sans interface, mesure débordement, cibles tactiles et texte
 * coupé, capture la page entière, puis affiche un verdict. La commande se termine
 * en code 1 si un défaut est relevé, ce qui permet de l'enchaîner dans un script.
 *
 * LECTURE SEULE. L'outil ne fait que naviguer, hormis la connexion. Il ne touche
 * aucune donnée. Pour un parcours qui agit, par exemple archiver, écrire un script
 * dédié avec `tap` et `waitForUrl` de `cdp.ts`, sur des données jetables : une
 * archive n'a pas de retour.
 *
 * LOCAL SEULEMENT. L'outil se connecte avec le mot de passe des comptes de
 * développement, écrit en clair dans `scripts/seed.ts`. Il refuse donc toute
 * adresse qui n'est pas `localhost` ou `127.0.0.1`.
 *
 * Deux pièges déjà payés, d'où les messages d'erreur ci-dessous :
 *
 *   1. `npm run start` ne convient pas. Hors production le client de base ouvre
 *      UNE connexion, en production CINQ, et PGlite n'en accepte qu'une : Chrome,
 *      qui envoie des requêtes en parallèle, déclenche `read ECONNRESET` et des
 *      pages d'erreur. Des `curl` en série passeraient, ce qui trompe.
 *   2. Un cache `.next/dev` périmé peut faire répondre 404 sur TOUTES les routes,
 *      sans la moindre erreur dans les journaux. Arrêter `next dev`, déplacer
 *      `.next/dev`, relancer.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { auditScript, type RawAudit } from './audit';
import { launch } from './cdp';
import { findProblems, formatPage, type PageAudit } from './report';

const USAGE = `Usage : npm run mobile -- [options] <chemin> [<chemin>...]

  --base      adresse de l'application, locale uniquement (défaut http://localhost:3000)
  --phone     téléphone du compte (défaut : propriétaire A du seed, ou MOBILE_PHONE)
  --password  mot de passe (défaut : celui du seed, ou MOBILE_PASSWORD)
  --widths    largeurs x hauteurs, séparées par une virgule (défaut 360x800,390x844)
  --out       dossier des captures et de results.json (défaut : dossier temporaire)
  --chrome    chemin de Chrome (défaut : détection, ou CHROME_PATH)
  --port      port de débogage de Chrome (défaut 9222)
  --public    ne pas se connecter, pour les écrans publics comme /connexion

  <chemin>    adresse d'un écran, avec ou sans « / » initial (Git Bash déforme « / »)

Exemple : npm run mobile -- immeubles connexion --public`;

/** Même valeur que `DEV_PASSWORD` de scripts/seed.ts : comptes de développement uniquement. */
const SEED_PASSWORD = 'simandou-dev-2026';
/** Propriétaire A du seed. */
const SEED_OWNER_PHONE = '+224620000001';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

/**
 * Supprime le profil jetable de Chrome. Un nettoyage raté ne doit JAMAIS masquer
 * l'erreur qui l'a précédé : appelé depuis un `finally`, une exception ici
 * remplacerait la vraie cause par un EPERM sans rapport.
 */
function removeProfile(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    console.warn(`Profil Chrome non supprimé, à effacer à la main : ${dir}`);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

function parseWidths(raw: string): { width: number; height: number }[] {
  return raw.split(',').map((part) => {
    const match = /^(\d{3,4})x(\d{3,4})$/.exec(part.trim());
    if (!match) fail(`Largeur illisible : « ${part} ». Attendu : 360x800.`);
    return { width: Number(match[1]), height: Number(match[2]) };
  });
}

/**
 * Normalise une adresse passée en argument.
 *
 * Git Bash transforme tout argument qui commence par `/` en chemin Windows :
 * `/immeubles` arrive alors comme `C:/Program Files/Git/immeubles`, et Chrome
 * répond « Cannot navigate to invalid URL » sans dire pourquoi. On accepte donc
 * les chemins sans `/` initial, que Git Bash laisse intacts, et on refuse un
 * chemin déjà déformé avec la marche à suivre.
 */
function normalizePath(raw: string): string {
  if (/^[A-Za-z]:[\\/]/.test(raw)) {
    fail(
      `Chemin déformé par le shell : « ${raw} ». Git Bash convertit les arguments qui commencent ` +
        `par « / ». Écrire le chemin sans le « / » initial (immeubles/...), préfixer la commande ` +
        `par MSYS_NO_PATHCONV=1, ou utiliser PowerShell.`,
    );
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function slug(path: string): string {
  return (
    path
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'racine'
  );
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: 'string' },
    phone: { type: 'string' },
    password: { type: 'string' },
    widths: { type: 'string' },
    out: { type: 'string' },
    chrome: { type: 'string' },
    port: { type: 'string' },
    public: { type: 'boolean' },
    help: { type: 'boolean' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

/**
 * Corps dans une fonction : le dépôt n'est pas en `"type": "module"`, donc `tsx`
 * exécute ce fichier en CommonJS, où `await` au niveau supérieur est interdit.
 * Renvoie le code de sortie.
 */
async function main(): Promise<number> {
  const base = (values.base ?? 'http://localhost:3000').replace(/\/$/, '');
  const host = new URL(base).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    fail(
      `Adresse refusée : ${base}. L'outil se connecte avec le mot de passe de développement ` +
        `et ne vise que localhost ou 127.0.0.1.`,
    );
  }

  // Avant tout lancement de Chrome : une adresse déformée doit échouer tout de suite.
  const paths = positionals.map(normalizePath);

  const chromePath =
    values.chrome ?? process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((path) => existsSync(path));
  if (chromePath === undefined || !existsSync(chromePath)) {
    fail('Chrome introuvable. Indiquer son chemin avec --chrome ou la variable CHROME_PATH.');
  }

  const widths = parseWidths(values.widths ?? '360x800,390x844');
  const firstViewport = widths[0];
  if (firstViewport === undefined) fail('Aucune largeur à vérifier.');

  const outDir = values.out ?? join(tmpdir(), 'simandou-immo-mobile');
  mkdirSync(outDir, { recursive: true });

  try {
    const response = await fetch(`${base}/connexion`);
    if (response.status !== 200) {
      fail(
        `${base}/connexion répond ${response.status}. Si toutes les routes répondent 404, le cache ` +
          `.next/dev est probablement périmé : arrêter next dev, déplacer .next/dev, relancer.`,
      );
    }
  } catch {
    fail(
      `${base} ne répond pas. Lancer \`npm run dev\` (et non \`npm run start\`, voir l'en-tête de ce script).`,
    );
  }

  const profileDir = join(outDir, 'profil-chrome');
  const browser = await launch({
    chromePath,
    profileDir,
    port: values.port === undefined ? undefined : Number(values.port),
  });

  const pages: PageAudit[] = [];
  let errorCount = 0;

  try {
    if (values.public !== true) {
      await browser.setViewport(firstViewport.width, firstViewport.height);
      await browser.goto(`${base}/connexion`);

      const phone = values.phone ?? process.env.MOBILE_PHONE ?? SEED_OWNER_PHONE;
      const password = values.password ?? process.env.MOBILE_PASSWORD ?? SEED_PASSWORD;

      await browser.evaluate(`(() => {
      const set = (name, value) => {
        const input = document.querySelector('input[name=' + name + ']');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('phone', ${JSON.stringify(phone)});
      set('password', ${JSON.stringify(password)});
    })()`);
      await browser.tap("document.querySelector('form button[type=submit]')");

      try {
        await browser.waitForUrl((href) => !href.includes('/connexion'), 10_000);
      } catch {
        fail(
          `Connexion refusée pour ${phone}. Le seed a-t-il été chargé (npm run db:seed) ? ` +
            `La base locale tourne-t-elle (npm run db:pglite) ?`,
        );
      }
    }

    let index = 0;
    for (const path of paths) {
      index++;
      for (const { width, height } of widths) {
        await browser.setViewport(width, height);
        await browser.goto(base + path);

        const raw = JSON.parse(await browser.evaluate<string>(auditScript(width))) as RawAudit;
        const page: PageAudit = { ...raw, label: path, width, url: path };
        pages.push(page);

        const problems = findProblems(page);
        errorCount += problems.filter((problem) => problem.severity === 'error').length;

        await browser.screenshot(
          join(outDir, `${String(index).padStart(2, '0')}-${slug(path)}-${width}.png`),
        );
        console.log(formatPage(page, problems));
      }
    }
  } finally {
    await browser.close();
    removeProfile(profileDir);
  }

  writeFileSync(join(outDir, 'results.json'), JSON.stringify(pages, null, 2));

  console.log(
    `\n${pages.length} écran${pages.length > 1 ? 's' : ''} mesuré${pages.length > 1 ? 's' : ''}, ` +
      `${errorCount} défaut${errorCount > 1 ? 's' : ''}. Captures et results.json : ${outDir}`,
  );
  return errorCount > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(2);
  },
);
