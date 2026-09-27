import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * Un paramètre préfixé d'un souligné est intentionnellement inutilisé.
       *
       * Le cas n'est pas théorique : la signature d'une Server Action utilisée avec
       * `useActionState` est imposée, `(étatPrécédent, formData)`, et l'archivage
       * d'un immeuble n'a besoin d'aucun des deux. Renommer ne change rien à
       * l'obligation de les déclarer.
       */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
