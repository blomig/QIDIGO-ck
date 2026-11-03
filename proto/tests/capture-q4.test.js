// Q4 (demande du CDP, 03/11) : les pions enfermés dans une zone fermée sont capturés et repartent
// dans la réserve de leur propriétaire (capture = retour). Le défaut reste capture = aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, deplacer, poser, passer, validerOrdre, creerRng, creerEtat, indice } from '../engine/index.js';
import * as forte from '../ai/ia-forte.js';
import { etatAvec, ch, cr, codes } from './aide.js';

const n = 9;
// Murs de A : (2,0)-(2,3). Le pion A en (0,3) ferme le rectangle 2 × 3 du coin par (0,3)->(1,3)->(2,3).
const MURS = [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[2, 2], [2, 3], 'A']];
const FERMER = deplacer(ch(n, [[0, 3], [1, 3], [2, 3]]));
const position = (pionB, params = {}) => etatAvec({ params: { grille: n, capture: 'retour', ...params }, couleurs: MURS, pions: { A: [[0, 3]], B: [pionB] } });
const captures = (journal) => journal.filter((x) => x.code === 'CAPTURE');

test('Q4 : le défaut reste capture = aucune', () => {
  assert.equal(creerEtat({}).params.capture, 'aucune');
  const r = resoudreTour(position([1, 1], { capture: 'aucune' }), { A: FERMER, B: passer() });
  assert.equal(captures(r.journal).length, 0);
  assert.deepEqual(r.etat.pions.B, [cr(n, 1, 1)]);
});

test('Q4 : retour, le pion enfermé retourne en réserve et se rejoue au tour suivant', () => {
  const e = position([1, 1]);
  assert.equal(e.reserve.B, 4);
  const r = resoudreTour(e, { A: FERMER, B: passer() });
  assert.equal(captures(r.journal).length, 1);
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 5);
  // T+1 : B repose ce pion, ici sur le croisement même où il a été capturé (désormais libre, dans la zone de A).
  assert.ok(validerOrdre(r.etat, 'B', poser(cr(n, 1, 1))).ok);
  const r2 = resoudreTour(r.etat, { A: passer(), B: poser(cr(n, 1, 1)) });
  assert.deepEqual(r2.etat.pions.B, [cr(n, 1, 1)]);
  assert.equal(r2.etat.reserve.B, 4);
  // Il n'est pas recapturé : on ne capture qu'au tour de la fermeture (regles-proto.md, cas limites).
  assert.equal(captures(r2.journal).length, 0);
});

test('Q4 : « enfermé » = toutes les cases qui touchent le croisement dans la zone ; bord du plateau compris, frontière exclue', () => {
  // Croisement du bord du plateau (0,1) : ses 2 cases sont dans la zone -> capturé.
  assert.equal(captures(resoudreTour(position([0, 1]), { A: FERMER, B: passer() }).journal).length, 1);
  // Coin du plateau (0,0) : sa seule case est dans la zone -> capturé.
  assert.equal(captures(resoudreTour(position([0, 0]), { A: FERMER, B: passer() }).journal).length, 1);
  // Sur le mur de A (2,1), frontière de la zone : pas capturé.
  const r = resoudreTour(position([2, 1]), { A: FERMER, B: passer() });
  assert.ok(codes(r.journal).includes('ZONE'));
  assert.equal(captures(r.journal).length, 0);
  // sans_retour : le pion quitte la partie.
  const s = resoudreTour(position([1, 1], { capture: 'sans_retour' }), { A: FERMER, B: passer() });
  assert.equal(s.etat.reserve.B, 4);
  assert.equal(s.etat.retires.B, 1);
});

test('Q4 × zone_regle : sans_pion_adverse empêche la capture à l’intérieur, pas sur le bord du plateau', () => {
  const casesA = (e) => e.proprietaires.filter((p) => p === 'A').length;
  for (const z of ['actuel', 'dehors_non_possede', 'moitie_libre']) {
    const r = resoudreTour(position([1, 1], { zone_regle: z }), { A: FERMER, B: passer() });
    assert.equal(captures(r.journal).length, 1, z);
    assert.equal(casesA(r.etat), 6, z);
  }
  // Pion intérieur : la région n'est pas une zone, donc ni gain ni capture.
  const i = resoudreTour(position([1, 1], { zone_regle: 'sans_pion_adverse' }), { A: FERMER, B: passer() });
  assert.equal(captures(i.journal).length, 0);
  assert.equal(casesA(i.etat), 0);
  // Pion sur le bord du plateau (lecture « croisement intérieur ») : la zone compte, et il est capturé.
  const b = resoudreTour(position([0, 1], { zone_regle: 'sans_pion_adverse' }), { A: FERMER, B: passer() });
  assert.equal(captures(b.journal).length, 1);
  assert.equal(casesA(b.etat), 6);
});

test('Q4 IA forte (piège 1) : elle choisit la fermeture qui capture plutôt qu’une fermeture équivalente', () => {
  // Deux fermetures de 6 cases possibles en un coup ; seule celle du coin haut gauche enferme un pion B.
  const e = etatAvec({ params: { grille: n, capture: 'retour' }, pions: { A: [[2, 0], [6, 8]], B: [[1, 1], [4, 4]] } });
  for (let g = 0; g < 5; g++) {
    const o = forte.choisirOrdre(e, 'A', creerRng(g));
    const r = resoudreTour(e, { A: o, B: passer() });
    assert.equal(captures(r.journal).length, 1, `graine ${g} : ${JSON.stringify(o)}`);
  }
});

test('Q4 IA forte (piège 2) : elle ne laisse pas son pion dans une zone qui va se fermer', () => {
  // A ferme le coin par (1,2)->(2,2) ; B n'a plus de réserve (2 pions sur 2), il ne peut pas poser pour bloquer.
  const murs = [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[0, 2], [1, 2], 'A']];
  const e = etatAvec({ params: { grille: n, capture: 'retour', nbPions: 2 }, couleurs: murs, pions: { A: [[1, 2], [6, 6]], B: [[1, 1], [6, 2]] } });
  const fermer = deplacer(ch(n, [[1, 2], [2, 2]]));
  assert.equal(captures(resoudreTour(e, { A: fermer, B: passer() }).journal).length, 1); // le piège est réel
  const ordresA = forte.ordresLegaux(e, 'A');
  for (let g = 0; g < 3; g++) {
    const oB = forte.choisirOrdre(e, 'B', creerRng(g));
    // Quel que soit l'ordre de A, le pion B n'est pas capturé.
    for (const oA of ordresA) assert.equal(captures(resoudreTour(e, { A: oA, B: oB }).journal).length, 0, `graine ${g} : B ${JSON.stringify(oB)}, A ${JSON.stringify(oA)}`);
  }
});
