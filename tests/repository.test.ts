import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Ce test garde le critère d'acceptation de MVP-BACKLOG-001 : les commandes de
 * qualité doivent exister et rester disponibles. La CI les appelle une par une,
 * mais rien ne garantirait qu'un script ne disparaisse pas d'un package.json
 * retouché à la main.
 */

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as PackageJson;

describe('MVP-BACKLOG-001 : commandes de qualité du repository', () => {
  const requiredScripts = [
    'dev',
    'build',
    'start',
    'lint',
    'typecheck',
    'test',
    'format',
    'format:check',
    'db:generate',
    'db:migrate',
    'db:seed',
  ];

  it.each(requiredScripts)('expose le script npm "%s"', (script) => {
    expect(packageJson.scripts?.[script]).toBeTruthy();
  });
});

describe('Vérification des types exécutable sur une copie neuve', () => {
  it('génère les types de routes Next avant de lancer tsc', () => {
    // Next 16 expose `LayoutProps`, `PageProps` et `RouteContext` comme types
    // globaux GÉNÉRÉS, écrits dans .next/types. Ce dossier est ignoré par git.
    //
    // Sur un poste où un serveur `next dev` tourne, ces types sont régénérés en
    // continu et `tsc` seul réussit. Sur une copie neuve, en CI notamment, ils
    // n'existent pas encore au moment du typecheck et `tsc` échoue avec
    // « Cannot find name 'LayoutProps' ».
    //
    // Le script doit donc rester autonome. Ne pas retirer `next typegen`.
    expect(packageJson.scripts?.typecheck).toContain('next typegen');
  });
});

describe('MVP-ENG-003 : TypeScript strict', () => {
  const tsconfig = readFileSync(resolve(process.cwd(), 'tsconfig.json'), 'utf8');

  it('active le mode strict', () => {
    expect(tsconfig).toContain('"strict": true');
  });

  it('interdit les accès indexés non vérifiés', () => {
    // Protège les boucles d'allocation de paiement et de répartition de charge,
    // où un index absent doit être un type `undefined`, pas un silence.
    expect(tsconfig).toContain('"noUncheckedIndexedAccess": true');
  });

  it('interdit les cas de switch qui tombent en cascade', () => {
    // Les machines à états (statuts de créance, d'incident, d'intervention) sont
    // spécifiées transition par transition : une cascade y est toujours un défaut.
    expect(tsconfig).toContain('"noFallthroughCasesInSwitch": true');
  });
});
