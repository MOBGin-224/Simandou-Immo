import { z } from 'zod';

/**
 * Validation des variables d'environnement.
 *
 * Principe : échouer au démarrage avec un message lisible, plutôt que de
 * laisser une variable manquante produire une erreur obscure au premier accès
 * à la base.
 *
 * Règle de périmètre : ne valider que les variables réellement lues par le
 * code. Exiger un secret dont aucun module ne se sert forcerait à inventer une
 * valeur, ce qui affaiblit la validation au lieu de la renforcer. Les variables
 * des lots suivants sont listées dans `.env.example` et rejoindront ce schéma
 * avec leur usage.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL est requise')
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'postgres:' || protocol === 'postgresql:';
      } catch {
        return false;
      }
    }, 'DATABASE_URL doit être une URL PostgreSQL, par exemple postgresql://user:pass@localhost:5432/base'),

  APP_URL: z.url('APP_URL doit être une URL absolue, par exemple http://localhost:3000'),

  /**
   * Signature des sessions et des jetons (ADR-006). Une rotation invalide
   * toutes les sessions en cours : c'est un levier de sécurité, à utiliser
   * sciemment.
   *
   * 32 caractères au minimum. Un secret court est la faiblesse qui rend
   * l'ensemble du mécanisme de session attaquable, d'où un refus au démarrage
   * plutôt qu'un avertissement ignoré.
   */
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET doit faire au moins 32 caractères'),

  /**
   * URL canonique utilisée par Better Auth (ADR-006). Vaut normalement APP_URL,
   * mais reste distincte : derrière un proxy, l'URL vue par le navigateur n'est
   * pas toujours celle de l'application.
   */
  BETTER_AUTH_URL: z.url(
    'BETTER_AUTH_URL doit être une URL absolue, par exemple http://localhost:3000',
  ),

  /**
   * Durée de validité d'un lien d'invitation, en jours (DEC-045, BR-012).
   *
   * Facultative : 7 jours sans valeur. Les bornes évitent deux erreurs de
   * configuration réelles. Un zéro, ou une valeur négative, rendrait toute
   * invitation expirée avant même d'être copiée. Un très grand nombre ferait d'un
   * lien oublié un accès durable, ce qui contredit l'intérêt d'une expiration.
   *
   * Lue à l'émission d'une invitation puis figée dans sa ligne : modifier la
   * variable n'altère pas les invitations déjà émises.
   */
  INVITATION_TTL_DAYS: z.coerce
    .number('INVITATION_TTL_DAYS doit être un nombre de jours, par exemple 7')
    .int('INVITATION_TTL_DAYS doit être un nombre entier de jours')
    .min(1, 'INVITATION_TTL_DAYS doit valoir au moins 1 jour')
    .max(30, 'INVITATION_TTL_DAYS ne peut pas dépasser 30 jours')
    .default(7),

  /**
   * Secret des routes internes `/internal/*` (DEC-028).
   *
   * FACULTATIVE en développement et en test, OBLIGATOIRE en production, et les
   * deux refus qu'elle évite ne sont pas les mêmes. Sans elle, une machine de
   * développement devrait inventer un secret pour simplement démarrer le
   * produit, alors qu'aucune plateforme n'y déclenche de job. En production au
   * contraire, son absence voudrait dire que les échéances de loyer ne sont
   * jamais générées, ce qui est une panne silencieuse du cœur financier : le
   * démarrage échoue plutôt que de laisser croire que tout va bien.
   *
   * Quand elle est absente, la route interne refuse TOUT, y compris un appel
   * sans en-tête : une route de job ouverte parce que son secret n'est pas
   * configuré serait exactement la faille que la décision ferme.
   *
   * 32 caractères au minimum, comme le secret de session : un secret court rend
   * attaquable le seul contrôle qui protège ces routes.
   *
   * Une valeur VIDE vaut absence, et ce détail compte : `.env.example` porte la
   * ligne `INTERNAL_JOB_SECRET=` pour la rendre visible, et un fichier copié tel
   * quel transmettrait une chaîne vide. Sans cette équivalence, le produit
   * refuserait de démarrer en développement pour une variable facultative.
   */
  INTERNAL_JOB_SECRET: z
    .string()
    .transform((value) => (value.trim().length === 0 ? undefined : value))
    .pipe(z.string().min(32, 'INTERNAL_JOB_SECRET doit faire au moins 32 caractères').optional())
    .optional(),
});

/**
 * Contrôles qui portent sur PLUSIEURS variables à la fois.
 *
 * Hors du schéma d'objet parce qu'ils lisent `NODE_ENV` en même temps que la
 * variable contrôlée : une règle de champ ne voit que son propre champ.
 */
const envSchemaWithCrossChecks = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.INTERNAL_JOB_SECRET === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['INTERNAL_JOB_SECRET'],
      message:
        'INTERNAL_JOB_SECRET est requise en production : sans elle, les routes /internal/* refusent tout et les échéances de loyer ne sont jamais générées',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valide un jeu de variables et renvoie l'objet typé.
 *
 * Exposée séparément de `env` afin d'être testable sans dépendre du
 * `process.env` de la machine qui exécute les tests.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchemaWithCrossChecks.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuration d'environnement invalide.\n${details}\n\n` +
        'Copier .env.example en .env et renseigner les valeurs manquantes.',
    );
  }

  return result.data;
}

let cached: Env | undefined;

/**
 * Variables validées du processus courant.
 *
 * Lazy : la validation n'a lieu qu'au premier appel. Cela permet aux tests qui
 * n'ont pas besoin de base de données de ne jamais la déclencher.
 */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
