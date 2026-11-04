// regles-proto v0.3 (Lomig 04/11) : soutien §3 (exemples S-1 à S-4), réglages du §4 et lectures L1-L5
// (tranchées par Lomig le 04/11 : soutien_point = arrivee, soutien_adverse = non, soutien_pose = non,
// trajets amis qui se croisent refusés, coupure = arret ; tous restent réglables).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, poser, deplacer, lot, validerLotJoueur, parametresParDefaut } from '../engine/index.js';
import { etatAvec, ch, cr, codes } from './aide.js';

const n = 9;
const S = (x) => ({ ordres: 'pion', soutien: 'oui', ...x });
const d = (pts) => deplacer(ch(n, pts));
const sout = (a, b, pour) => ({ type: 'soutenir', pion: cr(n, ...a), cible: cr(n, ...b), ...(pour ? { pour } : {}) });
const a = (e, j) => e.pions[j].slice().sort((x, y) => x - y);
const tri = (l) => l.map(([x, y]) => cr(n, x, y)).sort((u, v) => u - v);
const textes = (r) => r.journal.map((x) => x.texte).join('\n');

test('défauts (v0.5 : soutien oui, décision Lomig 04/11 11 h 39) ; L1-L5 aux valeurs tranchées par Lomig (04/11) ; nouveaux réglages au comportement en vigueur', () => {
  const p = parametresParDefaut();
  assert.deepEqual([p.soutien, p.soutien_point, p.soutien_adverse, p.soutien_pose, p.coupure], ['oui', 'arrivee', 'non', 'non', 'arret']);
  assert.deepEqual([p.retrace_ferme, p.departage, p.annule_coupe, p.territoire_acquis, p.depart_libere], ['oui', 'cases_puis_nul', 'oui', 'acquis', 'traversee']);
});

// S-1
const s1 = (params) => {
  const e = etatAvec({ params, pions: { A: [[3, 1], [2, 2]], B: [[3, 3]] } });
  return resoudreTour(e, { A: lot(d([[3, 1], [3, 2]]), sout([2, 2], [3, 2])), B: lot(d([[3, 3], [3, 2]])) });
};
test('S-1 : arrivée soutenue -> a1 passe, b1 annulé (plus faible en (3,2), 1 contre 2)', () => {
  for (const pt of ['arrivee', 'rencontre', 'trajet']) {
    const r = s1(S({ soutien_point: pt }));
    assert.deepEqual(a(r.etat, 'A'), tri([[3, 2], [2, 2]]), pt);
    assert.deepEqual(r.etat.pions.B, [cr(n, 3, 3)]);
    assert.match(textes(r), /plus faible, 1 contre 2 \(en \(3, 2\)\)/);
  }
  const sans = s1({ ordres: 'pion' }); // soutien = non : l'ordre de soutien est invalide, les deux trajets annulés
  assert.deepEqual(a(sans.etat, 'A'), tri([[3, 1], [2, 2]]));
  assert.deepEqual(sans.etat.pions.B, [cr(n, 3, 3)]);
});

test('S-2 : soutien coupé par un trajet qui échoue -> a1, b1 et b2 annulés', () => {
  const e = etatAvec({ params: S(), pions: { A: [[3, 1], [2, 2]], B: [[3, 3], [1, 2]] } });
  const r = resoudreTour(e, { A: lot(d([[3, 1], [3, 2]]), sout([2, 2], [3, 2])), B: lot(d([[3, 3], [3, 2]]), d([[1, 2], [2, 2]])) });
  assert.ok(codes(r.journal).includes('SOUTIEN_COUPE'));
  assert.deepEqual(a(r.etat, 'A'), tri([[3, 1], [2, 2]]));
  assert.deepEqual(a(r.etat, 'B'), tri([[3, 3], [1, 2]]));
  assert.match(textes(r), /pion adverse en \(2, 2\) ne bouge pas/);
  assert.deepEqual(r.etat.couleurs, {});
});

test('S-3 : arrivée contre traversée -> a1 passe ; b1 annulé, sans trace', () => {
  for (const pt of ['arrivee', 'rencontre']) {
    const e = etatAvec({ params: S({ soutien_point: pt }), pions: { A: [[4, 3], [4, 1]], B: [[3, 2]] } });
    const r = resoudreTour(e, { A: lot(d([[4, 3], [4, 2]]), sout([4, 1], [4, 2])), B: lot(d([[3, 2], [4, 2], [5, 2]])) });
    assert.deepEqual(a(r.etat, 'A'), tri([[4, 2], [4, 1]]));
    assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
    assert.ok(!Object.values(r.etat.couleurs).includes('B'));
  }
});

test('S-3 variante (v0.3.1) : b2 en (6,2) soutient (5,2), l’arrivée de b1 -> 2 contre 2 en (4,2), les deux annulés', () => {
  const e = etatAvec({ params: S(), pions: { A: [[4, 3], [4, 1]], B: [[3, 2], [6, 2]] } });
  const r = resoudreTour(e, { A: lot(d([[4, 3], [4, 2]]), sout([4, 1], [4, 2])), B: lot(d([[3, 2], [4, 2], [5, 2]]), sout([6, 2], [5, 2])) });
  assert.deepEqual(a(r.etat, 'A'), tri([[4, 3], [4, 1]]));
  assert.deepEqual(a(r.etat, 'B'), tri([[3, 2], [6, 2]]));
  assert.deepEqual(r.etat.couleurs, {});
});

test('S-5 : rencontre au milieu d’un trajet soutenu par son arrivée -> a1 passe 2 contre 1, b1 annulé', () => {
  const e = etatAvec({ params: S(), pions: { A: [[2, 3], [5, 3]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: lot(d([[2, 3], [3, 3], [4, 3]]), sout([5, 3], [4, 3])), B: lot(d([[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(a(r.etat, 'A'), tri([[4, 3], [5, 3]]));
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
  assert.equal(Object.values(r.etat.couleurs).filter((c) => c === 'A').length, 2);
  assert.match(textes(r), /plus faible, 1 contre 2/);
  // même règle sur un segment commun : a1 (2,3)->(3,3)->(4,3) et b1 (4,3)... b1 (3,3)->(2,3) partage le segment
  const e2 = etatAvec({ params: S(), pions: { A: [[2, 3], [5, 3]], B: [[4, 4]] } });
  const r2 = resoudreTour(e2, { A: lot(d([[2, 3], [3, 3], [4, 3]]), sout([5, 3], [4, 3])), B: lot(d([[4, 4], [3, 4], [3, 3], [2, 3], [2, 2]])) });
  assert.ok(r2.etat.pions.A.includes(cr(n, 4, 3)));
  assert.deepEqual(r2.etat.pions.B, [cr(n, 4, 4)]);
});

test('S1 : soutien en défense et soutien sans objet sont journalisés', () => {
  const e = etatAvec({ params: S(), pions: { A: [[2, 2], [2, 3], [5, 5]] } });
  const r = resoudreTour(e, { A: lot(sout([2, 3], [2, 2]), sout([5, 5], [5, 6])) });
  assert.match(textes(r), /soutien en défense/);
  assert.match(textes(r), /soutien sans objet/);
});

test('S-4 : pose contre trajet soutenu -> a1 passe, la pose de B est annulée ; sans soutien, base', () => {
  const coups = { A: lot(d([[2, 4], [2, 5]]), sout([1, 5], [2, 5])), B: lot(poser(cr(n, 2, 5))) };
  const r = resoudreTour(etatAvec({ params: S(), pions: { A: [[2, 4], [1, 5]] } }), coups);
  assert.deepEqual(a(r.etat, 'A'), tri([[2, 5], [1, 5]]));
  assert.equal(r.etat.reserve.B, 5);
  const base = { A: lot(d([[2, 4], [2, 5]])), B: lot(poser(cr(n, 2, 5))) };
  const r0 = resoudreTour(etatAvec({ params: { ordres: 'pion' }, pions: { A: [[2, 4], [1, 5]] } }), base);
  assert.deepEqual(a(r0.etat, 'A'), tri([[2, 4], [1, 5]]));
  assert.equal(r0.etat.reserve.B, 5);
  const rm = resoudreTour(etatAvec({ params: { ordres: 'pion', pose_coupante: 'maintenue' }, pions: { A: [[2, 4], [1, 5]] } }), base);
  assert.deepEqual(rm.etat.pions.B, [cr(n, 2, 5)]);
  assert.deepEqual(a(rm.etat, 'A'), tri([[2, 4], [1, 5]]));
});

test('Exemple 5 en mode pion (défauts) : traverser le départ libéré -> les deux réussissent', () => {
  const e = etatAvec({ params: { ordres: 'pion' }, pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: lot(d([[2, 2], [2, 3]])), B: lot(d([[3, 2], [2, 2], [1, 2]])) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 3)]);
  assert.deepEqual(r.etat.pions.B, [cr(n, 1, 2)]);
});

test('L1 soutien_point : rencontre au milieu du trajet -> seul « rencontre »/« trajet » compte un soutien sur ce croisement', () => {
  // a1 (1,3)->(2,3)->(3,3) ; b1 (2,1)->(2,2)->(2,3) ; a2 en (2,4) soutient (2,3), le croisement de la rencontre.
  const coup = (pt) => resoudreTour(etatAvec({ params: S({ soutien_point: pt }), pions: { A: [[1, 3], [2, 4]], B: [[2, 1]] } }),
    { A: lot(d([[1, 3], [2, 3], [3, 3]]), sout([2, 4], [2, 3])), B: lot(d([[2, 1], [2, 2], [2, 3]])) });
  assert.deepEqual(a(coup('arrivee').etat, 'A'), tri([[1, 3], [2, 4]])); // soutien sur (2,3) ≠ arrivée (3,3) : 1 contre 1
  assert.deepEqual(a(coup('rencontre').etat, 'A'), tri([[3, 3], [2, 4]]));
  assert.deepEqual(a(coup('trajet').etat, 'A'), tri([[3, 3], [2, 4]]));
});

test('L2 soutien_adverse : un soutien « pour l’adversaire » n’est accepté qu’avec oui, et renforce ses trajets', () => {
  const e = (x) => etatAvec({ params: S(x), pions: { A: [[3, 1], [2, 2]], B: [[3, 3]] } });
  const coups = { A: lot(d([[3, 1], [3, 2]])), B: lot(d([[3, 3], [3, 2]])) };
  assert.equal(validerLotJoueur(e({}), 'A', lot(sout([2, 2], [3, 2], 'adverse'))).ordres.length, 0);
  const r = resoudreTour(e({ soutien_adverse: 'oui' }), { ...coups, A: lot(d([[3, 1], [3, 2]]), sout([2, 2], [3, 2], 'adverse')) });
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 2)]);
  assert.deepEqual(a(r.etat, 'A'), tri([[3, 1], [2, 2]]));
});

test('L3 soutien_pose : une pose soutenue bat un trajet seul (oui) ; non : base', () => {
  const e = (x) => etatAvec({ params: S(x), pions: { A: [[2, 4]], B: [[1, 5]] } });
  const coups = { A: lot(d([[2, 4], [2, 5]])), B: lot(poser(cr(n, 2, 5)), sout([1, 5], [2, 5])) };
  const oui = resoudreTour(e({ soutien_pose: 'oui' }), coups);
  assert.ok(oui.etat.pions.B.includes(cr(n, 2, 5)));
  assert.deepEqual(oui.etat.pions.A, [cr(n, 2, 4)]);
  const non = resoudreTour(e({}), coups);
  assert.ok(!non.etat.pions.B.includes(cr(n, 2, 5)));
  assert.deepEqual(non.etat.pions.A, [cr(n, 2, 4)]);
});

test('L4 : deux trajets amis qui se croisent restent refusés à la saisie, soutien activé', () => {
  const e = etatAvec({ params: S(), pions: { A: [[2, 2], [4, 2], [3, 1]] } });
  const r = validerLotJoueur(e, 'A', lot(d([[2, 2], [3, 2], [3, 3]]), d([[4, 2], [3, 2], [3, 1]].slice(0, 2)), sout([3, 1], [3, 2])));
  assert.equal(r.ordres.filter((o) => o.type === 'deplacer').length, 1);
  assert.match(r.rejets[0].raison, /se rencontreraient/);
});

test('L5 coupure : une traversée du pion qui soutient ne coupe qu’avec « traversee » ; un trajet depuis la cible ne coupe jamais', () => {
  // S-1 + b2 (1,1)->(2,1)->(2,2)->(2,3)... ne peut traverser a2 (immobile) : on vérifie la coupure, pas l'exécution.
  const base = (x, b2) => resoudreTour(etatAvec({ params: S(x), pions: { A: [[3, 1], [2, 2]], B: [[3, 3], [1, 2]] } }),
    { A: lot(d([[3, 1], [3, 2]]), sout([2, 2], [3, 2])), B: lot(d([[3, 3], [3, 2]]), d(b2)) });
  const trav = [[1, 2], [2, 2], [2, 3]];
  assert.ok(!codes(base({}, trav).journal).includes('SOUTIEN_COUPE'));
  assert.ok(codes(base({ coupure: 'traversee' }, trav).journal).includes('SOUTIEN_COUPE'));
  // trajet adverse qui part du croisement soutenu et s'arrête sur le pion qui soutient : pas de coupure
  const e = etatAvec({ params: S(), pions: { A: [[2, 2], [4, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: lot(sout([2, 2], [3, 2]), d([[4, 2], [4, 3]])), B: lot(d([[3, 2], [2, 2]])) });
  assert.ok(!codes(r.journal).includes('SOUTIEN_COUPE'));
});

test('retrace_ferme : retracer sa trace ne ferme pas avec « non »', () => {
  // Carré (1,1)-(2,1)-(2,2)-(1,2) : trois côtés à A ; A retrace (1,1)-(2,1) puis ferme par (2,1)... non : on ferme en retraçant seulement.
  const couleurs = [[[1, 1], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[2, 2], [1, 2], 'A'], [[1, 2], [1, 1], 'A']];
  const coup = (x) => resoudreTour(etatAvec({ params: { ordres: 'pion', ...x }, pions: { A: [[1, 1]] }, couleurs }), { A: lot(d([[1, 1], [2, 1]])) });
  const oui = coup({});
  const non = coup({ retrace_ferme: 'non' });
  assert.equal(oui.journal.find((x) => x.code === 'DEPLACEMENT').retraces, 1);
  assert.ok(oui.etat.proprietaires.includes('A'));
  assert.ok(!non.etat.proprietaires.includes('A'));
});

test('departage = traces : égalité de cases au dernier tour -> le plus de segments gagne, sinon nul', () => {
  const coup = (x) => resoudreTour(etatAvec({ params: { ordres: 'pion', nbTours: 1, ...x }, pions: { A: [[1, 1]], B: [[6, 6]] }, tour: 1 }),
    { A: lot(d([[1, 1], [2, 1], [3, 1]])), B: lot(d([[6, 6], [6, 7]])) });
  assert.equal(coup({}).etat.vainqueur, 'nul');
  assert.equal(coup({ departage: 'traces' }).etat.vainqueur, 'A');
});

test('territoire_acquis = murs : une case perd son propriétaire quand l’adversaire recolore un de ses murs', () => {
  const couleurs = [[[1, 1], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[2, 2], [1, 2], 'A'], [[1, 2], [1, 1], 'A']];
  const coup = (x) => {
    const e = JSON.parse(JSON.stringify(etatAvec({ params: { ordres: 'pion', ...x }, pions: { B: [[3, 1]] }, couleurs })));
    e.proprietaires[e.proprietaires.length ? 1 * 0 + caseAt(e) : 0] = 'A';
    return resoudreTour(Object.freeze(e), { B: lot(d([[3, 1], [2, 1], [2, 2], [3, 2]])) });
  };
  const caseAt = (e) => { const r = resoudreTour(etatAvec({ params: { ordres: 'pion' }, pions: { A: [[1, 1]] }, couleurs }), { A: lot(d([[1, 1], [2, 1]])) }); return r.etat.proprietaires.indexOf('A'); };
  assert.equal(coup({}).etat.proprietaires.filter((p) => p === 'A').length, 1);
  const m = coup({ territoire_acquis: 'murs' });
  assert.equal(m.etat.proprietaires.filter((p) => p === 'A').length, 0);
  assert.ok(codes(m.journal).includes('MURS'));
});

test('annule_coupe : oui = ordres d’origine (un trajet annulé coupe quand même) ; non = séquentiel', () => {
  // b1 rencontre a1 (4a) ; A pose sur le chemin de b1 (4b). Oui : la pose coupe quand même -> annulée (pose_coupante).
  // Non : b1 est déjà annulé en 4a, la pose ne coupe plus rien et a lieu.
  const coup = (x) => resoudreTour(etatAvec({ params: { ordres: 'pion', ...x }, pions: { A: [[1, 4]], B: [[4, 1]] } }),
    { A: lot(d([[1, 4], [2, 4], [3, 4], [4, 4]]), poser(cr(n, 4, 2))), B: lot(d([[4, 1], [4, 2], [4, 3], [4, 4]])) });
  assert.ok(!coup({}).etat.pions.A.includes(cr(n, 4, 2)));
  assert.ok(coup({ annule_coupe: 'non' }).etat.pions.A.includes(cr(n, 4, 2)));
});

test('IA forte v2 : avec soutien = oui, ses lots contiennent des soutiens, et restent légaux', async () => {
  const { choisirLot } = await import('../ai/ia-forte.js');
  const { creerRng, creerEtat, lotValide } = await import('../engine/index.js');
  // S-1 du point de vue de A : b1 menace (3,2) ; la forte doit jouer le trajet ET le soutien, ou ne pas perdre.
  let vus = 0;
  for (let g = 0; g < 3; g++) {
    let e = creerEtat({ soutien: 'oui' });
    const rng = creerRng(10 + g);
    for (let t = 0; t < 12 && !e.fini; t++) {
      const o = { A: choisirLot(e, 'A', rng, { pion: { msMax: Infinity } }), B: choisirLot(e, 'B', rng, { pion: { msMax: Infinity } }) };
      for (const j of ['A', 'B']) {
        if (o[j].type !== 'lot') continue;
        assert.ok(lotValide(e, j, o[j]));
        vus += o[j].ordres.filter((x) => x.type === 'soutenir').length;
      }
      e = resoudreTour(e, o).etat;
    }
  }
  assert.ok(vus > 0, 'aucun soutien joué');
});
