// Piste de Lomig (04/11, relayée par le CDP) : réglage conflit = synchro (pas à pas) et conflit_issue = annule | arret.
// Non publié (hors v0.3.1). Lectures littérales : QUESTIONS.md, section « conflit synchro ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, poser, deplacer, lot, parametresParDefaut } from '../engine/index.js';
import { etatAvec, ch, cr, codes } from './aide.js';

const n = 9;
const Y = (x) => ({ ordres: 'pion', conflit: 'synchro', conflit_issue: 'annule', ...x });
const d = (pts) => deplacer(ch(n, pts));
const pions = (e, j) => e.pions[j].slice().sort((x, y) => x - y);
const tri = (l) => l.map(([x, y]) => cr(n, x, y)).sort((u, v) => u - v);
const textes = (r) => r.journal.map((x) => x.texte).join('\n');
const jouer = (params, pA, pB, oA, oB) => resoudreTour(etatAvec({ params, pions: { A: pA, B: pB } }), { A: lot(...oA), B: lot(...oB) });

test('défauts v0.5 (décision Lomig 04/11 11 h 39) : conflit = synchro, conflit_issue = arret, soutien = oui', () => {
  const p = parametresParDefaut();
  assert.deepEqual([p.conflit, p.conflit_issue, p.soutien], ['synchro', 'arret', 'oui']);
});

// Deux trajets qui arrivent sur (3,1) au pas 2.
const memePas = (params) => jouer(params, [[1, 1]], [[3, 3]], [d([[1, 1], [2, 1], [3, 1]])], [d([[3, 3], [3, 2], [3, 1]])]);
test('synchro : même croisement au même pas -> conflit, égalité : les deux annulés', () => {
  const r = memePas(Y());
  assert.deepEqual(r.etat.pions.A, [cr(n, 1, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 3)]);
  assert.match(textes(r), /rencontre au croisement \(3, 1\) au pas 2/);
  assert.deepEqual(r.etat.couleurs, {});
});

test('synchro + arret : égalité -> les deux s’arrêtent au dernier croisement sans conflit, et colorent jusque-là', () => {
  const r = memePas(Y({ conflit_issue: 'arret' }));
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
  assert.equal(codes(r.journal).filter((c) => c === 'ARRET').length, 2);
  assert.deepEqual(Object.values(r.etat.couleurs).sort(), ['A', 'B']);
});

// B passe en (3,1) au pas 1, A au pas 2.
const quitte = (params) => jouer(params, [[1, 1]], [[3, 2]], [d([[1, 1], [2, 1], [3, 1], [4, 1]])], [d([[3, 2], [3, 1], [3, 0]])]);
test('synchro : croisement déjà quitté -> libre, les deux passent (trajet : les deux annulés)', () => {
  const r = quitte(Y());
  assert.deepEqual(r.etat.pions.A, [cr(n, 4, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 0)]);
  const t = quitte({ ordres: 'pion' });
  assert.deepEqual(t.etat.pions.A, [cr(n, 1, 1)]);
  assert.deepEqual(t.etat.pions.B, [cr(n, 3, 2)]);
});

test('conflit_issue n’a aucun effet en mode trajet', () => {
  for (const f of [quitte, memePas]) {
    const a = f({ ordres: 'pion' }), b = f({ ordres: 'pion', conflit_issue: 'arret' });
    assert.deepEqual(b.etat.pions, a.etat.pions);
    assert.deepEqual(b.journal, a.journal);
  }
});

test('synchro : face-à-face sur un segment -> les deux annulés (arret : idem, aucun croisement atteint)', () => {
  for (const issue of ['annule', 'arret']) {
    const r = jouer(Y({ conflit_issue: issue }), [[1, 1]], [[2, 1]], [d([[1, 1], [2, 1]])], [d([[2, 1], [1, 1]])]);
    assert.deepEqual(r.etat.pions.A, [cr(n, 1, 1)]);
    assert.deepEqual(r.etat.pions.B, [cr(n, 2, 1)]);
    assert.match(textes(r), /face-à-face sur le segment/);
  }
});

// A arrive en (2,1) au pas 1 ; B y passe au pas 2.
const surArrive = (params) => jouer(params, [[1, 1]], [[2, 3]], [d([[1, 1], [2, 1]])], [d([[2, 3], [2, 2], [2, 1], [2, 0]])]);
test('synchro : passer sur un pion arrivé -> il fait obstacle (Lomig 04/11) ; annule : le trajet reste à son départ, le pion arrivé garde son arrivée', () => {
  const r = surArrive(Y());
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 2, 3)]);
  assert.match(textes(r), /déjà arrivé en \(2, 1\) fait obstacle \(pas 2\)/);
});
test('synchro + arret : pion arrivé -> il garde son arrivée, le trajet qui passe s’arrête juste avant', () => {
  const r = surArrive(Y({ conflit_issue: 'arret' }));
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 2, 2)]);
  assert.ok(r.journal.some((x) => x.code === 'ARRET' && x.obstacle === 'arrive'));
});
test('Lomig 04/11 (point 1) : un pion arrivé PLUS FAIBLE fait quand même obstacle à un trajet soutenu (annule et arret)', () => {
  for (const [issue, finB] of [['annule', [2, 3]], ['arret', [2, 2]]]) {
    // B soutient son arrivée (2,0) depuis (3,0) : force 2 contre 1 ; A arrive en (2,1) au pas 1.
    const r = resoudreTour(etatAvec({ params: Y({ soutien: 'oui', conflit_issue: issue }), pions: { A: [[1, 1]], B: [[2, 3], [3, 0]] } }), {
      A: lot(d([[1, 1], [2, 1]])),
      B: lot(d([[2, 3], [2, 2], [2, 1], [2, 0]]), { type: 'soutenir', pion: cr(n, 3, 0), cible: cr(n, 2, 0) }),
    });
    assert.deepEqual(r.etat.pions.A, [cr(n, 2, 1)], issue);
    assert.deepEqual(pions(r.etat, 'B'), tri([finB, [3, 0]]), issue);
  }
});

test('synchro : pion immobile -> occupe son croisement à tous les pas (annule / arret)', () => {
  const o = () => [[d([[0, 1], [1, 1], [2, 1], [3, 1]])], []];
  const r = jouer(Y(), [[0, 1]], [[2, 1]], ...o());
  assert.deepEqual(r.etat.pions.A, [cr(n, 0, 1)]);
  assert.match(textes(r), /pion adverse en \(2, 1\) ne bouge pas/);
  const s = jouer(Y({ conflit_issue: 'arret' }), [[0, 1]], [[2, 1]], ...o());
  assert.deepEqual(s.etat.pions.A, [cr(n, 1, 1)]);
  assert.deepEqual(s.etat.pions.B, [cr(n, 2, 1)]);
});

test('synchro : le soutien joue au point de conflit -> l’arrivée soutenue passe, l’autre est annulé', () => {
  const r = resoudreTour(etatAvec({ params: Y({ soutien: 'oui' }), pions: { A: [[1, 1], [4, 1]], B: [[3, 3]] } }), {
    A: lot(d([[1, 1], [2, 1], [3, 1]]), { type: 'soutenir', pion: cr(n, 4, 1), cible: cr(n, 3, 1) }),
    B: lot(d([[3, 3], [3, 2], [3, 1]])),
  });
  assert.deepEqual(pions(r.etat, 'A'), tri([[3, 1], [4, 1]]));
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 3)]);
  assert.match(textes(r), /plus faible, 1 contre 2 \(en \(3, 1\)\)/);
  const s = resoudreTour(etatAvec({ params: Y({ soutien: 'oui', conflit_issue: 'arret' }), pions: { A: [[1, 1], [4, 1]], B: [[3, 3]] } }), {
    A: lot(d([[1, 1], [2, 1], [3, 1]]), { type: 'soutenir', pion: cr(n, 4, 1), cible: cr(n, 3, 1) }),
    B: lot(d([[3, 3], [3, 2], [3, 1]])),
  });
  assert.deepEqual(s.etat.pions.B, [cr(n, 3, 2)]);
});

test('Lomig 04/11 (point 3) : pose contre trajet à égalité -> la pose tient (quel que soit pose_coupante), le trajet s’arrête avant (arret) ou reste au départ (annule)', () => {
  const o = [[d([[1, 1], [2, 1], [3, 1], [4, 1]])], [poser(cr(n, 3, 1))]];
  for (const pc of ['annulee', 'maintenue']) {
    const r = jouer(Y({ pose_coupante: pc }), [[1, 1]], [], ...o);
    assert.deepEqual(r.etat.pions.A, [cr(n, 1, 1)]);
    assert.deepEqual(r.etat.pions.B, [cr(n, 3, 1)]);
    const s = jouer(Y({ conflit_issue: 'arret', pose_coupante: pc }), [[1, 1]], [], ...o);
    assert.deepEqual(s.etat.pions.A, [cr(n, 2, 1)]);
    assert.deepEqual(s.etat.pions.B, [cr(n, 3, 1)]);
  }
});

test('Lomig 04/11 (point 2) : égalité entre deux déplacements (arret) -> les deux s’arrêtent avant le conflit', () => {
  const r = memePas(Y({ conflit_issue: 'arret' }));
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 1)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
  assert.ok(!r.etat.pions.A.includes(cr(n, 3, 1)) && !r.etat.pions.B.includes(cr(n, 3, 1)));
});

test('synchro : cascade -> un pion annulé devient immobile et bloque un trajet qui passait sur son départ', () => {
  const r = jouer(Y(), [[5, 3], [6, 5]], [[5, 5]], [d([[5, 3], [5, 4]]), d([[6, 5], [5, 5], [4, 5]])], [d([[5, 5], [5, 4]])]);
  assert.deepEqual(pions(r.etat, 'A'), tri([[5, 3], [6, 5]]));
  assert.deepEqual(r.etat.pions.B, [cr(n, 5, 5)]);
  assert.match(textes(r), /pion adverse en \(5, 5\) ne bouge pas/);
  // Sans le conflit initial, le même trajet passe (B a quitté (5,5) au pas 1).
  const t = jouer(Y(), [[6, 5]], [[5, 5]], [d([[6, 5], [5, 5], [4, 5]])], [d([[5, 5], [5, 6]])]);
  assert.deepEqual(t.etat.pions.A, [cr(n, 4, 5)]);
});

test('IA forte v2 : joue des lots légaux en synchro (annule et arret)', async () => {
  const { choisirLot } = await import('../ai/ia-forte.js');
  const { creerRng, creerEtat, lotValide } = await import('../engine/index.js');
  for (const issue of ['annule', 'arret']) {
    let e = creerEtat({ conflit: 'synchro', conflit_issue: issue });
    const rng = creerRng(7);
    for (let t = 0; t < 8 && !e.fini; t++) {
      const o = { A: choisirLot(e, 'A', rng, { pion: { msMax: Infinity } }), B: choisirLot(e, 'B', rng, { pion: { msMax: Infinity } }) };
      for (const j of ['A', 'B']) if (o[j].type === 'lot') assert.ok(lotValide(e, j, o[j]));
      e = resoudreTour(e, o).etat;
    }
    assert.ok(e.tour > 1);
  }
});

// Bug corrigé (04/11, enquête équilibre A/B) : en synchro, deux trajets adverses peuvent parcourir le même
// segment à des pas différents ; la couleur se posait dans l'ordre A puis B (B gagnait toujours le segment).
test('synchro : segment parcouru par les deux camps à des pas différents -> le dernier passage colore (symétrique)', () => {
  const tA = [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]; // (1,1)-(2,1) au pas 1 -> 2
  const tB = [[2, 4], [2, 3], [2, 2], [2, 1], [1, 1]]; // (2,1)-(1,1) au pas 3 -> 4
  const seg = `${cr(n, 1, 1)}-${cr(n, 2, 1)}`;
  const r = jouer(Y(), [[0, 1]], [[2, 4]], [d(tA)], [d(tB)]);
  assert.equal(r.etat.couleurs[seg], 'B');
  const s = jouer(Y(), [[2, 4]], [[0, 1]], [d(tB)], [d(tA)]);
  assert.equal(s.etat.couleurs[seg], 'A');
  assert.deepEqual(s.etat.pions.A, [cr(n, 1, 1)]);
  const g = jouer(Y({ trace_adverse: 'garde' }), [[2, 4]], [[0, 1]], [d(tB)], [d(tA)]);
  assert.equal(g.etat.couleurs[seg], 'B'); // garde : la trace posée plus tôt dans le tour reste
});

test('synchro : symétrie A<->B + miroir sur des lots aléatoires (faible contre faible)', async () => {
  const { miroirs } = await import('./miroir.js');
  const { creerEtat, creerRng } = await import('../engine/index.js');
  const faible = await import('../ai/ia-faible.js');
  const canon = (e) => JSON.stringify([[...e.pions.A].sort(), [...e.pions.B].sort(), e.reserve, e.ctrl, Object.entries(e.couleurs).sort(), e.proprietaires, e.vainqueur]);
  let lots = 0;
  for (let g = 0; g < 24; g++) {
    let e = creerEtat({ conflit: 'synchro', conflit_issue: g % 2 ? 'arret' : 'annule', soutien: g % 4 < 2 ? 'non' : 'oui' });
    const M = miroirs(e.params.grille), rng = creerRng(500 + g);
    while (!e.fini) {
      const o = { A: faible.choisirOrdre(e, 'A', rng), B: faible.choisirOrdre(e, 'B', rng) };
      const r1 = resoudreTour(e, o), r2 = resoudreTour(M.etat(e), { A: M.ordre(o.B), B: M.ordre(o.A) });
      assert.equal(canon(r2.etat), canon(M.etat(r1.etat)), `partie ${g}, tour ${e.tour}`);
      e = r1.etat; lots++;
    }
  }
  assert.ok(lots > 200);
});

// Invariant (Lomig 04/11) : jamais deux pions sur un même croisement après la résolution.
const sansDoublon = (e) => { const t = [...e.pions.A, ...e.pions.B]; return new Set(t).size === t.length; };
test('propriété : jamais deux pions sur un croisement (synchro annule et arret, soutien non et oui, lots aléatoires)', async () => {
  const { creerEtat, creerRng } = await import('../engine/index.js');
  const faible = await import('../ai/ia-faible.js');
  let lots = 0;
  for (let g = 0; g < 80; g++) {
    let e = creerEtat({ conflit: 'synchro', conflit_issue: g % 2 ? 'arret' : 'annule', soutien: g % 4 < 2 ? 'non' : 'oui', pose_coupante: g % 8 < 4 ? 'annulee' : 'maintenue' });
    const rng = creerRng(3000 + g);
    while (!e.fini) {
      e = resoudreTour(e, { A: faible.choisirOrdre(e, 'A', rng), B: faible.choisirOrdre(e, 'B', rng) }).etat;
      assert.ok(sansDoublon(e), `partie ${g}, tour ${e.tour}`);
      lots++;
    }
  }
  assert.ok(lots > 500);
});

// Tests sur les défauts v0.5 (synchro + arret + soutien), sans rien épingler.
test('défauts v0.5 : arrivée soutenue -> passe ; l’autre s’arrête avant', async () => {
  const { creerEtat, copier, geler, indice } = await import('../engine/index.js');
  const e = copier(creerEtat({}));
  e.pions = { A: [cr(n, 1, 1), cr(n, 4, 1)], B: [cr(n, 3, 3)] }; e.reserve = { A: e.params.nbPions - 2, B: e.params.nbPions - 1 };
  const r = resoudreTour(geler(e), { A: lot(d([[1, 1], [2, 1], [3, 1]]), { type: 'soutenir', pion: cr(n, 4, 1), cible: cr(n, 3, 1) }), B: lot(d([[3, 3], [3, 2], [3, 1]])) });
  assert.deepEqual(pions(r.etat, 'A'), tri([[3, 1], [4, 1]]));
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
});
test('défauts v0.5 : parties forte contre faible -> invariant tenu, lots légaux, soutiens joués', async () => {
  const { choisirLot } = await import('../ai/ia-forte.js');
  const faible = await import('../ai/ia-faible.js');
  const { creerEtat, creerRng, lotValide } = await import('../engine/index.js');
  let soutiens = 0;
  for (let g = 0; g < 3; g++) {
    let e = creerEtat({}); const rng = creerRng(40 + g);
    while (!e.fini) {
      const oA = choisirLot(e, 'A', rng, { pion: { msMax: Infinity } });
      if (oA.type === 'lot') { assert.ok(lotValide(e, 'A', oA)); soutiens += oA.ordres.filter((x) => x.type === 'soutenir').length; }
      e = resoudreTour(e, { A: oA, B: faible.choisirOrdre(e, 'B', rng) }).etat;
      assert.ok(sansDoublon(e));
    }
    assert.equal(e.vainqueur, 'A');
  }
  assert.ok(soutiens > 0);
});
