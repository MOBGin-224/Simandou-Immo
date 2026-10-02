/**
 * Pilote minimal du protocole Chrome DevTools, sans aucune dépendance (DEC-040).
 *
 * Node 24 fournit `WebSocket` et `fetch` nativement, ce qui compte sur une
 * machine où la mémoire manque : aucun Puppeteer, aucun Playwright à installer.
 *
 * Le point qui change tout est `Emulation.setDeviceMetricsOverride` : elle fixe le
 * viewport que la PAGE perçoit, donc les media queries répondent réellement, sans
 * que la taille de la fenêtre n'entre en jeu. Redimensionner la fenêtre du
 * navigateur n'est pas une méthode : au Lot 5, elle a refusé toute réduction.
 *
 * Ce module ne contient aucune règle de verdict. Il ouvre un navigateur, navigue,
 * évalue du code dans la page, touche l'écran et capture. Le jugement vit dans
 * `report.ts`, qui est testé.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

export type LaunchOptions = {
  chromePath: string;
  /** Profil jetable : supprimé puis recréé à chaque lancement. */
  profileDir: string;
  port?: number;
};

export type Browser = {
  /** Évalue une expression dans la page et en renvoie la valeur sérialisée. */
  evaluate: <T>(expression: string) => Promise<T>;
  setViewport: (width: number, height: number) => Promise<void>;
  goto: (url: string) => Promise<void>;
  waitForUrl: (predicate: (href: string) => boolean, timeoutMs?: number) => Promise<string>;
  /**
   * Touche l'écran au centre de l'élément désigné par une EXPRESSION JavaScript,
   * par exemple `document.querySelector('form button[type=submit]')`.
   *
   * Un vrai toucher et non `element.click()` : c'est la seule façon de vérifier
   * qu'une zone tactile étendue par un pseudo-élément est réellement atteignable.
   */
  tap: (elementExpression: string) => Promise<void>;
  /** Capture la page entière, pas seulement le viewport. */
  screenshot: (file: string) => Promise<void>;
  close: () => Promise<void>;
};

export async function launch({
  chromePath,
  profileDir,
  port = 9222,
}: LaunchOptions): Promise<Browser> {
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  mkdirSync(profileDir, { recursive: true });

  const proc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let exited = false;
  proc.on('exit', () => {
    exited = true;
  });

  let wsUrl: string | undefined;
  for (let attempt = 0; attempt < 60 && wsUrl === undefined && !exited; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as { type: string; webSocketDebuggerUrl: string }[];
      wsUrl = targets.find((target) => target.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      // Chrome n'écoute pas encore.
    }
    if (wsUrl === undefined) await sleep(250);
  }

  if (wsUrl === undefined) {
    proc.kill();
    throw new Error(
      exited
        ? `Chrome s'est arrêté au démarrage. Le port ${port} est-il déjà pris par un autre Chrome de test ?`
        : `Chrome n'a pas exposé de cible page sur le port ${port}.`,
    );
  }

  const socket = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('Connexion WebSocket au protocole CDP refusée.'));
  });

  let nextId = 1;
  const pending = new Map<number, Pending>();
  const listeners = new Map<string, ((params: unknown) => void)[]>();

  socket.onmessage = (event: MessageEvent) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: { message: string };
    };

    if (message.id !== undefined) {
      const waiting = pending.get(message.id);
      if (waiting === undefined) return;
      pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error.message));
      else waiting.resolve(message.result);
    } else if (message.method !== undefined) {
      for (const callback of listeners.get(message.method) ?? []) callback(message.params);
    }
  };

  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  const once = (method: string, timeoutMs = 15_000) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Délai dépassé en attendant ${method}.`)),
        timeoutMs,
      );
      const callback = () => {
        clearTimeout(timer);
        listeners.set(
          method,
          (listeners.get(method) ?? []).filter((candidate) => candidate !== callback),
        );
        resolve();
      };
      listeners.set(method, [...(listeners.get(method) ?? []), callback]);
    });

  await send('Page.enable');
  await send('Runtime.enable');

  const evaluate = async <T>(expression: string): Promise<T> => {
    const response = (await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })) as {
      result: { value: T };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    };

    if (response.exceptionDetails) {
      throw new Error(
        `Évaluation dans la page : ${response.exceptionDetails.exception?.description ?? response.exceptionDetails.text}`,
      );
    }
    return response.result.value;
  };

  return {
    evaluate,

    async setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    },

    async goto(url) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url });
      await loaded;
      // Laisse l'hydratation se terminer avant toute mesure.
      await sleep(700);
    },

    async waitForUrl(predicate, timeoutMs = 15_000) {
      const start = Date.now();
      for (;;) {
        const href = await evaluate<string>('location.href');
        if (predicate(href)) {
          await sleep(700);
          return href;
        }
        if (Date.now() - start > timeoutMs) {
          throw new Error(`URL attendue non atteinte, actuelle : ${href}`);
        }
        await sleep(150);
      }
    },

    async tap(elementExpression) {
      const point = await evaluate<{ x: number; y: number } | null>(`(() => {
        const el = ${elementExpression};
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);

      if (point === null)
        throw new Error(`Élément introuvable pour le toucher : ${elementExpression}`);

      await sleep(150);
      await send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: point.x, y: point.y }],
      });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },

    async screenshot(file) {
      const metrics = (await send('Page.getLayoutMetrics')) as {
        cssContentSize: { width: number; height: number };
      };
      const capture = (await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: Math.ceil(metrics.cssContentSize.width),
          height: Math.ceil(metrics.cssContentSize.height),
          scale: 1,
        },
      })) as { data: string };

      writeFileSync(file, Buffer.from(capture.data, 'base64'));
    },

    async close() {
      try {
        await send('Browser.close');
      } catch {
        // Déjà fermé.
      }
      try {
        socket.close();
      } catch {
        // Déjà fermé.
      }

      // Attend la fin réelle du processus : sous Windows, Chrome tient encore les
      // fichiers de son profil quelques instants après sa fermeture, et le
      // supprimer trop tôt échoue avec EPERM.
      const closed = new Promise<void>((resolve) => {
        if (exited) resolve();
        else proc.once('exit', () => resolve());
      });
      proc.kill();
      await Promise.race([closed, sleep(5_000)]);
    },
  };
}
