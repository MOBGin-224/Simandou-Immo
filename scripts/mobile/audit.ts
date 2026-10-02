import type { PageAudit } from './report';

/**
 * Mesures exécutées DANS la page (DEC-040), car une capture d'écran montre ce qui
 * va mal sans le nommer. Trois familles de défauts, celles qu'a trouvées le Lot 5 :
 *
 *   débordement horizontal   la page, puis élément par élément
 *   cible tactile            boîte de l'élément, puis zone réellement atteignable
 *   texte coupé              scrollWidth d'un élément comparé à son clientWidth
 *
 * Le script est une CHAÎNE et non une fonction compilée : l'outil de transpilation
 * ajoute des aides au corps d'une fonction, qui n'existent pas dans le navigateur
 * et font échouer l'évaluation.
 *
 * Pour une petite cible, la boîte ne suffit pas. On sonde `elementFromPoint` de
 * part et d'autre du centre afin de mesurer ce qu'un doigt atteint vraiment, car
 * un pseudo-élément peut étendre la zone cliquable d'un lien à toute sa carte.
 */
export const auditScript = (width: number): string => `(() => {
  const MIN = 44;
  const W = ${width};
  const out = {
    vw: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    overflowX: [],
    targets: [],
    clipped: [],
    tinyText: [],
    counts: [],
    h1: null,
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const label = (el) => {
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '')
      .trim().replace(/\\s+/g, ' ').slice(0, 42);
    return el.tagName.toLowerCase() + ' "' + t + '"';
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };

  // 1. Débordement horizontal
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) {
      out.overflowX.push({
        el: label(el),
        left: Math.round(r.left),
        right: Math.round(r.right),
        inScroller: inScroller(el),
      });
    }
  }

  // 2. Cibles tactiles : boîte de l'élément, PUIS zone réellement atteignable
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]';
  const reach = (el, axis) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = (x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const t = document.elementFromPoint(x, y);
      if (!t) return false;
      if (t === el || el.contains(t)) return true;
      // Un contrôle de formulaire s'atteint aussi par son LIBELLÉ : toucher le texte
      // d'une case à cocher la coche. Sa vraie zone tactile est donc celle du libellé,
      // pas celle des 20 pixels de la case.
      const labels = el.labels ? Array.from(el.labels) : [];
      return labels.some((label) => label === t || label.contains(t));
    };
    let a = 0;
    let b = 0;
    while (a < 120 && hit(axis === 'x' ? cx - a - 1 : cx, axis === 'x' ? cy : cy - a - 1)) a++;
    while (b < 120 && hit(axis === 'x' ? cx + b + 1 : cx, axis === 'x' ? cy : cy + b + 1)) b++;
    return a + b + 1;
  };
  for (const el of document.querySelectorAll(SEL)) {
    if (!visible(el)) continue;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const entry = {
      el: label(el),
      w: Math.round(r.width),
      h: Math.round(r.height),
      inline: getComputedStyle(el).display === 'inline',
    };
    if (r.height < MIN || r.width < MIN) {
      entry.hitW = reach(el, 'x');
      entry.hitH = reach(el, 'y');
    }
    out.targets.push(entry);
  }
  window.scrollTo(0, 0);

  // 3. Texte coupé, hors zones défilantes voulues et hors texte masqué visuellement
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    // Un élément réduit à un pixel est le motif « réservé aux lecteurs d'écran » :
    // il est coupé exprès, ce n'est pas un défaut.
    if (el.clientWidth <= 1 && el.clientHeight <= 1) continue;
    const cs = getComputedStyle(el);
    const clipX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const clipY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if (clipX && el.scrollWidth > el.clientWidth + 1) {
      out.clipped.push({
        el: label(el),
        axis: 'x',
        scroll: el.scrollWidth,
        client: el.clientWidth,
        ellipsis: cs.textOverflow === 'ellipsis',
      });
    }
    if (clipY && el.scrollHeight > el.clientHeight + 1 && el.children.length === 0) {
      out.clipped.push({ el: label(el), axis: 'y', scroll: el.scrollHeight, client: el.clientHeight });
    }
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own && parseFloat(cs.fontSize) < 12) {
      out.tinyText.push({ el: label(el), size: cs.fontSize });
    }
  }

  // 4. Décomptes annoncés, pour confronter « 16 logements » à la réalité de la liste
  const text = document.body.innerText;
  for (const m of text.matchAll(/[^\\n]*\\b\\d+[ \\u00a0]+(logements?|appartements?)[^\\n]*/gi)) {
    out.counts.push(m[0].trim().slice(0, 90));
  }
  out.h1 = (document.querySelector('h1') || {}).innerText || null;
  return JSON.stringify(out);
})()`;

/** Ce que renvoie le script ; le lanceur y ajoute l'étiquette, la largeur et l'adresse. */
export type RawAudit = Omit<PageAudit, 'label' | 'width' | 'url'>;
