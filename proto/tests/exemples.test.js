// Les 4 exemples sur grille de regles-proto.md §4, en tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, deplacer, poser, rien, indiceCase, cleSegment, zonesDe } from '../engine/index.js';
import { etatAvec as etatAvecBase, ch, cr, codes } from './aide.js';

// Comptage en cases par défaut depuis la décision Lomig du 03/11 : ces tests vérifient la logique des CROISEMENTS
// (regles-proto.md), on les épingle donc à comptage = frontiere.
const etatAvec = (o = {}) => etatAvecBase({ ...o, params: { comptage: 'frontiere', ...(o.params || {}) } });


const n = 9;

test('Exemple 1 : boucle avec deux bords, et capture (capture = retour)', () => {
  const e = etatAvec({ pions: { A: [[2, 0]], B: [[1, 1]] }, params: { capture: 'retour' } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2]])), B: rien() });
  const s = r.etat;
  // Zone de 4 cases : (0,0), (1,0), (0,1), (1,1).
  const zone = [indiceCase(n, 0, 0), indiceCase(n, 1, 0), indiceCase(n, 0, 1), indiceCase(n, 1, 1)];
  for (const k of zone) assert.equal(s.proprietaires[k], 'A');
  assert.equal(s.proprietaires.filter((x) => x === 'A').length, 4);
  // A contrôle 9 croisements, de (0,0) à (2,2).
  assert.equal(s.ctrl.A, 9);
  // b en (1,1) est capturé et retourne dans la réserve de B.
  assert.deepEqual(s.pions.B, []);
  assert.equal(s.reserve.B, 5);
  assert.ok(codes(r.journal).includes('CAPTURE'));
  // Le pion A arrivé en (0,2) est sur la frontière.
  assert.deepEqual(s.pions.A, [cr(n, 0, 2)]);
});

test('Exemple 1 bis : même coup avec capture = aucune (défaut) -> pas de capture', () => {
  const e = etatAvec({ pions: { A: [[2, 0]], B: [[1, 1]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2]])), B: rien() });
  assert.deepEqual(r.etat.pions.B, [cr(n, 1, 1)]);
  assert.equal(r.etat.ctrl.A, 9);
  assert.ok(!codes(r.journal).includes('CAPTURE'));
});

test('Exemple 1 ter : capture = sans_retour -> le pion quitte la partie', () => {
  const e = etatAvec({ pions: { A: [[2, 0]], B: [[1, 1]] }, params: { capture: 'sans_retour' } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2]])), B: rien() });
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 4);
  assert.equal(r.etat.retires.B, 1);
});

test('Exemple 2 : fermeture en deux tours, en revenant sur sa trace', () => {
  const e = etatAvec({ pions: { A: [[4, 4]] } });
  const t1 = resoudreTour(e, { A: deplacer(ch(n, [[4, 4], [5, 4], [5, 5]])), B: rien() });
  assert.equal(t1.etat.ctrl.A, 0);
  const t2 = resoudreTour(t1.etat, { A: deplacer(ch(n, [[5, 5], [4, 5], [4, 4]])), B: rien() });
  assert.equal(t2.etat.proprietaires[indiceCase(n, 4, 4)], 'A');
  assert.equal(t2.etat.proprietaires.filter((x) => x === 'A').length, 1);
  assert.equal(t2.etat.ctrl.A, 4);
});

test('Exemple 3 : rencontre au croisement (3,2) -> annulés, pions en place, aucune trace', () => {
  const e = etatAvec({ pions: { A: [[3, 1]], B: [[4, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[3, 1], [3, 2], [3, 3]])), B: deplacer(ch(n, [[4, 2], [3, 2], [2, 2]])) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 3, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 4, 2)]);
  assert.deepEqual(r.etat.couleurs, {});
});

test('Exemple 3 bis : croisement en sens inverse sur un segment -> même résultat', () => {
  const e = etatAvec({ pions: { A: [[5, 5]], B: [[6, 5]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[5, 5], [6, 5]])), B: deplacer(ch(n, [[6, 5], [5, 5]])) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 5, 5)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 6, 5)]);
  assert.deepEqual(r.etat.couleurs, {});
});

test('Exemple 4 : murs mêlés et trace adverse', () => {
  const k = indiceCase(n, 2, 2);
  const e = etatAvec({
    pions: { A: [[1, 3]] },
    couleurs: [
      [[2, 2], [3, 2], 'A'], // haut
      [[2, 2], [2, 3], 'A'], // gauche
      [[2, 3], [3, 3], 'B'], // bas
      [[3, 2], [3, 3], 'B'], // droite
    ],
  });
  // Aucun joueur n'a de zone.
  assert.equal(zonesDe(e, 'A').length, 0);
  assert.equal(zonesDe(e, 'B').length, 0);
  // A passe sur le côté bas : il devient à A ; trois côtés, pas encore de zone.
  const t1 = resoudreTour(e, { A: deplacer(ch(n, [[1, 3], [2, 3], [3, 3]])), B: rien() });
  assert.equal(t1.etat.couleurs[cleSegment(cr(n, 2, 3), cr(n, 3, 3))], 'A');
  assert.equal(t1.etat.proprietaires[k], null);
  // Un trajet de A sur le côté droit ferme la case pour lui.
  const t2 = resoudreTour(t1.etat, { A: deplacer(ch(n, [[3, 3], [3, 2]])), B: rien() });
  assert.equal(t2.etat.proprietaires[k], 'A');
  assert.equal(t2.etat.ctrl.A, 4);
});

// Exemple 5 de regles-proto.md v0.2 : A en (2,2), b en (3,2).
// A : (2,2) -> (2,3). B : (3,2) -> (2,2) -> (1,2) : b traverse le croisement que A quitte.
// décision Lomig 03/11 (depart_libere = traversee, défaut) : les deux trajets aboutissent.
test('Exemple 5 : traverser le départ que A quitte -> les deux aboutissent', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [2, 3]])), B: deplacer(ch(n, [[3, 2], [2, 2], [1, 2]])) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 3)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 1, 2)]);
  assert.ok(!r.journal.some((x) => ['RENCONTRE', 'COUPURE', 'CHAINE'].includes(x.code)));
});

test('Exemple 5, variante : B FINIT sur (2,2) que A quitte -> les deux aboutissent', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [2, 3]])), B: deplacer(ch(n, [[3, 2], [2, 2]])) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 3)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 2, 2)]);
});

test('Exemple 5 : si A pose ailleurs ou ne fait rien, l’ordre de B est annulé et b reste en (3,2)', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  for (const oA of [rien(), poser(cr(n, 7, 7))]) {
    const r = resoudreTour(e, { A: oA, B: deplacer(ch(n, [[3, 2], [2, 2], [1, 2]])) });
    assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
    assert.ok(r.journal.some((x) => x.code === 'CHAINE' && x.joueur === 'B'));
  }
});

test('Exemple 5 : si A joue (2,2) -> (3,2), échange par le même segment -> les deux coupés', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[3, 2], [2, 2], [1, 2]])) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 2)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
});
