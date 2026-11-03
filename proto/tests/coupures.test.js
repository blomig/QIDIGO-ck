// Coupures de base (regles-proto.md §1 et étape 3) et décisions CDP du 03/11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, poser, deplacer, rien, cleSegment } from '../engine/index.js';
import { etatAvec, ch, cr, codes } from './aide.js';

const n = 9;
const pos = (e, j) => e.pions[j].slice().sort((a, b) => a - b);

test('3a : croisement partagé -> les deux trajets annulés, aucune trace', () => {
  const e = etatAvec({ pions: { A: [[1, 4]], B: [[4, 1]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[1, 4], [2, 4], [3, 4], [4, 4]])), B: deplacer(ch(n, [[4, 1], [4, 2], [4, 3], [4, 4], [4, 5]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 1, 4)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 4, 1)]);
  assert.deepEqual(r.etat.couleurs, {});
  assert.equal(codes(r.journal).filter((c) => c === 'RENCONTRE').length, 2);
});

test('3a : deux pions qui arrivent sur le même croisement se rencontrent', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[4, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[4, 2], [3, 2]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 4, 2)]);
});

test('3a : segment partagé (même sens) -> annulés', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 1]] } });
  // A : (2,2)->(3,2)->(4,2) ; B : (3,1)->(3,2)->(4,2)->(4,3) : segment (3,2)-(4,2) commun.
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: deplacer(ch(n, [[3, 1], [3, 2], [4, 2], [4, 3]])) });
  assert.ok(r.journal.some((x) => x.code === 'RENCONTRE' && /segment/.test(x.texte)));
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
});

test('3b : pose sur le trajet adverse -> trajet annulé, pose annulée (pose_coupante = annulee)', () => {
  const e = etatAvec({ pions: { A: [[1, 1]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[1, 1], [2, 1], [3, 1]])), B: poser(cr(n, 2, 1)) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 1, 1)]);
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 5);
  assert.deepEqual(r.etat.couleurs, {});
});

test('3b : pose_coupante = maintenue -> la pose a lieu', () => {
  const e = etatAvec({ pions: { A: [[1, 1]] }, params: { pose_coupante: 'maintenue' } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[1, 1], [2, 1], [3, 1]])), B: poser(cr(n, 3, 1)) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 1, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 1)]);
});

test('3c : deux poses sur le même croisement -> les deux annulées', () => {
  const r = resoudreTour(etatAvec(), { A: poser(cr(n, 4, 4)), B: poser(cr(n, 4, 4)) });
  assert.deepEqual(r.etat.pions, { A: [], B: [] });
  assert.equal(codes(r.journal).filter((c) => c === 'POSES').length, 2);
});

test('« rien » ne coupe rien ; une pose ailleurs non plus', () => {
  const e = etatAvec({ pions: { A: [[1, 1]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[1, 1], [2, 1]])), B: rien() });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 1)]);
  assert.equal(r.etat.couleurs[cleSegment(cr(n, 1, 1), cr(n, 2, 1))], 'A');
});

test('soutien : face à un trajet non soutenu, le trajet soutenu passe ; une pose ne le coupe pas', () => {
  const e = etatAvec({ pions: { A: [[2, 2], [2, 3]], B: [[4, 2]] }, params: { soutien: 'oui' } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]]), cr(n, 2, 3)), B: deplacer(ch(n, [[4, 2], [3, 2], [3, 1]])) });
  assert.ok(r.etat.pions.A.includes(cr(n, 3, 2)));
  assert.deepEqual(r.etat.pions.B, [cr(n, 4, 2)]);
  const r2 = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]]), cr(n, 2, 3)), B: poser(cr(n, 3, 2)) });
  assert.ok(r2.etat.pions.A.includes(cr(n, 3, 2)));
  assert.equal(r2.etat.reserve.B, 4);
});

// ---------------------------------------------------------------------------
// Décisions CDP du 03/11 : départ libéré, chaîne, échanges.
// ---------------------------------------------------------------------------

test('CDP : finir sur le départ libéré d’un pion adverse -> réussit', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  // B part vers le bas ; A finit sur (3,2), le départ de B.
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 3, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 4)]);
});

test('CDP : passer par le départ libéré sans s’arrêter -> coupure (les deux annulés)', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: deplacer(ch(n, [[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 2)]);
  assert.ok(r.journal.some((x) => x.code === 'RENCONTRE' && /\(3, 2\)/.test(x.texte)));
});

test('CDP : mouvement annulé, l’autre ne peut pas finir sur le croisement resté occupé (chaîne)', () => {
  // B (3,2) veut passer par (5,4), occupé par un pion A immobile : annulé.
  // A (2,2) voulait finir sur (3,2), départ de B : B reste, donc A est annulé à son tour.
  const e = etatAvec({ pions: { A: [[2, 2], [5, 4]], B: [[3, 2]] } });
  const r = resoudreTour(e, {
    A: deplacer(ch(n, [[2, 2], [3, 2]])),
    B: deplacer(ch(n, [[3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [5, 5]])),
  });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2), cr(n, 5, 4)].sort((a, b) => a - b));
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 2)]);
  const chaine = r.journal.filter((x) => x.code === 'CHAINE');
  assert.equal(chaine.length, 2);
  assert.match(chaine[0].texte, /Joueur B.*\(5, 4\) ne bouge pas/);
  assert.match(chaine[1].texte, /Joueur A.*\(3, 2\) ne bouge pas/);
});

test('CDP : pose adverse sur le départ d’un pion qui bouge -> les deux ordres annulés', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: poser(cr(n, 2, 2)) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 5);
  // Même avec pose_coupante = maintenue : l'exception ne vaut pas pour les poses.
  const e2 = etatAvec({ pions: { A: [[2, 2]] }, params: { pose_coupante: 'maintenue' } });
  const r2 = resoudreTour(e2, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: poser(cr(n, 2, 2)) });
  assert.deepEqual(r2.etat.pions.B, []);
  assert.deepEqual(pos(r2.etat, 'A'), [cr(n, 2, 2)]);
});

test('CDP : pose sur un pion adverse qui ne bouge pas -> pose annulée', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const r = resoudreTour(e, { A: rien(), B: poser(cr(n, 2, 2)) });
  assert.deepEqual(r.etat.pions.B, []);
  assert.ok(r.journal.some((x) => x.code === 'CHAINE'));
});

test('CDP : échange par des chemins différents -> les deux réussissent', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 3]] } });
  const r = resoudreTour(e, {
    A: deplacer(ch(n, [[2, 2], [3, 2], [3, 3]])),
    B: deplacer(ch(n, [[3, 3], [2, 3], [2, 2]])),
  });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 3, 3)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 2, 2)]);
});

test('CDP : échange par le même segment -> les deux annulés', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[3, 2], [2, 2]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 2)]);
  assert.ok(r.journal.some((x) => x.code === 'RENCONTRE' && /segment/.test(x.texte)));
});
