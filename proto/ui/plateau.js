// Rendu SVG du plateau (via le moteur de rendu du designer, design/plateau.js)
// et saisie des ordres au doigt : tap = poser, glisser depuis un pion = trajet le long des traits.

import { plateauSVG } from '../design/plateau.js';
import {
  coord, indice, sontAdjacents, cheminDroit, coordCase, croisementsControles, validerOrdre, deplacer, poser, longueurMax,
} from '../engine/index.js';

/** Camp graphique du designer : A = Noir (« n »), B = Blanc (« b »). */
export const CAMP = { A: 'n', B: 'b' };

/**
 * Espacement selon la largeur disponible (règle du designer, design/tokens.css) :
 * pitch = min(56, floor((largeur − 2 × 16) / (N − 1))) ; marge = (largeur − (N − 1) × pitch) / 2.
 */
export function geometrie(largeur, n) {
  const pitch = Math.max(24, Math.min(56, Math.floor((largeur - 32) / (n - 1))));
  const margin = Math.max(16, (largeur - (n - 1) * pitch) / 2);
  return { pitch, margin, taille: margin * 2 + (n - 1) * pitch };
}

const pt = (n, c) => {
  const { x, y } = coord(n, c);
  return [x, y];
};

/**
 * Options de plateauSVG à partir de l'état et de la vue.
 * vue = { phase, joueur, proposition, chemin (glissement en cours), doigt, dernier (dernier tour) }
 */
export function optionsPlateau(etat, vue, geo) {
  const n = etat.params.grille;
  const o = { n, pitch: geo.pitch, margin: geo.margin, width: geo.taille, height: geo.taille };

  // Zones possédées.
  const zones = { A: [], B: [] };
  etat.proprietaires.forEach((p, k) => {
    if (p) {
      const { i, j } = coordCase(n, k);
      zones[p].push([i, j]);
    }
  });
  o.zones = ['A', 'B'].filter((j) => zones[j].length).map((j) => ({ c: CAMP[j], cells: zones[j] }));

  // Croisements contrôlés (petits marqueurs), seulement si le score se compte en croisements :
  // en cases (défaut, décision Lomig 03/11), le territoire hachuré suffit.
  const ctrl = etat.params.comptage === 'cases' ? { A: [], B: [] } : croisementsControles(etat);
  o.controles = ['A', 'B'].flatMap((j) => ctrl[j].map((c) => ({ c: CAMP[j], ...coord(n, c) })));

  // Traces : chaque segment coloré.
  // choix proto (CDP 03/11) : traces dessinées en « mur » si le réglage `traces` vaut bord_de_zone
  // (elles bornent les zones), en « décor » (trace atténuée) si elles sont décoratives.
  // choix proto (CDP 03/11) : pas de signal particulier pour une trace recolorée.
  const enMur = etat.params.traces === 'bord_de_zone';
  o.traces = Object.entries(etat.couleurs).map(([s, j]) => {
    const [a, b] = s.split('-').map(Number);
    return { c: CAMP[j], pts: [pt(n, a), pt(n, b)], mur: enMur };
  });

  // Pions posés.
  const pions = [];
  for (const j of ['A', 'B']) for (const c of etat.pions[j]) pions.push({ ...coord(n, c), c: CAMP[j], idx: c, j });

  // Ordre secret du joueur courant (seulement pendant sa saisie).
  if (vue.phase === 'saisie' && vue.proposition?.type === 'lot') {
    // Mode « un ordre par pion » : tous les ordres du lot (le trajet en cours de tracé remplace celui du même pion).
    const glisse = vue.chemin && vue.chemin.length > 1 ? vue.chemin : null;
    if (glisse) o.encours = { pts: glisse.map((c) => pt(n, c)) };
    const ordres = vue.proposition.ordres.filter((x) => !(glisse && x.type === 'deplacer' && x.chemin[0] === glisse[0]));
    const deps = ordres.filter((x) => x.type === 'deplacer');
    if (deps.length) o.valide = { pts: deps[0].chemin.map((c) => pt(n, c)) };
    for (const x of ordres) if (x.type === 'poser') pions.push({ ...coord(n, x.croisement), c: CAMP[vue.joueur], ghost: true });
    const aOrdre = new Set(deps.map((x) => x.chemin[0]));
    for (const q of pions) if (aOrdre.has(q.idx) || q.idx === vue.chemin?.[0] || (q.ghost && q.c === CAMP[vue.joueur])) q.sel = true;
    if (vue.apercu) {
      if (vue.apercu.cells.length) o.zones.push({ c: CAMP[vue.joueur], cells: vue.apercu.cells, apercu: true });
      for (const q of pions) if (vue.apercu.captures.includes(q.idx)) q.capt = true;
    }
    if (vue.doigt) {
      o.doigt = vue.doigt;
      o.loupe = true;
    }
  } else if (vue.phase === 'saisie') {
    const prop = vue.proposition;
    if (vue.chemin && vue.chemin.length > 1) o.encours = { pts: vue.chemin.map((c) => pt(n, c)) };
    else if (prop?.type === 'deplacer') o.valide = { pts: prop.chemin.map((c) => pt(n, c)) };
    if (prop?.type === 'poser') pions.push({ ...coord(n, prop.croisement), c: CAMP[vue.joueur], ghost: true });
    const depart = vue.chemin?.[0] ?? (prop?.type === 'deplacer' ? prop.chemin[0] : null);
    for (const q of pions) {
      if (q.idx === depart) q.sel = true;
      if (prop?.type === 'deplacer' && prop.soutien === q.idx) q.sel = true;
    }
    // choix proto (CDP 03/11) : aperçu de fermeture calculé sur le téléphone avec le même moteur
    // (zones en pointillé, pions qui seraient capturés). L'ordre adverse est inconnu : on suppose « Passer ».
    if (vue.apercu) {
      if (vue.apercu.cells.length) o.zones.push({ c: CAMP[vue.joueur], cells: vue.apercu.cells, apercu: true });
      for (const q of pions) if (vue.apercu.captures.includes(q.idx)) q.capt = true;
    }
    if (vue.doigt) {
      o.doigt = vue.doigt;
      o.loupe = true;
    }
  }

  // Résolution du dernier tour : trajets révélés et coupures.
  if ((vue.phase === 'resultat' || vue.phase === 'fin') && vue.dernier) {
    o.reveles = vue.dernier.reussis.map(({ j, chemin }) => ({ c: CAMP[j], pts: chemin.map((c) => pt(n, c)) }));
    // choix proto (CDP 03/11) : une pose annulée a le même visuel que la coupure (croix + dissolution),
    // avec un pion fantôme à l'endroit visé.
    for (const { j, croisement } of vue.dernier.posesAnnulees) pions.push({ ...coord(n, croisement), c: CAMP[j], ghost: true });
    if (vue.dernier.pointCoupure != null) {
      o.coupure = {
        trajets: vue.dernier.coupes.map(({ j, chemin }) => ({ c: CAMP[j], pts: chemin.map((c) => pt(n, c)) })),
        at: pt(n, vue.dernier.pointCoupure),
      };
    }
  }
  o.pions = pions;
  o.label = `Plateau ${n} × ${n}`;
  return o;
}

/**
 * Analyse le dernier tour de l'historique pour l'affichage : trajets réussis et coupés.
 */
export function analyserDernierTour(etatApres) {
  const h = etatApres.historique[etatApres.historique.length - 1];
  if (!h) return null;
  const reussis = [];
  const coupes = [];
  const posesAnnulees = [];
  for (const j of ['A', 'B']) {
    const o = h.ordres[j];
    if (o?.type === 'lot') {
      // Mode « un ordre par pion » : chaque ordre du lot, reconnu à son trajet ou à son croisement.
      for (const x of o.ordres) {
        if (x.type === 'deplacer') {
          const ok = h.journal.some((e) => e.code === 'DEPLACEMENT' && e.joueur === j && e.chemin?.join('.') === x.chemin.join('.'));
          (ok ? reussis : coupes).push({ j, chemin: x.chemin });
        } else if (x.type === 'poser' && !h.journal.some((e) => e.code === 'POSE' && e.joueur === j && e.croisement === x.croisement)) {
          posesAnnulees.push({ j, croisement: x.croisement });
        }
      }
    } else if (o?.type === 'deplacer') {
      const ok = h.journal.some((e) => e.code === 'DEPLACEMENT' && e.joueur === j);
      (ok ? reussis : coupes).push({ j, chemin: o.chemin });
    } else if (o?.type === 'poser') {
      if (!h.journal.some((e) => e.code === 'POSE' && e.joueur === j)) posesAnnulees.push({ j, croisement: o.croisement });
    }
  }
  // Point de la croix : la pose annulée, sinon le premier croisement commun aux deux trajets, sinon le 2e croisement.
  let pointCoupure = null;
  if (posesAnnulees.length) pointCoupure = posesAnnulees[0].croisement;
  else if (coupes.length) {
    const t = coupes[0].chemin;
    const autre = coupes[1]?.chemin || [];
    pointCoupure = t.slice(1).find((c) => autre.includes(c)) ?? t[t.length - 1];
  }
  // décision Lomig 03/11 : cases reprises à l'adversaire à ce tour (pour l'animation).
  const reprises = h.journal.filter((e) => e.code === 'REPRISE').map((e) => ({ j: e.joueur, cases: e.cases || [] }));
  return { reussis, coupes, posesAnnulees, pointCoupure, reprises };
}

/**
 * Installe la saisie au doigt sur le conteneur (Pointer Events, aimantation aux croisements).
 * rappels = { etat(), joueur(), actif(), geo(), surChemin(chemin, doigt), surOrdre(ordre|null, raison?), surTapPion(c) }
 */
export function installerSaisie(conteneur, rappels) {
  // Validation d'un tracé : seul (mode joueur) ou avec les autres ordres du lot (mode pion, rappel `validerTrace`).
  const valTrace = (etat, moi, ch) => (rappels.validerTrace ? rappels.validerTrace(ch) : validerOrdre(etat, moi, deplacer(ch)));
  let glisse = null; // { chemin, depart, bouge, pointerId }

  const versGrille = (ev) => {
    const svg = conteneur.querySelector('svg');
    const r = svg.getBoundingClientRect();
    const g = rappels.geo();
    const echelle = g.taille / r.width;
    return { gx: ((ev.clientX - r.left) * echelle - g.margin) / g.pitch, gy: ((ev.clientY - r.top) * echelle - g.margin) / g.pitch };
  };
  // Croisement le plus proche si le doigt est à moins de `rayon` pas (aimantation).
  const proche = (gx, gy, rayon) => {
    const n = rappels.etat().params.grille;
    const x = Math.round(gx);
    const y = Math.round(gy);
    if (x < 0 || y < 0 || x >= n || y >= n) return -1;
    return Math.hypot(gx - x, gy - y) <= rayon ? indice(n, x, y) : -1;
  };

  conteneur.addEventListener('pointerdown', (ev) => {
    if (!rappels.actif()) return;
    ev.preventDefault();
    const { gx, gy } = versGrille(ev);
    const c = proche(gx, gy, 0.5);
    if (c < 0) return;
    conteneur.setPointerCapture?.(ev.pointerId);
    const etat = rappels.etat();
    const moi = rappels.joueur();
    glisse = { chemin: [c], depart: c, bouge: false, pointerId: ev.pointerId, surPion: etat.pions[moi].includes(c) };
    if (glisse.surPion) rappels.surChemin(glisse.chemin, [gx, gy]);
  });

  conteneur.addEventListener('pointermove', (ev) => {
    if (!glisse || ev.pointerId !== glisse.pointerId || !glisse.surPion) return;
    ev.preventDefault();
    const { gx, gy } = versGrille(ev);
    const c = proche(gx, gy, 0.42);
    const ch = glisse.chemin;
    const etat = rappels.etat();
    const n = etat.params.grille;
    if (c >= 0 && c !== ch[ch.length - 1]) {
      if (ch.length >= 2 && c === ch[ch.length - 2]) {
        ch.pop(); // retour en arrière : on efface le dernier segment
      } else {
        const pas = sontAdjacents(n, ch[ch.length - 1], c) ? [c] : cheminDroit(n, ch[ch.length - 1], c) || [];
        for (const s of pas) {
          const essai = [...ch, s];
          // On n'ajoute un segment que si le trajet reste valide (le moteur décide).
          // décision Lomig 03/11 : à trajet_max segments, le tracé ne s'allonge plus (on peut reculer).
          if (valTrace(etat, rappels.joueur(), essai).ok) ch.push(s);
          else break;
        }
      }
      glisse.bouge = true;
    }
    rappels.surChemin(ch, [gx, gy]);
  });

  const finir = (ev) => {
    if (!glisse || ev.pointerId !== glisse.pointerId) return;
    const g = glisse;
    glisse = null;
    const etat = rappels.etat();
    const moi = rappels.joueur();
    if (g.surPion && g.chemin.length >= 2) {
      const v = valTrace(etat, moi, g.chemin);
      rappels.surChemin(null, null);
      rappels.surOrdre(v.ok ? v.ordre : null, v.ok ? null : v.raison);
      return;
    }
    rappels.surChemin(null, null);
    if (ev.type === 'pointercancel') return;
    if (g.surPion) {
      rappels.surTapPion(g.depart);
      return;
    }
    // Tap sur un croisement : poser.
    const v = validerOrdre(etat, moi, poser(g.depart));
    rappels.surOrdre(v.ok ? v.ordre : null, v.ok ? null : v.raison, true);
  };
  conteneur.addEventListener('pointerup', finir);
  conteneur.addEventListener('pointercancel', finir);
}

/**
 * Compteur de pas près du doigt pendant le glissement : « 3/5 », ou « 3 » si trajet_max = illimité.
 * décision Lomig 03/11 : la limite (5 par défaut) doit se voir ; à la limite, le compteur passe en accent.
 * `zone` = conteneur positionné qui reçoit la pastille ; `doigt` en coordonnées de grille.
 */
export function afficherCompteurPas(zone, plateau, etat, chemin, doigt, geo) {
  let el = zone.querySelector('.ui-pas');
  if (!chemin || chemin.length < 1 || !doigt) {
    if (el) el.hidden = true;
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.className = 'ui-pas';
    el.setAttribute('aria-live', 'polite');
    zone.appendChild(el);
  }
  const pas = chemin.length - 1;
  const max = longueurMax(etat.params);
  const auMax = Number.isFinite(max) && pas >= max;
  el.innerHTML = Number.isFinite(max)
    ? `<b>${pas}</b><small>/${max}</small>${auMax ? '<em>max</em>' : ''}`
    : `<b>${pas}</b><small> pas</small>`;
  el.classList.toggle('is-max', auMax);
  el.hidden = false;
  // Position : à côté de la loupe (au-dessus du doigt), côté opposé au bord le plus proche.
  const svg = plateau.querySelector('svg');
  const rz = zone.getBoundingClientRect();
  const rs = svg.getBoundingClientRect();
  const s = rs.width / geo.taille;
  const fx = rs.left - rz.left + (geo.margin + doigt[0] * geo.pitch) * s;
  const fy = rs.top - rz.top + (geo.margin + doigt[1] * geo.pitch) * s;
  const w = el.offsetWidth || 64;
  const h = el.offsetHeight || 32;
  let x = fx + 56 * s;
  if (x + w > rz.width - 4) x = fx - 56 * s - w;
  const y = Math.max(4, fy - 86 * s - h / 2);
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

/** Dessine le plateau (rendu du designer + lien de soutien en surimpression). */
export function dessinerPlateau(conteneur, etat, vue, geo) {
  let svg = plateauSVG(optionsPlateau(etat, vue, geo));
  // choix proto (CDP 03/11) : lien de soutien en pointillé, seulement si la variante est active.
  const prop = vue.proposition;
  if (vue.phase === 'saisie' && etat.params.soutien === 'oui' && prop?.type === 'deplacer' && prop.soutien != null) {
    const n = etat.params.grille;
    const X = (c) => geo.margin + coord(n, c).x * geo.pitch;
    const Y = (c) => geo.margin + coord(n, c).y * geo.pitch;
    const a = prop.soutien;
    const b = prop.chemin[0];
    svg = svg.replace(/<\/svg>$/, `<path class="ui-soutien" d="M${X(a)} ${Y(a)}L${X(b)} ${Y(b)}"/></svg>`);
  }
  // décision Lomig 03/11 : les cases reprises clignotent (couleur du nouveau propriétaire), puis
  // gardent un liseré accent. Jetons Goban ; prefers-reduced-motion -> pas d'animation (style.css).
  if ((vue.phase === 'resultat' || vue.phase === 'fin') && vue.dernier?.reprises?.length) {
    const n = etat.params.grille;
    const p = geo.pitch;
    const rects = vue.dernier.reprises
      .flatMap(({ j, cases }) => cases.map((k) => {
        const { i, j: jj } = coordCase(n, k);
        const x = geo.margin + i * p;
        const y = geo.margin + jj * p;
        return `<rect class="ui-reprise ui-reprise--${CAMP[j]}" x="${x}" y="${y}" width="${p}" height="${p}"/>`
          + `<rect class="ui-reprise-cadre" x="${x + 2}" y="${y + 2}" width="${p - 4}" height="${p - 4}" rx="3"/>`;
      }))
      .join('');
    svg = svg.replace(/<\/svg>$/, `<g class="ui-reprises" aria-hidden="true">${rects}</g></svg>`);
  }
  // Mode « un ordre par pion » : les trajets du lot après le premier (le rendu du designer n'en trace qu'un),
  // insérés sous les pions avec les mêmes classes Goban, et un numéro d'ordre près de chaque pion qui en a un.
  if (vue.phase === 'saisie' && prop?.type === 'lot') {
    const n = etat.params.grille;
    const X = (c) => geo.margin + coord(n, c).x * geo.pitch;
    const Y = (c) => geo.margin + coord(n, c).y * geo.pitch;
    const glisse = vue.chemin && vue.chemin.length > 1 ? vue.chemin : null;
    const ordres = prop.ordres.filter((x) => !(glisse && x.type === 'deplacer' && x.chemin[0] === glisse[0]));
    const deps = ordres.filter((x) => x.type === 'deplacer');
    const d = (ch) => ch.map((c, k) => `${k ? 'L' : 'M'}${X(c)} ${Y(c)}`).join('');
    const autres = deps.slice(1).map((x) => `<g class="q-path q-valide"><path class="q-casing" d="${d(x.chemin)}"/><path class="q-core" d="${d(x.chemin)}"/><circle class="q-valide-end" cx="${X(x.chemin.at(-1))}" cy="${Y(x.chemin.at(-1))}" r="5"/></g>`).join('');
    if (autres) {
      const i = svg.indexOf('<g class="q-pion');
      svg = i >= 0 ? svg.slice(0, i) + autres + svg.slice(i) : svg.replace(/<\/svg>$/, `${autres}</svg>`);
    }
    const r = geo.pitch * 0.2;
    const badges = ordres.map((x, k) => {
      const c = x.type === 'deplacer' ? x.chemin[0] : x.croisement;
      const bx = X(c) + geo.pitch * 0.3, by = Y(c) - geo.pitch * 0.3;
      return `<g class="ui-num-ordre"><circle cx="${bx}" cy="${by}" r="${r}"/><text x="${bx}" y="${by}" font-size="${r * 1.3}">${k + 1}</text></g>`;
    }).join('');
    svg = svg.replace(/<\/svg>$/, `<g class="ui-nums-ordres" aria-hidden="true">${badges}</g></svg>`);
  }
  conteneur.innerHTML = svg;
}
