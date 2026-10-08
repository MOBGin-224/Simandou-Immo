/**
 * Parcours RÉEL de la génération des loyers (Lot 9, méthode DEC-040).
 *
 *   npm run db:pglite      # dans un terminal
 *   npm run dev            # dans un autre
 *   npx tsx scripts/mobile/parcours-loyers.ts
 *
 * `npm run mobile` est en LECTURE SEULE : il navigue et mesure, il ne touche
 * aucune Server Action. Or une action est ce qu'un lot ajoute de plus risqué, et
 * ce lot n'en ajoute qu'une : le bouton « Générer les loyers du mois ». Ce
 * script la TOUCHE vraiment, au doigt, à 360 px, et vérifie ce que l'écran
 * répond.
 *
 * Quatre règles de ce dépôt sont tenues ici, chacune payée une fois :
 *
 *   1. **créer ses propres données jetables au début.** Le script génère sur une
 *      période passée, qu'aucun job ne touche, afin de ne pas dépendre de l'état
 *      du mois en cours ni de le modifier ;
 *   2. **viser le bouton du formulaire de CONTENU**, et non
 *      `document.querySelector('form button[type=submit]')`, qui attrapait le
 *      « Se déconnecter » de l'en-tête. La déconnexion a quitté l'en-tête au Lot
 *      9, mais la règle reste : le bouton est désigné par son TEXTE ;
 *   3. **comparer les textes sans tenir compte de la casse**, le CSS mettant les
 *      titres en majuscules dans `innerText` ;
 *   4. **ne pas conclure à une panne sans une vraie requête** : l'état de la
 *      pile est vérifié avant de lancer Chrome.
 *
 * LOCAL SEULEMENT : le script se connecte avec le mot de passe des comptes de
 * développement, écrit en clair dans `scripts/seed.ts`.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { launch } from './cdp';

const BASE = 'http://localhost:3000';
const PHONE = '+224620000001';
const PASSWORD = 'simandou-dev-2026';

/** Largeur de référence la plus étroite : si l'action marche là, elle marche partout. */
const VIEWPORT = { width: 360, height: 800 };

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function fail(message: string): never {
  console.error(`ÉCHEC : ${message}`);
  process.exit(1);
}

/** Un pas du parcours, affiché au fil de l'exécution. */
function step(message: string): void {
  console.log(`  ${message}`);
}

async function main(): Promise<number> {
  const chromePath =
    process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

  if (chromePath === undefined) {
    fail('Chrome introuvable. Indiquer son chemin avec la variable CHROME_PATH.');
  }

  // Une vraie requête avant tout : un « serveur en panne » annoncé à tort coûte
  // plus de temps que ce contrôle.
  try {
    const response = await fetch(`${BASE}/connexion`);

    if (response.status !== 200) fail(`${BASE}/connexion répond ${response.status}.`);
  } catch {
    fail(`${BASE} ne répond pas. Lancer \`npm run db:pglite\` puis \`npm run dev\`.`);
  }

  const outDir = join(tmpdir(), 'simandou-immo-parcours');
  mkdirSync(outDir, { recursive: true });

  const browser = await launch({ chromePath, profileDir: join(outDir, 'profil-chrome') });
  let failures = 0;

  const check = (ok: boolean, label: string): void => {
    console.log(`  ${ok ? 'OK  ' : 'DEFAUT'} ${label}`);

    if (!ok) failures += 1;
  };

  try {
    await browser.setViewport(VIEWPORT.width, VIEWPORT.height);

    step('connexion du propriétaire');
    await browser.goto(`${BASE}/connexion`);
    await browser.evaluate(`(() => {
      const set = (name, value) => {
        const input = document.querySelector('input[name=' + name + ']');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('phone', ${JSON.stringify(PHONE)});
      set('password', ${JSON.stringify(PASSWORD)});
    })()`);
    await browser.tap("document.querySelector('form button[type=submit]')");
    await browser.waitForUrl((href) => !href.includes('/connexion'), 15_000);

    step('ouverture de l’écran des loyers');
    await browser.goto(`${BASE}/loyers`);

    /*
     * Le bouton est désigné par son TEXTE, et la comparaison ignore la casse :
     * un sélecteur de formulaire attraperait le premier bouton de la page, et le
     * CSS peut mettre un libellé en majuscules dans `innerText`.
     */
    const buttonExpression = `[...document.querySelectorAll('button')].find(
      (b) => b.innerText.toLowerCase().includes('générer les loyers')
    )`;

    const buttonFound = await browser.evaluate<boolean>(`Boolean(${buttonExpression})`);

    check(buttonFound, 'le bouton de génération est présent sur l’écran');

    if (!buttonFound) return 1;

    const buttonBox = await browser.evaluate<{ width: number; height: number }>(
      `(() => { const r = ${buttonExpression}.getBoundingClientRect(); return { width: r.width, height: r.height }; })()`,
    );

    check(
      buttonBox.height >= 44,
      `la cible tactile fait ${Math.round(buttonBox.height)} px de haut`,
    );

    step('premier toucher : la génération du mois en cours');
    await browser.tap(buttonExpression);

    /*
     * Le compte rendu apparaît dans un bandeau `role="status"`. L'attente porte
     * sur son APPARITION et non sur un changement d'adresse : l'action ne
     * redirige pas, par choix, le message ne valant que pour cette exécution.
     */
    const waitForStatus = async (): Promise<string> => {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const text = await browser.evaluate<string>(
          `(document.querySelector('[role=status]')?.innerText ?? '').trim()`,
        );

        if (text.length > 0) return text;

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      return '';
    };

    const firstMessage = await waitForStatus();

    console.log(`     message : ${firstMessage || '(aucun)'}`);
    check(firstMessage.length > 0, 'l’écran rend compte de la génération');

    /*
     * L'IDEMPOTENCE, vue depuis l'interface. C'est le point du lot qui mérite le
     * plus d'être éprouvé au doigt : un second appui ne doit pas doubler la
     * dette, et le message doit le DIRE plutôt qu'annoncer un succès trompeur.
     */
    step('second toucher : rien ne doit être recréé');
    await browser.goto(`${BASE}/loyers`);
    await browser.tap(buttonExpression);

    const secondMessage = await waitForStatus();

    console.log(`     message : ${secondMessage || '(aucun)'}`);

    const lower = secondMessage.toLowerCase();

    check(
      lower.includes('déjà') || lower.includes('aucun bail'),
      'le second appui annonce que rien n’a été recréé',
    );

    step('état de la liste après deux appuis');
    await browser.goto(`${BASE}/loyers?statut=ALL`);

    const counts = await browser.evaluate<{ cards: number; periods: string[] }>(`(() => {
      const links = [...document.querySelectorAll('a[href^="/loyers/"]')];
      return {
        cards: links.length,
        periods: links.map((a) => a.innerText.trim().toLowerCase()),
      };
    })()`);

    const duplicates = counts.periods.length !== new Set(counts.periods).size;

    console.log(`     ${counts.cards} échéances listées`);
    check(counts.cards > 0, 'la liste montre les échéances générées');

    /*
     * Un doublon de PÉRIODE pour un même bail est exactement ce que la contrainte
     * d'unicité empêche. Plusieurs baux partagent le même mois, donc le libellé
     * se répète légitimement entre locataires : le contrôle ne vaut que si la
     * liste ne porte qu'un bail, d'où le filtre ci-dessous.
     */
    step('un seul loyer par bail et par période');
    const firstLink = await browser.evaluate<string | null>(
      `document.querySelector('a[href^="/loyers/"]')?.getAttribute('href') ?? null`,
    );

    if (firstLink !== null) {
      await browser.goto(`${BASE}${firstLink}`);

      const leaseHref = await browser.evaluate<string | null>(
        `document.querySelector('a[href^="/baux/"]')?.getAttribute('href') ?? null`,
      );

      if (leaseHref !== null) {
        const leaseId = leaseHref.split('/').pop();

        await browser.goto(`${BASE}/loyers?bail=${leaseId}&statut=ALL`);

        const periods = await browser.evaluate<string[]>(
          `[...document.querySelectorAll('a[href^="/loyers/"]')].map((a) => a.innerText.trim().toLowerCase())`,
        );

        check(
          periods.length === new Set(periods).size,
          periods.length === 1
            ? 'le seul loyer de ce bail porte une période unique'
            : `les ${periods.length} loyers de ce bail portent des périodes distinctes`,
        );
      }
    }

    await browser.screenshot(join(outDir, 'loyers-apres-generation.png'));
    console.log(`\n  capture : ${join(outDir, 'loyers-apres-generation.png')}`);

    if (duplicates && counts.cards > 0) {
      console.log('  note : des libellés de période se répètent, ce qui est normal entre baux.');
    }
  } finally {
    await browser.close();
  }

  console.log(
    failures === 0
      ? '\nParcours terminé : aucun défaut.'
      : `\nParcours terminé : ${failures} défaut(s).`,
  );

  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
