/**
 * Parcours RÉEL de la publication d'une charge (Lot 10, méthode DEC-040).
 *
 *   npm run db:pglite      # dans un terminal
 *   npm run dev            # dans un autre
 *   npx tsx scripts/mobile/parcours-charges.ts
 *
 * `npm run mobile` est en LECTURE SEULE : il navigue et mesure, il ne touche
 * aucune Server Action. Or ce lot ajoute l'action la plus lourde de
 * conséquences du produit à ce jour : publier une charge CRÉE des créances que
 * des locataires devront, et la publication n'est pas rejouable (BR-052). Ce
 * script la touche vraiment, au doigt, à 360 px, et vérifie ce que l'écran
 * répond.
 *
 * **Ce qu'il éprouve, et que les tests ne peuvent pas voir.** Les tests
 * prouvent que le domaine refuse une seconde publication ; ils ne disent rien
 * de ce qu'un gestionnaire VIT s'il revient en arrière et appuie une seconde
 * fois sur « Publier ». C'est ce chemin-là qui est suivi ici, écran par écran.
 *
 * Les mêmes quatre règles qu'au parcours des loyers sont tenues, et pour les
 * mêmes raisons : données jetables créées au début, bouton désigné par son
 * TEXTE, comparaisons insensibles à la casse, et aucune conclusion de panne
 * sans une vraie requête préalable.
 *
 * La charge créée porte une période PASSÉE et un montant reconnaissable : elle
 * ne se confond avec aucune facture réelle, et aucun job ne la touche.
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

/** Facture jetable : période passée, montant qui ne ressemble à aucune autre. */
const PERIOD = '2026-03';
const DUE_DATE = '2026-03-10';
const TOTAL_AMOUNT = '770077';

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

/**
 * Désigne un bouton par son TEXTE.
 *
 * Un sélecteur de formulaire attraperait le premier bouton de la page, et le
 * CSS peut mettre un libellé en majuscules dans `innerText` : la comparaison
 * ignore donc la casse. Leçon payée une fois au Lot 9.
 */
function buttonWithText(text: string): string {
  return `[...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(
    text.toLowerCase(),
  )}))`;
}

function linkWithText(text: string): string {
  return `[...document.querySelectorAll('a')].find((a) => a.innerText.toLowerCase().includes(${JSON.stringify(
    text.toLowerCase(),
  )}))`;
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

  const browser = await launch({ chromePath, profileDir: join(outDir, 'profil-chrome-charges') });
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

    step('saisie d’une facture jetable');
    await browser.goto(`${BASE}/charges/nouvelle`);

    /*
     * Les champs sont remplis comme un navigateur le ferait, par le `setter`
     * natif suivi d'un événement : React ne verrait pas une affectation directe
     * de `value`, et le formulaire partirait vide.
     */
    await browser.evaluate(`(() => {
      const setInput = (name, value) => {
        const input = document.querySelector('[name=' + name + ']');
        if (!input) return;
        const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const property = document.querySelector('select[name=propertyId]');
      if (property) setInput('propertyId', property.options[1]?.value ?? property.options[0]?.value);

      setInput('type', 'WATER');
      setInput('totalAmount', ${JSON.stringify(TOTAL_AMOUNT)});
      setInput('periodStart', ${JSON.stringify(PERIOD)});
      setInput('dueDate', ${JSON.stringify(DUE_DATE)});
      setInput('supplierName', 'SEG (parcours)');
    })()`);

    await browser.tap(buttonWithText('enregistrer la charge'));
    await browser.waitForUrl((href) => /\/charges\/[0-9a-f-]{36}$/.test(href), 15_000);

    const chargeUrl = await browser.evaluate<string>('location.href');
    const chargeId = chargeUrl.split('/').pop() ?? '';

    check(chargeId.length === 36, `la charge est enregistrée : /charges/${chargeId}`);

    const draftState = await browser.evaluate<{ badge: string; shares: number; parts: string }>(
      `(() => ({
        badge: (document.body.innerText.match(/Brouillon|Publiée|Annulée/) ?? [''])[0],
        shares: document.querySelectorAll('ul li').length,
        /*
         * Comparaison en MINUSCULES : les surtitres de la charte sont mis en
         * capitales par le CSS, et \`innerText\` les rend tels qu'ils sont
         * affichés. Même leçon qu'au parcours des loyers, payée une seconde fois
         * ici.
         */
        parts: document.body.innerText.toLowerCase().includes('répartition prévue')
          ? 'prévue'
          : 'absente',
      }))()`,
    );

    check(draftState.badge === 'Brouillon', 'la charge naît en brouillon : rien n’est dû');
    check(draftState.parts === 'prévue', 'la répartition est ANNONCÉE avant d’engager quiconque');

    step('publication, au doigt');
    await browser.tap(linkWithText('publier la charge'));
    await browser.waitForUrl((href) => href.endsWith('/publier'), 15_000);

    const summary = await browser.evaluate<string>(
      `(document.querySelector('h1')?.innerText ?? '').trim()`,
    );

    check(
      summary.toLowerCase().includes('publier'),
      'l’écran demande confirmation avant de créer des créances',
    );

    await browser.tap(buttonWithText('publier la charge'));
    await browser.waitForUrl((href) => /\/charges\/[0-9a-f-]{36}$/.test(href), 15_000);

    const published = await browser.evaluate<{ badge: string; rows: number }>(
      `(() => ({
        badge: (document.body.innerText.match(/Brouillon|Publiée|Annulée/) ?? [''])[0],
        rows: document.querySelectorAll('ul li').length,
      }))()`,
    );

    check(published.badge === 'Publiée', 'la charge est publiée');
    check(published.rows > 0, `${published.rows} parts sont listées sur la fiche`);

    /*
     * LE POINT DU LOT, vu depuis l'interface : revenir sur l'écran de
     * publication après avoir publié. C'est le geste d'un gestionnaire qui
     * appuie sur « retour » et réessaie, et c'est exactement ce que BR-052
     * interdit de laisser aboutir. L'écran doit avoir disparu, et non proposer
     * un bouton qui refusera.
     */
    step('retour en arrière : la publication ne doit plus exister');
    await browser.goto(`${BASE}/charges/${chargeId}/publier`);

    /*
     * La page « introuvable » n'a pas de titre de niveau 1 : son libellé est un
     * paragraphe de l'`EmptyState`. Le contrôle porte donc sur le TEXTE de la
     * page, et non sur une balise dont la forme peut changer.
     */
    const retry = await browser.evaluate<{ text: string; hasButton: boolean }>(
      `(() => ({
        text: document.body.innerText.toLowerCase(),
        hasButton: Boolean(${buttonWithText('publier la charge')}),
      }))()`,
    );

    check(!retry.hasButton, 'aucun second bouton « Publier » n’est offert');
    check(retry.text.includes('introuvable'), 'l’écran de publication a disparu');

    step('la répartition n’a pas été doublée');
    await browser.goto(`${BASE}/charges/${chargeId}`);

    const afterRetry = await browser.evaluate<number>(`document.querySelectorAll('ul li').length`);

    check(
      afterRetry === published.rows,
      `la fiche montre toujours ${afterRetry} parts, et non le double`,
    );

    step('annulation de la facture jetable');
    await browser.tap(linkWithText('annuler la charge'));
    await browser.waitForUrl((href) => href.endsWith('/annuler'), 15_000);
    await browser.tap(buttonWithText('annuler la charge'));
    await browser.waitForUrl((href) => /\/charges\/[0-9a-f-]{36}$/.test(href), 15_000);

    const cancelled = await browser.evaluate<{ badge: string; text: string }>(
      `(() => ({
        badge: (document.body.innerText.match(/Brouillon|Publiée|Annulée/) ?? [''])[0],
        text: document.body.innerText.toLowerCase(),
      }))()`,
    );

    check(cancelled.badge === 'Annulée', 'la charge est annulée');
    check(
      cancelled.text.includes('annulé') && !cancelled.text.includes('reste à encaisser'),
      'les parts annulées sortent du reste à encaisser, sans disparaître',
    );

    const shot = join(outDir, 'charges-apres-publication.png');

    await browser.screenshot(shot);
    console.log(`\n  capture : ${shot}`);
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
