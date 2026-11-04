// Coupures de base (regles-proto.md §1 et étape 3) et décisions CDP du 03/11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, poser, deplacer, rien, cleSegment, validerOrdre, creerEtat, creerRng } from '../engine/index.js';
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

test('soutien v0.3 (mode joueur) : un ordre de soutien seul ne bouge rien et ne coupe rien', () => {
  // Avec un ordre par joueur, soutenir prend l'unique ordre : le pion reste et aucun trajet n'est renforcé.
  const e = etatAvec({ pions: { A: [[2, 2], [2, 3]], B: [[4, 2]] }, params: { soutien: 'oui' } });
  const r = resoudreTour(e, { A: { type: 'soutenir', pion: cr(n, 2, 3), cible: cr(n, 3, 3) }, B: deplacer(ch(n, [[4, 2], [3, 2], [3, 1]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2), cr(n, 2, 3)].sort((a, b) => a - b));
  assert.deepEqual(r.etat.pions.B, [cr(n, 3, 1)]);
  assert.ok(codes(r.journal).includes('SOUTIEN'));
});

// ---------------------------------------------------------------------------
// Décisions CDP du 03/11 : départ libéré, chaîne, échanges.
// ---------------------------------------------------------------------------

// --- Réglage depart_libere = arrivee_seule (ancien choix CDP, toujours réglable) ---
const ARRIVEE = { depart_libere: 'arrivee_seule' };

test('arrivee_seule : finir sur le départ libéré d’un pion adverse -> réussit', () => {
  const e = etatAvec({ params: ARRIVEE, pions: { A: [[2, 2]], B: [[3, 2]] } });
  // B part vers le bas ; A finit sur (3,2), le départ de B.
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 3, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 4)]);
});

test('arrivee_seule : passer par le départ libéré sans s’arrêter -> coupure (les deux annulés)', () => {
  const e = etatAvec({ params: ARRIVEE, pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: deplacer(ch(n, [[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 2)]);
  assert.ok(r.journal.some((x) => x.code === 'RENCONTRE' && /\(3, 2\)/.test(x.texte)));
});

// --- Réglage par défaut depart_libere = traversee (décision Lomig 03/11, = regles-proto v0.2) ---

test('traversee (défaut) : c’est bien la valeur par défaut', () => {
  assert.equal(etatAvec().params.depart_libere, 'traversee');
});

test('traversee : finir sur le départ libéré -> réussit', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 3, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 4)]);
});

test('traversee : traverser le départ libéré -> les deux trajets réussissent', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: deplacer(ch(n, [[3, 2], [3, 3], [3, 4]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 4, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 4)]);
  assert.ok(!codes(r.journal).includes('RENCONTRE'));
  assert.ok(!codes(r.journal).includes('CHAINE'));
});

test('traversee : viser le croisement d’un pion qui ne part pas -> ordre annulé', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  for (const oB of [rien(), poser(cr(n, 7, 7))]) {
    const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: oB });
    assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
    assert.ok(r.journal.some((x) => x.code === 'CHAINE' && x.joueur === 'A'));
  }
});

test('traversee : traverser le croisement d’un pion qui ne part pas -> ordre annulé', () => {
  // B bouge un AUTRE pion : b en (3,2) reste, la traversée de A est annulée.
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2], [7, 7]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: deplacer(ch(n, [[7, 7], [7, 8]])) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 2), cr(n, 7, 8)].sort((a, b) => a - b));
  assert.ok(r.journal.some((x) => x.code === 'CHAINE' && x.joueur === 'A' && /\(3, 2\)/.test(x.texte)));
});

test('traversee : chaîne — trajet adverse annulé, donc la traversée de son départ est annulée', () => {
  // B (3,2) veut passer par (5,4), occupé par un pion A immobile : annulé.
  // A (2,2) voulait TRAVERSER (3,2), départ de B, jusqu'en (4,2) — sans toucher le trajet de B :
  // B reste, donc A est annulé à son tour.
  const e = etatAvec({ pions: { A: [[2, 2], [5, 4]], B: [[3, 2]] } });
  const r = resoudreTour(e, {
    A: deplacer(ch(n, [[2, 2], [2, 1], [3, 1], [3, 2], [3, 3]])),
    B: deplacer(ch(n, [[3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [5, 5]])),
  });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2), cr(n, 5, 4)].sort((a, b) => a - b));
  assert.deepEqual(pos(r.etat, 'B'), [cr(n, 3, 2)]);
  const chaine = r.journal.filter((x) => x.code === 'CHAINE');
  assert.equal(chaine.length, 2);
  assert.match(chaine[0].texte, /Joueur B.*\(5, 4\) ne bouge pas/);
  assert.match(chaine[1].texte, /Joueur A.*\(3, 2\) ne bouge pas/);
});

test('traversee : deux pions qui finissent sur le même croisement se rencontrent toujours', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[4, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: deplacer(ch(n, [[4, 2], [3, 2]])) });
  assert.ok(codes(r.journal).includes('RENCONTRE'));
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

// décision Lomig 03/11 (Q10) : on ne pose pas sur un croisement occupé (pion à soi ou adverse).
// L'ancien « veto » (pose sur le départ d'un pion qui bouge -> les deux ordres annulés) est impossible.
test('Lomig Q10 : pose sur le départ d’un pion adverse qui bouge -> ordre illégal, le déplacement a lieu', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const v = validerOrdre(e, 'B', poser(cr(n, 2, 2)));
  assert.equal(v.ok, false);
  assert.match(v.raison, /occupé par un pion adverse/);
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: poser(cr(n, 2, 2)) });
  // Occupation lue au début du tour : même si le pion part, la pose reste illégale (remplacée par « rien »).
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 4, 2)]);
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 5);
  assert.ok(r.journal.some((x) => x.code === 'INVALIDE' && x.joueur === 'B'));
  // Idem avec pose_coupante = maintenue.
  const e2 = etatAvec({ pions: { A: [[2, 2]] }, params: { pose_coupante: 'maintenue' } });
  const r2 = resoudreTour(e2, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: poser(cr(n, 2, 2)) });
  assert.deepEqual(r2.etat.pions.B, []);
  assert.deepEqual(pos(r2.etat, 'A'), [cr(n, 3, 2)]);
});

test('Lomig Q10 : pose sur un pion adverse immobile -> ordre illégal, rien n’est posé', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  assert.equal(validerOrdre(e, 'B', poser(cr(n, 2, 2))).ok, false);
  const r = resoudreTour(e, { A: rien(), B: poser(cr(n, 2, 2)) });
  assert.deepEqual(r.etat.pions.B, []);
  assert.equal(r.etat.reserve.B, 5);
  assert.ok(r.journal.some((x) => x.code === 'INVALIDE'));
});

test('Lomig Q10 : pose sur son propre pion (immobile ou qui part) -> ordre illégal', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const v = validerOrdre(e, 'A', poser(cr(n, 2, 2)));
  assert.equal(v.ok, false);
  assert.match(v.raison, /un de vos pions/);
  const r = resoudreTour(e, { A: poser(cr(n, 2, 2)), B: rien() });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 2)]);
  assert.equal(r.etat.reserve.A, 4);
});

test('Lomig Q10 : un croisement libre reste posable, y compris sur le trajet adverse (coupure 3b)', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  assert.equal(validerOrdre(e, 'B', poser(cr(n, 3, 2))).ok, true);
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [4, 2]])), B: poser(cr(n, 3, 2)) });
  assert.deepEqual(pos(r.etat, 'A'), [cr(n, 2, 2)]);
  assert.ok(r.journal.some((x) => x.code === 'COUPURE'));
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

test('Q10 : les IA faible et forte ne posent jamais sur un croisement occupé', async () => {
  const { choisirOrdre: faible } = await import('../ai/ia-faible.js');
  const { choisirOrdre: forteIA } = await import('../ai/ia-forte.js');
  const { occupant } = await import('../engine/etat.js');
  let poses = 0;
  for (const [ia, parties, budget] of [[faible, 20, null], [forteIA, 2, 150]]) {
    for (let g = 0; g < parties; g++) {
      let e = creerEtat({ ordres: 'joueur', grille: 9 });
      const rng = creerRng(1000 + g);
      while (!e.fini) {
        const ordres = {};
        for (const j of ['A', 'B']) {
          const o = budget ? ia(e, j, rng, { budget }) : ia(e, j, rng);
          if (o.type === 'poser') {
            poses++;
            assert.equal(occupant(e, o.croisement), null, `pose sur un croisement occupé (${o.croisement})`);
          }
          assert.ok(validerOrdre(e, j, o).ok);
          ordres[j] = o;
        }
        e = resoudreTour(e, ordres).etat;
      }
    }
  }
  assert.ok(poses > 50);
});
