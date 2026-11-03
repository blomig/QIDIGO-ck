// Application : boucle de jeu, chrono, modes (contre l'IA / à deux sur le même téléphone).
// Le moteur (engine/) est pur ; ici on ne fait que l'appeler et afficher.

import {
  creerEtat, resoudreTour, validerOrdre, passer, creerRng, graineAleatoire, seuilCroisements,
  nbCroisements, adversaire, nomJoueur,
} from '../engine/index.js';
import { demanderOrdre } from '../ai/ia.js';
import { choisirOrdre as choisirFacile } from '../ai/ia-faible.js';
import { dessinerPlateau, installerSaisie, geometrie, analyserDernierTour, afficherCompteurPas, CAMP } from './plateau.js';
import { chargerReglages, rendreReglages } from './reglages.js';
import { rendreJournal, lignes } from './journal.js';

const $ = (id) => document.getElementById(id);
const COULEUR = { A: 'noir', B: 'blanc' };

const S = {
  reglages: null, // réglages de la partie en cours
  etat: null,
  rng: null,
  graine: 0,
  mode: 'ia',
  niveau: 'fort', // niveau de l'IA : 'fort' (défaut, ai/ia-forte.js) ou 'facile' (ai/ia-faible.js)
  ordreIA: null, // promesse de l'ordre de l'IA, lancée dès le début du tour (elle ne dépend que de l'état)
  tempsIA: [], // ms par coup de l'IA (mesure, exposée dans window.QIDIGO)
  phase: 'saisie', // 'passage' | 'saisie' | 'resultat' | 'fin'
  joueur: 'A',
  ordres: {},
  proposition: null,
  apercu: null,
  chemin: null,
  doigt: null,
  dernier: null,
  message: '',
  erreur: false,
  chrono: { fin: 0, minuteur: null },
  geo: null,
};

// ---------------------------------------------------------------------------
// Partie
// ---------------------------------------------------------------------------

function nouvellePartie() {
  arreterChrono();
  S.reglages = chargerReglages();
  S.mode = S.reglages.ui.mode;
  S.niveau = S.reglages.ui.niveau;
  S.tempsIA = [];
  S.graine = S.reglages.graine !== '' && Number.isFinite(Number(S.reglages.graine)) ? Number(S.reglages.graine) >>> 0 : graineAleatoire();
  S.rng = creerRng(S.graine);
  S.etat = creerEtat(S.reglages.params);
  S.dernier = null;
  calculerGeometrie();
  demarrerTour();
}

function demarrerTour() {
  S.ordres = {};
  S.joueur = 'A';
  S.dernier = null;
  if (S.mode === 'deux') {
    S.phase = 'passage';
    rendre();
  } else debutSaisie();
}

function debutSaisie() {
  S.phase = 'saisie';
  // L'IA réfléchit pendant que vous planifiez (Web Worker) : son ordre ne dépend que de l'état du début du tour.
  if (S.mode === 'ia' && S.niveau !== 'facile') {
    const etat = S.etat;
    S.ordreIA = demanderOrdre(etat, 'B', S.niveau, S.rng.entier(4294967296)).then((r) => {
      S.tempsIA.push(r.ms);
      return r.ordre;
    });
  }
  S.proposition = null;
  S.apercu = null;
  S.message = consigne();
  S.erreur = false;
  demarrerChrono();
  rendre();
}

function consigne() {
  const e = S.etat;
  const reste = e.reserve[S.joueur];
  return `${nomJoueur(S.joueur)} (${COULEUR[S.joueur]}) : touchez un croisement pour poser${reste ? ` (${reste} en réserve)` : ' (réserve vide)'}, ou glissez depuis un de vos pions le long des traits.`;
}

/** Enregistre l'ordre du joueur courant (proposition, ou « Passer »). */
function soumettre(ordre) {
  arreterChrono();
  // choix proto (CDP 03/11) : sans ordre à la fin du chrono, « Passer » est choisi automatiquement.
  const o = ordre || passer();
  S.ordres[S.joueur] = validerOrdre(S.etat, S.joueur, o).ok ? o : passer();
  S.proposition = null;
  S.apercu = null;
  if (S.mode === 'ia' && S.niveau === 'facile') {
    // Niveau Facile : calcul direct avec le générateur de la partie (une graine rejoue les mêmes coups
    // qu'avant l'ajout du niveau Fort, par exemple la partie de Lomig, graine 2761909367).
    S.ordres.B = choisirFacile(S.etat, 'B', S.rng);
    resoudre();
  } else if (S.mode === 'ia') {
    S.phase = 'ia';
    S.message = 'L’IA termine sa réflexion…';
    rendre();
    const etat = S.etat;
    S.ordreIA.then((o) => {
      if (S.etat !== etat) return; // partie relancée entre-temps
      S.ordres.B = o;
      resoudre();
    });
  } else if (S.joueur === 'A') {
    S.joueur = 'B';
    S.phase = 'passage';
    rendre();
  } else resoudre();
}

function resoudre() {
  const r = resoudreTour(S.etat, S.ordres);
  S.etat = r.etat;
  S.dernier = analyserDernierTour(S.etat);
  S.phase = S.etat.fini ? 'fin' : 'resultat';
  rendre();
}

// ---------------------------------------------------------------------------
// Chrono
// ---------------------------------------------------------------------------

function demarrerChrono() {
  arreterChrono();
  const duree = S.etat.params.dureeTourS;
  S.chrono.fin = performance.now() + duree * 1000;
  S.chrono.minuteur = setInterval(tic, 100);
  tic();
}
function arreterChrono() {
  clearInterval(S.chrono.minuteur);
  S.chrono.minuteur = null;
}
function tic() {
  const duree = S.etat.params.dureeTourS;
  const reste = Math.max(0, (S.chrono.fin - performance.now()) / 1000);
  afficherChrono(reste, duree);
  if (reste <= 0 && S.phase === 'saisie') soumettre(S.proposition);
}
function afficherChrono(reste, duree) {
  const el = $('chrono');
  el.style.setProperty('--q-reste', String(reste / duree));
  const urgent = S.phase === 'saisie' && reste <= 5;
  el.classList.toggle('is-urgent', urgent);
  if (S.phase === 'saisie') $('btn-pret').dataset.etat = urgent ? 'urgent' : S.proposition ? 'actif' : 'inactif';
  $('chrono-val').innerHTML = `${Math.ceil(reste)}<small>s</small>`;
}

// ---------------------------------------------------------------------------
// Saisie
// ---------------------------------------------------------------------------

function majApercu() {
  // choix proto (CDP 03/11) : aperçu de fermeture calculé ici avec le même moteur.
  // On ne connaît pas l'ordre adverse : on le suppose « Passer ».
  S.apercu = null;
  if (!S.proposition) return;
  const moi = S.joueur;
  const r = resoudreTour(S.etat, { [moi]: S.proposition, [adversaire(moi)]: passer() });
  const cells = [];
  r.etat.proprietaires.forEach((p, k) => {
    if (p === moi && S.etat.proprietaires[k] !== moi) cells.push([k % (S.etat.params.grille - 1), Math.floor(k / (S.etat.params.grille - 1))]);
  });
  const captures = S.etat.pions[adversaire(moi)].filter((c) => !r.etat.pions[adversaire(moi)].includes(c));
  S.apercu = { cells, captures, gain: r.etat.ctrl[moi] - S.etat.ctrl[moi] };
}

function decrireProposition() {
  const p = S.proposition;
  const n = S.etat.params.grille;
  const nc = (c) => `(${c % n}, ${Math.floor(c / n)})`;
  if (!p) return consigne();
  let t;
  if (p.type === 'poser') t = `Votre ordre : poser en ${nc(p.croisement)}.`;
  else {
    t = `Votre ordre : déplacer ${nc(p.chemin[0])} → ${nc(p.chemin[p.chemin.length - 1])} (${p.chemin.length - 1} segment${p.chemin.length > 2 ? 's' : ''})`;
    if (p.soutien != null) t += `, soutenu par ${nc(p.soutien)}`;
    t += '.';
    const adv = S.etat.pions[adversaire(S.joueur)];
    if (p.chemin.slice(1).some((c) => adv.includes(c))) t += S.etat.params.depart_libere === 'arrivee_seule'
      ? ' Ordre conditionnel : il n’aboutit que si le pion adverse part (et on peut seulement s’arrêter sur son départ, pas le traverser).'
      : ' Ordre conditionnel : il n’aboutit que si le pion adverse part.';
    else if (S.etat.params.soutien === 'oui' && p.soutien == null) t += ' Touchez un de vos pions voisin du départ pour le soutenir.';
  }
  if (S.apercu?.gain > 0) t += ` Aperçu (si l’autre passe) : +${S.apercu.gain} croisements.`;
  if (S.apercu?.captures.length) t += ` Capture prévue : ${S.apercu.captures.length}.`;
  return t + ' Touchez « Prêt » pour valider.';
}

function installer() {
  installerSaisie($('plateau'), {
    etat: () => S.etat,
    joueur: () => S.joueur,
    actif: () => S.phase === 'saisie',
    geo: () => S.geo,
    surChemin: (chemin, doigt) => {
      S.chemin = chemin ? chemin.slice() : null;
      S.doigt = doigt;
      dessiner();
      afficherCompteurPas(document.querySelector('.plateau-zone'), $('plateau'), S.etat, S.chemin, S.doigt, S.geo);
    },
    surOrdre: (ordre, raison, estTap) => {
      if (ordre) {
        // Toucher à nouveau la pose prévue l'annule.
        if (estTap && S.proposition?.type === 'poser' && S.proposition.croisement === ordre.croisement) S.proposition = null;
        else S.proposition = ordre;
        majApercu();
        S.message = decrireProposition();
        S.erreur = false;
      } else if (raison) {
        S.message = raison;
        S.erreur = true;
      }
      rendre();
    },
    surTapPion: (c) => {
      const p = S.proposition;
      // Variante soutien : toucher un pion voisin du départ le désigne (ou le retire).
      if (S.etat.params.soutien === 'oui' && p?.type === 'deplacer' && c !== p.chemin[0]) {
        const essai = { ...p, soutien: p.soutien === c ? undefined : c };
        const v = validerOrdre(S.etat, S.joueur, essai);
        if (v.ok && (essai.soutien == null || v.ordre.soutien === c)) {
          S.proposition = v.ordre;
          S.message = decrireProposition();
          S.erreur = false;
        } else {
          S.message = 'Le soutien doit être un de vos pions, voisin du croisement de départ.';
          S.erreur = true;
        }
        rendre();
        return;
      }
      S.message = 'Glissez depuis ce pion le long des traits pour le déplacer.';
      S.erreur = false;
      rendre();
    },
  });

  $('btn-pret').addEventListener('click', () => {
    if (S.phase === 'saisie') soumettre(S.proposition);
    else if (S.phase === 'resultat') demarrerTour();
    else if (S.phase === 'fin') nouvellePartie();
  });
  $('btn-effacer').addEventListener('click', () => {
    if (S.phase !== 'saisie') return;
    if (S.proposition) {
      S.proposition = null;
      S.apercu = null;
      S.message = consigne();
      S.erreur = false;
      rendre();
    } else soumettre(passer()); // sans ordre, le bouton devient « Passer »
  });
  $('passage-ok').addEventListener('click', debutSaisie);
  $('btn-rejouer').addEventListener('click', () => {
    if (S.phase !== 'fin' && S.etat.historique.length && !confirm('Recommencer une partie (avec les réglages enregistrés) ?')) return;
    nouvellePartie();
  });
  $('btn-journal').addEventListener('click', () => {
    rendreJournal($('journal'), S.etat, `<p class="r-note">Graine : ${S.graine} · grille ${S.etat.params.grille}×${S.etat.params.grille} · mode ${S.mode === 'ia' ? `contre l’IA (${S.niveau === 'facile' ? 'Facile' : 'Fort'})` : 'à deux'}</p>`);
    ouvrir('panneau-journal');
  });
  $('btn-reglages').addEventListener('click', () => {
    const brouillon = JSON.parse(JSON.stringify(chargerReglages()));
    rendreReglages($('reglages'), brouillon, S.reglages, {
      enregistrer: () => fermer('panneau-reglages'),
      rejouer: () => {
        fermer('panneau-reglages');
        nouvellePartie();
      },
    });
    ouvrir('panneau-reglages');
  });
  for (const b of document.querySelectorAll('[data-fermer]')) b.addEventListener('click', () => fermer(b.closest('.panneau').id));

  // Pas de zoom au double tap ni au pincement (Safari iOS ignore parfois user-scalable=no).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('resize', () => {
    calculerGeometrie();
    dessiner();
  });
}

function ouvrir(id) {
  $(id).hidden = false;
}
function fermer(id) {
  $(id).hidden = true;
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

function calculerGeometrie() {
  const largeur = Math.min($('plateau').clientWidth || window.innerWidth, 520);
  S.geo = geometrie(largeur, S.etat.params.grille);
}

function dessiner() {
  dessinerPlateau($('plateau'), S.etat, {
    phase: S.phase,
    joueur: S.joueur,
    proposition: S.proposition,
    chemin: S.chemin,
    doigt: S.doigt,
    apercu: S.apercu,
    dernier: S.dernier,
  }, S.geo);
}

function compteur(j) {
  // choix proto (CDP 03/11) : compteur de croisements contrôlés par joueur, sur le seuil.
  const e = S.etat;
  const total = nbCroisements(e.params.grille);
  const seuil = seuilCroisements(e.params);
  const g = S.phase === 'saisie' && S.joueur === j && S.apercu ? S.apercu.gain : 0;
  const reserve = Array.from({ length: e.params.nbPions }, (_, k) => `<i class="q-chip q-chip--${k < e.reserve[j] ? CAMP[j] : 'vide'}"></i>`).join('');
  const qui = S.mode === 'ia' ? (j === 'A' ? 'Vous' : 'IA') : `Joueur ${j}`;
  return `<div class="q-counter-label"><i class="q-chip q-chip--${CAMP[j]}"></i>${qui}</div>
    <div class="q-counter-val q-num">${e.ctrl[j]}<small>/${seuil}</small>${g > 0 ? `<span class="q-gain">+${g}</span>` : ''}</div>
    <div class="q-counter-bar" style="--v:${e.ctrl[j]};--g:${g};--q-total:${total};--q-seuil:${seuil}"><i></i><b></b><em></em></div>
    <div class="q-reserve" aria-label="Réserve">${reserve}</div>`;
}

function rendre() {
  const e = S.etat;
  $('tour').textContent = `Tour ${e.tour} / ${e.params.nbTours}`;
  for (const j of ['A', 'B']) {
    const el = $(`compteur-${j}`);
    el.innerHTML = compteur(j);
    el.classList.toggle('is-goal', e.ctrl[j] >= seuilCroisements(e.params));
  }
  if (S.phase !== 'saisie') afficherChrono(S.phase === 'passage' ? e.params.dureeTourS : 0, e.params.dureeTourS);

  // Écran de passage (mode deux joueurs) : masque tout, y compris l'ordre déjà donné.
  const passage = S.phase === 'passage';
  $('passage').hidden = !passage;
  if (passage) {
    $('passage-titre').textContent = `Au tour du joueur ${S.joueur} (${COULEUR[S.joueur]})`;
    $('passage-texte').textContent = S.joueur === 'A'
      ? `Tour ${e.tour}. Passez l’appareil au joueur A. Le joueur B ne regarde pas.`
      : 'Passez l’appareil au joueur B. Le joueur A ne regarde pas : son ordre reste caché.';
    $('passage-ok').textContent = `Je suis le joueur ${S.joueur}`;
  }

  // Bouton principal et secondaire.
  const pret = $('btn-pret');
  const eff = $('btn-effacer');
  eff.hidden = S.phase !== 'saisie';
  if (S.phase === 'saisie') {
    pret.textContent = S.proposition ? 'Prêt' : 'Prêt (sans ordre = Passer)';
    pret.dataset.etat = S.proposition ? 'actif' : 'inactif';
    eff.textContent = S.proposition ? 'Effacer' : 'Passer';
  } else if (S.phase === 'resultat') {
    pret.textContent = 'Tour suivant';
    pret.dataset.etat = 'actif';
  } else if (S.phase === 'fin') {
    pret.textContent = 'Rejouer';
    pret.dataset.etat = 'actif';
  }
  if (S.phase === 'ia') {
    pret.textContent = 'L’IA réfléchit…';
    pret.dataset.etat = 'inactif';
  }
  pret.hidden = passage;
  $('statut').textContent = S.phase === 'saisie' || S.phase === 'ia' ? S.message || consigne() : '';
  $('statut').classList.toggle('erreur', S.phase === 'saisie' && S.erreur);

  // Résumé du tour résolu (public).
  const resume = $('resume');
  if ((S.phase === 'resultat' || S.phase === 'fin') && e.historique.length) {
    const h = e.historique[e.historique.length - 1];
    resume.innerHTML = `<h3>${S.phase === 'fin' ? 'Partie terminée' : `Tour ${h.tour} résolu`}</h3><ul>${lignes(h.journal)}</ul>`;
    resume.hidden = false;
  } else resume.hidden = true;

  dessiner();
}

// ---------------------------------------------------------------------------
installer();
nouvellePartie();
// Exposé pour le débogage dans la console.
window.QIDIGO = S;
