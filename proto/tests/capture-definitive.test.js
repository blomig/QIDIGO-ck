// Capture définitive (demande du CDP, 03/11) : le pion pris est retiré de la partie pour de bon.
// `definitive` est un alias de `sans_retour` (regles-proto.md l. 88 : « avec `sans_retour`, il est
// retiré de la partie »). Le défaut reste capture = aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resoudreTour, deplacer, poser, passer, validerOrdre, creerRng, creerEtat, copier, geler, indice, cleSegment, REGLAGES, compter } from '../engine/index.js';
import * as forte from '../ai/ia-forte.js';
import * as faible from '../ai/ia-faible.js';
import { etatAvec, ch, cr, codes } from './aide.js';

const n = 9;
const MURS = [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[2, 2], [2, 3], 'A']];
const FERMER = deplacer(ch(n, [[0, 3], [1, 3], [2, 3]]));
const captures = (journal, v) => journal.filter((x) => x.code === 'CAPTURE' && (!v || x.joueur === v));
const sansHisto = (e) => ({ ...e, params: { ...e.params, capture: 'X' }, historique: [] });

test('définitive : valeur proposée dans les Réglages, défaut inchangé (aucune)', () => {
  assert.equal(creerEtat({}).params.capture, 'aucune');
  const p = REGLAGES.find((x) => x.id === 'capture');
  assert.ok(p.valeurs.some(([v]) => v === 'definitive'));
  assert.equal(creerEtat({ capture: 'definitive' }).params.capture, 'definitive');
});

test('définitive = sans_retour exactement (même état, même journal)', () => {
  for (const pionB of [[1, 1], [0, 1], [0, 0], [2, 1]]) {
    const r = {};
    for (const c of ['sans_retour', 'definitive']) {
      const e = etatAvec({ params: { grille: n, capture: c }, couleurs: MURS, pions: { A: [[0, 3]], B: [pionB] } });
      r[c] = resoudreTour(e, { A: FERMER, B: passer() });
    }
    assert.deepEqual(sansHisto(r.definitive.etat), sansHisto(r.sans_retour.etat), String(pionB));
    assert.deepEqual(r.definitive.journal, r.sans_retour.journal, String(pionB));
  }
  const r = resoudreTour(etatAvec({ params: { grille: n, capture: 'definitive' }, couleurs: MURS, pions: { A: [[0, 3]], B: [[1, 1]] } }), { A: FERMER, B: passer() });
  assert.equal(captures(r.journal).length, 1);
  assert.equal(r.etat.retires.B, 1);
  assert.equal(r.etat.reserve.B, 4); // le pion ne revient pas
  assert.equal(r.etat.pions.B.length, 0);
});

test('définitive, cas limite : plus aucun pion -> il continue et ne peut que passer', () => {
  // B n'a qu'un pion (nbPions 1), enfermé : il le perd pour de bon.
  const e = etatAvec({ params: { grille: n, capture: 'definitive', nbPions: 1 }, couleurs: MURS, pions: { A: [[0, 3]], B: [[1, 1]] } });
  const r = resoudreTour(e, { A: FERMER, B: passer() });
  assert.ok(codes(r.journal).includes('SANS_PION'));
  assert.equal(r.etat.fini, false); // la partie continue
  const s = r.etat;
  assert.equal(s.pions.B.length + s.reserve.B, 0);
  assert.equal(validerOrdre(s, 'B', poser(cr(n, 5, 5))).ok, false);
  assert.deepEqual(forte.ordresLegaux(s, 'B').map((o) => o.type), ['passer']);
  assert.equal(forte.choisirOrdre(s, 'B', creerRng(1)).type, 'passer');
  assert.equal(faible.choisirOrdre(s, 'B', creerRng(1)).type, 'passer');
  // Un ordre invalide est ramené à « rien » ; A continue de jouer normalement.
  const r2 = resoudreTour(s, { A: passer(), B: poser(cr(n, 5, 5)) });
  assert.equal(r2.etat.pions.B.length, 0);
  assert.equal(r2.etat.tour, s.tour + 1);
  // Si une capture laisse encore un pion en réserve, pas d'entrée SANS_PION.
  const r3 = resoudreTour(etatAvec({ params: { grille: n, capture: 'definitive' }, couleurs: MURS, pions: { A: [[0, 3]], B: [[1, 1]] } }), { A: FERMER, B: passer() });
  assert.ok(!codes(r3.journal).includes('SANS_PION'));
  // Avec retour, jamais de SANS_PION (le pion revient en réserve).
  const r4 = resoudreTour(etatAvec({ params: { grille: n, capture: 'retour', nbPions: 1 }, couleurs: MURS, pions: { A: [[0, 3]], B: [[1, 1]] } }), { A: FERMER, B: passer() });
  assert.ok(!codes(r4.journal).includes('SANS_PION'));
  assert.equal(r4.etat.reserve.B, 1);
});

test('définitive, cas limite : les deux sans pion -> la partie va au dernier tour, territoire acquis', () => {
  let e = copier(creerEtat({ grille: n, capture: 'definitive', nbPions: 1 }));
  e.pions = { A: [], B: [] }; e.reserve = { A: 0, B: 0 }; e.retires = { A: 1, B: 1 };
  e.proprietaires[0] = 'A'; e.ctrl = { A: 4, B: 0 };
  e = geler(e);
  let t = 0;
  while (!e.fini && t++ < 30) e = resoudreTour(e, { A: forte.choisirOrdre(e, 'A', creerRng(t)), B: forte.choisirOrdre(e, 'B', creerRng(t)) }).etat;
  assert.equal(e.fini, true);
  assert.equal(e.historique.length, e.params.nbTours);
  assert.equal(e.vainqueur, 'A');
});

test('définitive IA forte (piège 1) : elle capture en un coup', () => {
  const e = etatAvec({ params: { grille: n, capture: 'definitive' }, pions: { A: [[2, 0], [6, 8]], B: [[1, 1], [4, 4]] } });
  for (let g = 0; g < 5; g++) {
    const o = forte.choisirOrdre(e, 'A', creerRng(g));
    assert.equal(captures(resoudreTour(e, { A: o, B: passer() }).journal).length, 1, `graine ${g} : ${JSON.stringify(o)}`);
  }
});

test('définitive IA forte (piège 2) : elle sort son pion d’une zone qui va se fermer', () => {
  const murs = [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[0, 2], [1, 2], 'A']];
  const e = etatAvec({ params: { grille: n, capture: 'definitive', nbPions: 2 }, couleurs: murs, pions: { A: [[1, 2], [6, 6]], B: [[1, 1], [6, 2]] } });
  assert.equal(captures(resoudreTour(e, { A: deplacer(ch(n, [[1, 2], [2, 2]])), B: passer() }).journal).length, 1);
  const ordresA = forte.ordresLegaux(e, 'A');
  for (let g = 0; g < 3; g++) {
    const oB = forte.choisirOrdre(e, 'B', creerRng(g));
    for (const oA of ordresA) assert.equal(captures(resoudreTour(e, { A: oA, B: oB }).journal).length, 0, `graine ${g}`);
  }
});

// Positions réelles du banc Q4 (capture retour) où la victime avait posé ou déplacé un pion dans une
// zone que l'adversaire a fermée au même tour. En définitive, sans le poids `capture_definitive`
// (0), la forte s'y fait prendre (partie 223 : 5 graines sur 5 ; partie 157 : 5 sur 5).
const PIEGES = JSON.parse(fs.readFileSync(new URL('./pieges-definitive.json', import.meta.url)));
function etatPiege(p) {
  const e = copier(creerEtat({ grille: n, capture: 'definitive' }));
  for (const j of ['A', 'B']) e.pions[j] = p.pions[j].map(([x, y]) => indice(n, x, y));
  e.reserve = { ...p.reserve };
  e.couleurs = {};
  for (const [[x1, y1], [x2, y2], j] of p.couleurs) e.couleurs[cleSegment(indice(n, x1, y1), indice(n, x2, y2))] = j;
  e.proprietaires = p.proprietaires.slice(); e.tour = p.tour;
  // positions relevées au banc en croisements : ctrl recalculé dans le comptage courant (cases par défaut)
  e.ctrl = compter(geler(copier(e)));
  return geler(e);
}

for (const p of PIEGES) {
  test(`définitive IA forte (piège 3) : ne pas entrer dans une zone que l'adversaire ferme au même tour (${p.source})`, () => {
    const e = etatPiege(p);
    const v = p.victime, Q = v === 'A' ? 'B' : 'A';
    // le piège est réel : avec le poids à 0, la forte s'y fait prendre au moins une fois
    let pris0 = 0;
    for (let g = 0; g < 5; g++) {
      const o = forte.choisirOrdre(e, v, creerRng(g), { poids: { ...forte.POIDS_BASE, capture_definitive: 0 } });
      pris0 += captures(resoudreTour(e, { [v]: o, [Q]: p.ordreDuFermeurAuBanc }).journal, v).length > 0;
    }
    assert.ok(pris0 > 0, 'piège sans tentation');
    const ordresQ = forte.ordresLegaux(e, Q);
    for (let g = 0; g < 3; g++) {
      const o = forte.choisirOrdre(e, v, creerRng(g));
      for (const oq of ordresQ) assert.equal(captures(resoudreTour(e, { [v]: o, [Q]: oq }).journal, v).length, 0, `graine ${g} : ${JSON.stringify(o)} contre ${JSON.stringify(oq)}`);
    }
  });
}
