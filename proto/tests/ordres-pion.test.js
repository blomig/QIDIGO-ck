// Mode `ordres = pion` (piste « un ordre par pion », CDP 03/11) : un ordre par pion + au plus
// poses_par_tour poses, résolus ensemble avec les règles actuelles. Chaque choix de conflit
// entre ordres d'un même joueur est listé dans QUESTIONS.md (« Ordres par pion »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, poser, deplacer, passer, lot, validerLotJoueur, validerOrdre, creerEtat, parametresParDefaut } from '../engine/index.js';
import { etatAvec, ch, cr, codes } from './aide.js';

const n = 9;
const P = (extra = {}) => ({ ordres: 'pion', ...extra });
const pos = (e, j) => e.pions[j].slice().sort((a, b) => a - b);
const tri = (l) => l.slice().sort((a, b) => a - b);
const d = (pts) => deplacer(ch(n, pts));
const rejets = (e, j, l) => validerLotJoueur(e, j, l).rejets.map((r) => r.raison);

test('défauts (décision Lomig 04/11) : ordres = pion, poses_par_tour = 1 ; un lot est invalide en mode joueur', () => {
  const p = parametresParDefaut();
  assert.equal(p.ordres, 'pion');
  assert.equal(p.poses_par_tour, 1);
  assert.equal(creerEtat().params.ordres, 'pion');
  const e = creerEtat({ ordres: 'joueur' });
  assert.equal(validerOrdre(e, 'A', lot(poser(0))).ok, false);
});

test('deux pions se déplacent au même tour, et une pose s’ajoute', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 1], [6, 6]] } });
  const r = resoudreTour(e, { A: lot(d([[1, 1], [2, 1], [3, 1]]), d([[6, 6], [6, 7]]), poser(cr(n, 4, 4))) });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 3, 1), cr(n, 6, 7), cr(n, 4, 4)]));
  assert.equal(r.etat.reserve.A, 2);
  assert.equal(codes(r.journal).filter((c) => c === 'DEPLACEMENT').length, 2);
  assert.equal(codes(r.journal).filter((c) => c === 'POSE').length, 1);
});

test('pion sans ordre = Passer implicite ; lot vide = « passe »', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 1], [6, 6]] } });
  const r = resoudreTour(e, { A: lot(d([[1, 1], [1, 2]])), B: lot() });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 1, 2), cr(n, 6, 6)]));
  assert.ok(r.journal.some((x) => x.code === 'PASSE' && x.joueur === 'B'));
  const r2 = resoudreTour(e, { A: passer() });
  assert.ok(r2.journal.some((x) => x.code === 'PASSE' && x.joueur === 'A'));
});

test('poses : une au plus par tour (défaut du mode), sans limite avec poses_par_tour = illimite, jamais plus que la réserve', () => {
  const e = etatAvec({ params: P() });
  const deux = lot(poser(cr(n, 1, 1)), poser(cr(n, 5, 5)));
  assert.match(rejets(e, 'A', deux)[0], /Au plus 1 pose/);
  const r = resoudreTour(e, { A: deux });
  assert.equal(r.etat.pions.A.length, 1);
  assert.ok(r.journal.some((x) => x.code === 'INVALIDE'));
  const e2 = etatAvec({ params: P({ poses_par_tour: 'illimite', nbPions: 2 }) });
  const r2 = resoudreTour(e2, { A: lot(poser(cr(n, 1, 1)), poser(cr(n, 5, 5)), poser(cr(n, 7, 7))) });
  assert.equal(r2.etat.pions.A.length, 2);
  assert.equal(r2.etat.reserve.A, 0);
  assert.match(rejets(e2, 'A', lot(poser(cr(n, 1, 1)), poser(cr(n, 5, 5)), poser(cr(n, 7, 7))))[0], /réserve/);
  assert.match(rejets(e2, 'A', lot(poser(cr(n, 1, 1)), poser(cr(n, 1, 1))))[0], /même croisement/);
});

test('un pion ne reçoit qu’un ordre', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 1]] } });
  assert.match(rejets(e, 'A', lot(d([[1, 1], [2, 1]]), d([[1, 1], [1, 2]])))[0], /déjà un ordre/);
});

test('deux trajets amis qui se croisent, partagent un segment ou visent la même arrivée : illégal à la saisie', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 2], [2, 1]] } });
  // croisement commun (2,2)
  assert.match(rejets(e, 'A', lot(d([[1, 2], [2, 2], [3, 2]]), d([[2, 1], [2, 2], [2, 3]])))[0], /rencontreraient/);
  // même arrivée (2,2)
  assert.match(rejets(e, 'A', lot(d([[1, 2], [2, 2]]), d([[2, 1], [2, 2]])))[0], /rencontreraient/);
  // segment commun (2,2)-(3,2)
  assert.match(rejets(e, 'A', lot(d([[1, 2], [2, 2], [3, 2]]), d([[2, 1], [3, 1], [3, 2], [2, 2]])))[0], /rencontreraient/);
  // le moteur ne garde que le premier : pas d'auto-annulation silencieuse
  const r = resoudreTour(e, { A: lot(d([[1, 2], [2, 2], [3, 2]]), d([[2, 1], [2, 2], [2, 3]])) });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 3, 2), cr(n, 2, 1)]));
  assert.ok(!codes(r.journal).includes('RENCONTRE'));
});

test('départ libéré par un pion AMI : on peut s’y arrêter ou le traverser (depart_libere = traversee)', () => {
  const e = etatAvec({ params: P(), pions: { A: [[2, 2], [1, 2]] } });
  // « train » : (2,2) part vers (4,2), (1,2) entre en (2,2) puis le traverse vers (2,3)
  const l = lot(d([[2, 2], [3, 2], [4, 2]]), d([[1, 2], [2, 2], [2, 3]]));
  assert.deepEqual(rejets(e, 'A', l), []);
  const r = resoudreTour(e, { A: l });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 4, 2), cr(n, 2, 3)]));
  // ordre donné dans l'autre sens : même résultat (la validation ne dépend pas de l'ordre de saisie)
  const r2 = resoudreTour(e, { A: lot(d([[1, 2], [2, 2], [2, 3]]), d([[2, 2], [3, 2], [4, 2]])) });
  assert.deepEqual(pos(r2.etat, 'A'), pos(r.etat, 'A'));
  // arrivee_seule : traverser est refusé, s'arrêter est permis
  const e2 = etatAvec({ params: P({ depart_libere: 'arrivee_seule' }), pions: { A: [[2, 2], [1, 2]] } });
  assert.match(rejets(e2, 'A', l)[0], /rencontreraient/);
  assert.deepEqual(rejets(e2, 'A', lot(d([[2, 2], [3, 2]]), d([[1, 2], [2, 2]]))), []);
});

test('traverser un pion ami qui ne part pas : illégal à la saisie', () => {
  const e = etatAvec({ params: P(), pions: { A: [[2, 2], [1, 2]] } });
  assert.match(rejets(e, 'A', lot(d([[1, 2], [2, 2], [3, 2]])))[0], /ne part pas|un de vos pions/);
});

test('chaîne amie : si le pion de tête est arrêté (rencontre adverse), le suiveur est annulé aussi', () => {
  const e = etatAvec({ params: P(), pions: { A: [[2, 2], [1, 2]], B: [[4, 1]] } });
  const r = resoudreTour(e, { A: lot(d([[2, 2], [3, 2], [4, 2]]), d([[1, 2], [2, 2]])), B: lot(d([[4, 1], [4, 2], [4, 3]])) });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 2, 2), cr(n, 1, 2)]));
  assert.ok(r.journal.some((x) => x.code === 'CHAINE' && /votre pion en \(2, 2\)/.test(x.texte)));
});

test('échange de places entre deux pions amis par des trajets disjoints : exécution simultanée', () => {
  const e = etatAvec({ params: P(), pions: { A: [[2, 2], [3, 3]] } });
  const r = resoudreTour(e, { A: lot(d([[2, 2], [3, 2], [3, 3]]), d([[3, 3], [2, 3], [2, 2]])) });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 2, 2), cr(n, 3, 3)]));
  assert.equal(codes(r.journal).filter((c) => c === 'DEPLACEMENT').length, 2);
});

test('pose sur le trajet de son propre pion : illégal ; pose sur son propre départ : illégal (occupé)', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 1]] } });
  assert.match(rejets(e, 'A', lot(d([[1, 1], [2, 1], [3, 1]]), poser(cr(n, 2, 1))))[0], /propre trajet/);
  assert.match(rejets(e, 'A', lot(poser(cr(n, 2, 1)), d([[1, 1], [2, 1], [3, 1]])))[0], /propre pose/);
  assert.match(rejets(e, 'A', lot(d([[1, 1], [2, 1]]), poser(cr(n, 1, 1))))[0], /occupé/);
});

test('conflits adverses à plusieurs : chaque rencontre est lue sur les ordres d’origine', () => {
  // A1 rencontre B1 et B2 : les trois annulés ; A2 passe.
  const e = etatAvec({ params: P(), pions: { A: [[3, 1], [7, 7]], B: [[2, 3], [4, 3]] } });
  const r = resoudreTour(e, {
    A: lot(d([[3, 1], [3, 2], [3, 3], [3, 4]]), d([[7, 7], [7, 6]])),
    B: lot(d([[2, 3], [3, 3]]), d([[4, 3], [4, 4], [3, 4]])),
  });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 3, 1), cr(n, 7, 6)]));
  assert.deepEqual(pos(r.etat, 'B'), tri([cr(n, 2, 3), cr(n, 4, 3)]));
  assert.equal(codes(r.journal).filter((c) => c === 'RENCONTRE').length, 3);
});

test('pose adverse qui coupe un des trajets : l’autre trajet du même joueur s’exécute', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 1], [6, 6]] } });
  const r = resoudreTour(e, { A: lot(d([[1, 1], [2, 1], [3, 1]]), d([[6, 6], [6, 7]])), B: lot(poser(cr(n, 2, 1))) });
  assert.deepEqual(pos(r.etat, 'A'), tri([cr(n, 1, 1), cr(n, 6, 7)]));
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 5);
});

test('deux poses adverses sur le même croisement : annulées (comme en mode joueur)', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 1]] } });
  const r = resoudreTour(e, { A: lot(poser(cr(n, 4, 4)), d([[1, 1], [1, 2]])), B: lot(poser(cr(n, 4, 4))) });
  assert.equal(codes(r.journal).filter((c) => c === 'POSES').length, 2);
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 1, 2)]);
});

test('fermetures multiples au même tour : chaque zone fermée compte (gain = union)', () => {
  const e = etatAvec({ params: P(), pions: { A: [[1, 0], [7, 8]] } });
  const r = resoudreTour(e, { A: lot(d([[1, 0], [1, 1], [0, 1]]), d([[7, 8], [7, 7], [8, 7]])) });
  assert.equal(r.etat.ctrl.A, 2);
  assert.ok(r.journal.some((x) => x.code === 'ZONE' && /2 cases/.test(x.texte)));
});

test('soutien en mode pion : le pion qui soutient ne se déplace pas', () => {
  const e = etatAvec({ params: P({ soutien: 'oui' }), pions: { A: [[2, 2], [2, 3]] } });
  const l = lot({ ...d([[2, 2], [3, 2]]), soutien: cr(n, 2, 3) }, d([[2, 3], [1, 3]]));
  assert.match(rejets(e, 'A', l)[0], /soutient|soutenir|qui soutient/);
});

// IA en mode pion, par défaut (décision Lomig 04/11).
test('mode pion par défaut : la faible et la forte donnent toujours des lots légaux ; la forte est reproductible', async () => {
  const faible = await import('../ai/ia-faible.js');
  const forte = await import('../ai/ia-forte.js');
  const { creerRng, lotValide } = await import('../engine/index.js');
  for (let g = 0; g < 3; g++) {
    let e = creerEtat({ grille: [7, 9, 9][g] });
    const rA = creerRng(40 + g), rB = creerRng(50 + g);
    const opt = { budget: 300, pion: { msMax: Infinity } };
    while (!e.fini) {
      const oA = forte.choisirOrdre(e, 'A', rA, opt);
      const oB = faible.choisirOrdre(e, 'B', rB);
      if (g === 0) assert.deepEqual(forte.choisirOrdre(e, 'A', creerRng(5), opt), forte.choisirOrdre(e, 'A', creerRng(5), opt));
      assert.ok(oA.type === 'lot' || oA.type === 'passer', JSON.stringify(oA));
      assert.ok(lotValide(e, 'A', oA), JSON.stringify(oA));
      assert.ok(lotValide(e, 'B', oB), JSON.stringify(oB));
      const r = resoudreTour(e, { A: oA, B: oB });
      assert.ok(!codes(r.journal).includes('INVALIDE'));
      e = r.etat;
    }
  }
});

test('mode pion (équivalent simple des pièges) : la forte prend une fermeture offerte en un trajet', async () => {
  const forte = await import('../ai/ia-forte.js');
  const { creerRng } = await import('../engine/index.js');
  const e = etatAvec({ params: { ordres: 'pion' }, pions: { A: [[0, 3], [6, 6]], B: [[7, 1]] },
    couleurs: [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[2, 2], [2, 3], 'A']] });
  for (let g = 0; g < 3; g++) {
    const o = forte.choisirOrdre(e, 'A', creerRng(g), { budget: 400, pion: { msMax: Infinity } });
    const r = resoudreTour(e, { A: o, B: passer() });
    assert.ok(r.etat.ctrl.A >= 6, `fermeture manquée : ${JSON.stringify(o)}`);
  }
});
