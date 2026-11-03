// Reprise de territoire (regles-proto.md §3, étape 5) : `reprise = oui` par défaut (décision Lomig 03/11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, deplacer, passer, parametresParDefaut, indiceCase, copier, geler, compter } from '../engine/index.js';
import { etatAvec, ch, cr } from './aide.js';

const n = 9;
const K = (i, j) => indiceCase(n, i, j);

/** B possède le bloc de cases 3..5 × 3..5 ; A a déjà tracé 3 côtés du rectangle x 3..5, y 3..4. */
function situation(params = {}) {
  const e = copier(etatAvec({
    params,
    pions: { A: [[5, 4]], B: [[8, 8]] },
    couleurs: [[[3, 3], [4, 3], 'A'], [[4, 3], [5, 3], 'A'], [[5, 3], [5, 4], 'A']],
  }));
  for (let i = 3; i <= 5; i++) for (let j = 3; j <= 5; j++) e.proprietaires[K(i, j)] = 'B';
  e.ctrl = compter(geler(copier(e)));
  return geler(e);
}
// A referme le rectangle : (5,4) -> (4,4) -> (3,4) -> (3,3). La zone couvre les cases (3,3) et (4,3).
const fermer = () => deplacer(ch(n, [[5, 4], [4, 4], [3, 4], [3, 3]]));

test('reprise vaut « oui » par défaut', () => {
  assert.equal(parametresParDefaut().reprise, 'oui');
});

test('reprise partielle : seules les cases couvertes par la zone changent de main', () => {
  const e = situation();
  assert.equal(e.proprietaires.filter((p) => p === 'B').length, 9);
  const r = resoudreTour(e, { A: fermer(), B: passer() });
  const P = r.etat.proprietaires;
  assert.equal(P[K(3, 3)], 'A');
  assert.equal(P[K(4, 3)], 'A');
  for (const [i, j] of [[5, 3], [3, 4], [4, 4], [5, 4], [3, 5], [4, 5], [5, 5]]) assert.equal(P[K(i, j)], 'B', `case (${i}, ${j})`);
  assert.equal(P.filter((p) => p === 'B').length, 7);
});

test('reprise : les croisements contrôlés sont recalculés pour les deux joueurs', () => {
  const e = situation();
  assert.deepEqual(e.ctrl, { A: 0, B: 16 });
  const r = resoudreTour(e, { A: fermer(), B: passer() });
  // A : (3,3) et (4,3). B perd ces 2 croisements et les 4 de la nouvelle frontière commune.
  assert.deepEqual(r.etat.ctrl, { A: 2, B: 10 });
});

test('reprise : une ligne de journal « Joueur A reprend 2 cases à Joueur B. »', () => {
  const r = resoudreTour(situation(), { A: fermer(), B: passer() });
  const l = r.journal.find((x) => x.code === 'REPRISE');
  assert.ok(l);
  assert.equal(l.texte, 'Joueur A reprend 2 cases à Joueur B.');
  assert.equal(l.joueur, 'A');
  assert.deepEqual(l.cases, [K(3, 3), K(4, 3)].sort((a, b) => a - b));
  assert.ok(!r.journal.some((x) => x.code === 'ZONE')); // aucune case neuve
});

test('reprise = non : rien n’est repris, le territoire reste acquis', () => {
  const e = situation({ reprise: 'non' });
  const r = resoudreTour(e, { A: fermer(), B: passer() });
  assert.deepEqual(r.etat.proprietaires, e.proprietaires);
  assert.deepEqual(r.etat.ctrl, { A: 0, B: 16 });
  assert.ok(!r.journal.some((x) => x.code === 'REPRISE'));
});

test('reprise : une case reprise puis encerclée en retour change encore de main (2 allers-retours)', () => {
  // Une seule case (3,3), encerclée tour à tour par A puis par B (trajets de 6 segments :
  // au-delà du défaut de 5, on lance ce test avec trajet_max = illimité).
  let e = etatAvec({ params: { trajet_max: 'illimite' }, pions: { A: [[2, 3]], B: [[5, 4]] } });
  const A1 = [[2, 3], [3, 3], [4, 3], [4, 4], [3, 4], [3, 3], [3, 2]];
  const A2 = [[3, 2], [3, 3], [4, 3], [4, 4], [3, 4], [3, 3], [2, 3]];
  const B1 = [[5, 4], [4, 4], [3, 4], [3, 3], [4, 3], [4, 4], [4, 5]];
  const B2 = [[4, 5], [4, 4], [3, 4], [3, 3], [4, 3], [4, 4], [5, 4]];
  const tours = [['A', A1, null], ['B', B1, 'A'], ['A', A2, 'B'], ['B', B2, 'A'], ['A', A1, 'B']];
  for (const [P, chemin, avant] of tours) {
    const Q = P === 'A' ? 'B' : 'A';
    const r = resoudreTour(e, { [P]: deplacer(ch(n, chemin)), [Q]: passer() });
    assert.equal(r.etat.proprietaires[K(3, 3)], P, `tour ${e.tour} : la case revient à ${P}`);
    assert.equal(r.etat.ctrl[P], 4);
    assert.equal(r.etat.ctrl[Q], 0);
    if (avant) assert.ok(r.journal.some((x) => x.code === 'REPRISE' && x.joueur === P && x.cases.includes(K(3, 3))));
    else assert.ok(r.journal.some((x) => x.code === 'ZONE' && x.joueur === P));
    e = r.etat;
  }
});

// Reprise disputée au même tour : A encercle la case (3,3) de B (carré 3..4) pendant que B encercle
// tout le carré 2..5 (qui couvre aussi (3,3)). Les trajets n'ont ni croisement ni segment communs.
function dispute(params) {
  const e0 = copier(etatAvec({ params: { trajet_max: 'illimite', ...params }, pions: { A: [[3, 3]], B: [[2, 2]] } }));
  e0.proprietaires[K(3, 3)] = 'B';
  e0.proprietaires[K(2, 2)] = 'A';
  const e = geler(e0);
  return resoudreTour(e, {
    A: deplacer(ch(n, [[3, 3], [4, 3], [4, 4], [3, 4], [3, 3]])),
    B: deplacer(ch(n, [[2, 2], [3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [2, 5], [2, 4], [2, 3], [2, 2]])),
  });
}

test('reprise disputée (provisoire, défaut « defense ») : la case reste à son propriétaire ; l’autre reprise a lieu', () => {
  const r = dispute({});
  assert.equal(r.etat.params.reprise_meme_tour, 'defense');
  assert.equal(r.etat.proprietaires[K(3, 3)], 'B'); // dans les deux gains -> propriétaire d'avant
  assert.equal(r.etat.proprietaires[K(2, 2)], 'B'); // B reprend la case de A
  assert.ok(r.journal.some((x) => x.code === 'REPRISE' && x.joueur === 'B' && x.cases.includes(K(2, 2))));
  assert.ok(!r.journal.some((x) => x.code === 'REPRISE' && x.joueur === 'A'));
});

test('reprise disputée, réglage « attaque » : l’attaquant prend la case', () => {
  const r = dispute({ reprise_meme_tour: 'attaque' });
  assert.equal(r.etat.proprietaires[K(3, 3)], 'A');
  assert.equal(r.etat.proprietaires[K(2, 2)], 'B');
});
