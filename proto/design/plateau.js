/* QIDIGO — rendu SVG de référence du plateau (prototype, non optimisé).
 * Toutes les couleurs viennent des variables CSS (tokens.css) via les classes de composants.css :
 * changer de piste = changer data-theme sur un ancêtre ("goban" par défaut, "nuit").
 * Coordonnées : croisement (x, y), 0 ≤ x < nx, origine en haut à gauche. Case (x, y) = carré entre (x,y) et (x+1,y+1).
 * Camps : "n" = Noir, "b" = Blanc. Module ES (le prototype est en "type": "module").
 * Usage : import { plateauSVG } from './design/plateau.js'; el.innerHTML = plateauSVG({ n: 9, pitch: 44, margin: 19, pions: [...] });
 */
let UID = 0;
export function plateauSVG(o) {
    const nx = o.nx || o.n || 9, ny = o.ny || o.n || 9;
    const p = o.pitch || 44, m = o.margin == null ? 19 : o.margin;
    const W = o.width || (m * 2 + (nx - 1) * p), H = o.height || (m * 2 + (ny - 1) * p);
    const id = 'q' + (++UID);
    const X = x => m + x * p, Y = y => m + y * p;
    const wall = o.wall !== false;
    const pd = o.pionD || Math.round(p * 0.70);
    const out = [];
    out.push(`<svg class="q-board ${o.cls || ''}" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || 'Plateau QIDIGO'}">`);
    // défs : motifs de zone et dégradés de pions, propres à cette instance (les couleurs héritent du thème de l'ancêtre)
    out.push(`<defs>
      <pattern id="${id}-hn" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="q-motif q-motif--n" x1="0" y1="0" x2="0" y2="6"/></pattern>
      <pattern id="${id}-db" width="6" height="6" patternUnits="userSpaceOnUse"><circle class="q-motif q-motif--b" cx="3" cy="3" r="1.15"/></pattern>
      <radialGradient id="${id}-gn" cx="35%" cy="30%" r="75%"><stop offset="0" class="q-st-n-hi"/><stop offset="1" class="q-st-n"/></radialGradient>
      <radialGradient id="${id}-gb" cx="38%" cy="32%" r="78%"><stop offset=".55" class="q-st-b"/><stop offset="1" class="q-st-b-lo"/></radialGradient>
      <clipPath id="${id}-loupe"><circle r="${o.loupeR || 42}"/></clipPath>
    </defs>`);
    out.push(`<g id="${id}-c">`);
    out.push(`<rect class="q-board-bg" x="0" y="0" width="${W}" height="${H}"/>`);
    // zones (sous la grille)
    for (const z of o.zones || []) {
      const d = z.cells.map(([x, y]) => `M${X(x)} ${Y(y)}h${p}v${p}h${-p}z`).join('');
      const pat = z.c === 'n' ? `${id}-hn` : z.c === 'b' ? `${id}-db` : null;
      out.push(`<g class="q-zone q-zone--${z.c}${z.anim ? ' q-zone--new' : ''}${z.apercu ? ' q-zone--apercu' : ''}"><path class="q-zone-wash" d="${d}"/>${pat ? `<path d="${d}" fill="url(#${pat})"/>` : ''}</g>`);
    }
    // grille
    let g = '';
    for (let x = 0; x < nx; x++) g += `M${X(x)} ${Y(0) - (o.bleed ? p / 2 : 0)}V${Y(ny - 1) + (o.bleed ? p / 2 : 0)}`;
    for (let y = 0; y < ny; y++) g += `M${X(0) - (o.bleed ? p / 2 : 0)} ${Y(y)}H${X(nx - 1) + (o.bleed ? p / 2 : 0)}`;
    out.push(`<path class="q-grid" d="${g}"/>`);
    if (wall) out.push(`<rect class="q-wall" x="${X(0)}" y="${Y(0)}" width="${(nx - 1) * p}" height="${(ny - 1) * p}"/>`);
    for (const [x, y] of o.hoshi || []) out.push(`<circle class="q-hoshi" cx="${X(x)}" cy="${Y(y)}" r="2"/>`);
    // zones tactiles (illustration)
    for (const h of o.hits || []) out.push(`<rect class="q-hit${h.on ? ' q-hit--on' : ''}" x="${X(h.x) - p / 2 + .5}" y="${Y(h.y) - p / 2 + .5}" width="${p - 1}" height="${p - 1}" rx="6"/>`);
    // marqueurs de croisements contrôlés
    for (const c of o.controles || []) out.push(`<rect class="q-ctrl q-ctrl--${c.c}" x="${X(c.x) - 3.5}" y="${Y(c.y) - 3.5}" width="7" height="7" rx="1.5"/>`);
    const path = pts => 'M' + pts.map(([x, y]) => `${X(x)} ${Y(y)}`).join('L');
    const len = pts => pts.slice(1).reduce((s, q, i) => s + (Math.abs(q[0] - pts[i][0]) + Math.abs(q[1] - pts[i][1])) * p, 0);
    // traces (tours précédents) et murs (traces qui bordent une zone)
    for (const t of o.traces || []) {
      const k = t.mur ? 'q-mur' : 'q-trace';
      out.push(`<g class="q-path ${k} q-path--${t.c}"><path class="q-casing" d="${path(t.pts)}"/><path class="q-core" d="${path(t.pts)}"/></g>`);
    }
    // trajets révélés (exécution)
    for (const t of o.reveles || []) {
      out.push(`<g class="q-path q-revele q-path--${t.c}" style="--len:${len(t.pts)}"><path class="q-casing" d="${path(t.pts)}"/><path class="q-core" d="${path(t.pts)}"/></g>`);
    }
    // interdits (croisements de zone adverse, Q14 a)
    for (const [x, y] of o.interdits || []) out.push(`<path class="q-interdit" d="M${X(x) - 4} ${Y(y) - 4}l8 8M${X(x) + 4} ${Y(y) - 4}l-8 8"/>`);
    // pions
    const pion = (x, y, c, extra = '') => {
      const cls = `q-pion q-pion--${c} ${extra}`;
      return `<g class="${cls}" transform="translate(${X(x)} ${Y(y)})"><circle class="q-pion-sel" r="${pd / 2 + 5}"/><circle class="q-pion-ombre" cy="1.6" r="${pd / 2 + .4}"/><circle class="q-pion-body" r="${pd / 2}" fill="url(#${id}-g${c})"/></g>`;
    };
    // trajet validé (mon ordre enregistré, avant révélation)
    if (o.valide) out.push(`<g class="q-path q-valide"><path class="q-casing" d="${path(o.valide.pts)}"/><path class="q-core" d="${path(o.valide.pts)}"/><circle class="q-valide-end" cx="${X(o.valide.pts.at(-1)[0])}" cy="${Y(o.valide.pts.at(-1)[1])}" r="5"/></g>`);
    // trajet en cours de tracé
    if (o.encours) out.push(`<g class="q-path q-encours"><path class="q-casing" d="${path(o.encours.pts)}"/><path class="q-core" d="${path(o.encours.pts)}"/></g>`);
    for (const q of o.pions || []) out.push(pion(q.x, q.y, q.c, (q.sel ? 'q-pion--sel ' : '') + (q.ghost ? 'q-pion--ghost ' : '') + (q.capt ? 'q-pion--capt ' : '')));
    // coupure : deux trajets + point de coupure
    if (o.coupure) {
      const k = o.coupure;
      for (const t of k.trajets) out.push(`<g class="q-path q-coupe q-path--${t.c}" ${k.frame != null ? `style="--f:${k.frame}"` : ''}><path class="q-casing" d="${path(t.pts)}"/><path class="q-core" d="${path(t.pts)}"/></g>`);
      const [cx, cy] = [X(k.at[0]), Y(k.at[1])];
      out.push(`<g class="q-cut-mark" transform="translate(${cx} ${cy})" ${k.frame != null ? `style="--f:${k.frame}"` : ''}><circle class="q-cut-burst" r="20"/><g class="q-cut-x"><circle r="9"/><path d="M-4 -4L4 4M4 -4L-4 4"/></g></g>`);
    }
    out.push(`</g>`);
    // doigt + loupe décalée (C49)
    if (o.doigt) {
      const [fx, fy] = [X(o.doigt[0]), Y(o.doigt[1])];
      out.push(`<circle class="q-doigt" cx="${fx}" cy="${fy}" r="22"/>`);
      if (o.loupe) {
        const R = o.loupeR || 42, ly = fy - 86, s = 1.7;
        out.push(`<g class="q-loupe" transform="translate(${fx} ${ly})"><g clip-path="url(#${id}-loupe)"><use href="#${id}-c" transform="scale(${s}) translate(${-fx} ${-fy})"/></g><circle class="q-loupe-ring" r="${R}"/><circle class="q-loupe-pt" r="3"/></g>`);
      }
    }
    out.push(`</svg>`);
    return out.join('');
  }
