// Panneau Réglages : une carte par réglage (libellé, description tirée de regles-proto.md,
// état bien visible, valeur par défaut), bouton « Réglages par défaut ».
// Les réglages enregistrés s'appliquent à la PARTIE SUIVANTE (bouton Rejouer).

import { REGLAGES, parametresParDefaut, normaliserParametres, seuilCroisements } from '../engine/index.js';

const CLE = 'qidigo-proto:reglages';

/** Réglages d'interface (hors moteur). */
export const REGLAGES_UI = [
  { id: 'mode', libelle: 'Mode de jeu', defaut: 'ia', valeurs: [['ia', 'Contre l’IA (faible)'], ['deux', 'À deux sur ce téléphone']],
    description: 'Contre l’IA : vous jouez A (noir), l’IA joue B (blanc) au hasard, toujours légalement. À deux : on se passe l’appareil ; un écran masque l’ordre de l’autre.' },
];

export function reglagesParDefaut() {
  return { params: parametresParDefaut(), ui: Object.fromEntries(REGLAGES_UI.map((r) => [r.id, r.defaut])), graine: '' };
}

/** Lit les réglages enregistrés (ou les défauts). */
export function chargerReglages() {
  const d = reglagesParDefaut();
  try {
    const r = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!r) return d;
    const params = { ...d.params, ...r.params };
    normaliserParametres(params); // lève une erreur si une valeur n'existe plus
    // Seules les clés connues sont gardées (une ancienne clé « theme » enregistrée est ignorée).
    const ui = Object.fromEntries(REGLAGES_UI.map((x) => [x.id, r.ui?.[x.id] ?? x.defaut]));
    return { params, ui, graine: r.graine ?? '' };
  } catch {
    return d;
  }
}

export function enregistrerReglages(r) {
  try {
    localStorage.setItem(CLE, JSON.stringify(r));
  } catch {
    /* navigation privée : on garde en mémoire seulement */
  }
}

let grilleCourante = 9;
const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const libelleValeur = (r, v) => (r.valeurs ? (r.valeurs.find(([x]) => x === v) || [v, String(v)])[1] : String(v));

/** Badges d'état : Activée / Désactivée (variantes on/off), valeur, « par défaut » ou « modifié ». */
function badges(r, v) {
  const b = [];
  if (r.desactivee !== undefined) {
    b.push(v === r.desactivee ? '<span class="r-badge off">Désactivée</span>' : '<span class="r-badge on">Activée</span>');
  }
  if (r.desactivee === undefined || v !== r.desactivee) b.push(`<span class="r-badge">${echapper(libelleValeur(r, v))}</span>`);
  b.push(v === r.defaut ? '<span class="r-badge off">par défaut</span>' : '<span class="r-badge modifie">modifié</span>');
  return b.join('');
}

function carte(r, v, prefixe) {
  const nom = `${prefixe}-${r.id}`;
  let ctrl;
  if (r.type === 'nombre') {
    ctrl = `<input class="r-nombre" type="number" inputmode="numeric" name="${nom}" min="${r.min}" max="${r.max}" step="1" value="${v}">`;
  } else {
    ctrl = `<div class="r-choix" role="radiogroup">${r.valeurs
      .map(([x, l]) => `<label><input type="radio" name="${nom}" value="${echapper(JSON.stringify(x))}" ${x === v ? 'checked' : ''} ${r.fixe ? 'disabled' : ''}><span>${echapper(l)}</span></label>`)
      .join('')}</div>`;
  }
  const fixe = r.fixe ? '<p class="r-defaut">Seule valeur décrite pour l’instant : non modifiable.</p>' : '';
  return `<fieldset class="r-carte" data-id="${r.id}" data-prefixe="${prefixe}">
    <legend><div class="r-tete"><span class="r-titre">${echapper(r.libelle)}</span><span class="r-badges">${badges(r, v)}</span></div></legend>
    <p class="r-desc">${echapper(r.description)}</p>
    <p class="r-defaut">Défaut : ${echapper(libelleValeur(r, r.defaut))}${r.id === 'seuil' ? ` — actuellement ${v} % → ${seuilCroisements({ seuil: Number(v) || 75, grille: grilleCourante })} / ${grilleCourante * grilleCourante} croisements en ${grilleCourante}×${grilleCourante}` : ''}</p>
    ${fixe}${ctrl}
  </fieldset>`;
}

const GROUPES = [
  ['variante', 'Variantes', 'regles-proto.md §3, 1er tableau.'],
  ['choix', 'Choix proto, à tester', 'regles-proto.md §1, §3 (2e tableau) et §4.'],
  ['cdp', 'Décisions de Lomig et du CDP (03/11)', 'Elles priment sur regles-proto.md. Le départ libéré reste réglable pour le tester.'],
  ['partie', 'Partie', 'Valeurs décidées par Lomig.'],
];

/**
 * Rend le panneau. `brouillon` est modifié en place ; `actions` = { enregistrer(r), rejouer(r) }.
 */
export function rendreReglages(conteneur, brouillon, actuels, actions) {
  grilleCourante = brouillon.params.grille;
  const differe = JSON.stringify(brouillon.params) !== JSON.stringify(actuels.params) || brouillon.ui.mode !== actuels.ui.mode;
  let html = `<p class="r-note">Les réglages s’appliquent à la <strong>partie suivante</strong> : touchez « Enregistrer et rejouer », ou plus tard « Rejouer ».</p>`;
  if (differe) html += `<p class="r-note"><strong>Des réglages diffèrent de la partie en cours.</strong></p>`;
  html += `<h3 class="r-groupe">Jeu<small>Mode de jeu.</small></h3>`;
  for (const r of REGLAGES_UI) html += carte(r, brouillon.ui[r.id], 'ui');
  html += `<fieldset class="r-carte"><legend><div class="r-tete"><span class="r-titre">Graine du hasard (IA)</span></div></legend>
    <p class="r-desc">Laisser vide pour une partie au hasard ; un nombre rejoue la même IA.</p>
    <input class="r-nombre" type="number" inputmode="numeric" name="graine" value="${echapper(brouillon.graine)}"></fieldset>`;
  for (const [g, titre, note] of GROUPES) {
    html += `<h3 class="r-groupe">${titre}<small>${note}</small></h3>`;
    for (const r of REGLAGES.filter((x) => x.groupe === g)) html += carte(r, brouillon.params[r.id], 'p');
  }
  html += `<div class="r-pied"><p class="r-erreur" id="r-erreur"></p>
    <button class="q-btn-pret" type="button" data-action="rejouer">Enregistrer et rejouer</button>
    <button class="bouton" type="button" data-action="enregistrer">Enregistrer pour la partie suivante</button>
    <button class="bouton" type="button" data-action="defaut">Revenir aux réglages par défaut</button></div>`;
  conteneur.innerHTML = html;

  const rafraichir = () => rendreReglages(conteneur, brouillon, actuels, actions);
  conteneur.onchange = (ev) => {
    const el = ev.target;
    if (el.name === 'graine') {
      brouillon.graine = el.value;
      return;
    }
    const fs = el.closest('fieldset[data-id]');
    if (!fs) return;
    const id = fs.dataset.id;
    const v = el.type === 'number' ? Number(el.value) : JSON.parse(el.value);
    if (fs.dataset.prefixe === 'ui') {
      brouillon.ui[id] = v;
    } else brouillon.params[id] = v;
    const y = conteneur.scrollTop;
    rafraichir();
    conteneur.scrollTop = y;
  };
  conteneur.onclick = (ev) => {
    const a = ev.target.closest('[data-action]')?.dataset.action;
    if (!a) return;
    if (a === 'defaut') {
      const d = reglagesParDefaut();
      brouillon.params = d.params;
      brouillon.ui = d.ui;
      brouillon.graine = '';
      rafraichir();
      return;
    }
    try {
      normaliserParametres(brouillon.params);
    } catch (e) {
      conteneur.querySelector('#r-erreur').textContent = e.message;
      return;
    }
    enregistrerReglages(brouillon);
    if (a === 'rejouer') actions.rejouer(brouillon);
    else actions.enregistrer(brouillon);
  };
}
