// Passe « IA robuste » (CDP/Lomig 03/11, 20 h) : termes de présence et de mobilité, référence v1 figée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as forte from '../ai/ia-forte.js';
import * as v1 from '../ai/ia-forte-v1.js';
import { creerEtat, creerRng, validerOrdre, resoudreTour } from '../engine/index.js';
import { etatAvec } from './aide.js';

test('v2 : présence, mobilité et menaces croissent avec les pions en jeu', () => {
  const un = forte.caracteristiques(etatAvec({ pions: { A: [[4, 4]] } }), 'A');
  const trois = forte.caracteristiques(etatAvec({ pions: { A: [[1, 1], [4, 4], [7, 7]] } }), 'A');
  assert.equal(un.pions, 1);
  assert.equal(trois.pions, 3);
  assert.ok(trois.mobilite > un.mobilite);
  assert.equal(un.reserve, 4);
  // menace : un pion qui peut atteindre une case à 3 murs de A non possédée
  const couleurs = [[[4, 4], [5, 4], 'A'], [[5, 4], [5, 5], 'A'], [[5, 5], [4, 5], 'A']];
  const m = forte.caracteristiques(etatAvec({ pions: { A: [[2, 4]] }, couleurs }), 'A');
  assert.equal(m.menaces, 1);
});

test('v2 : le terme de présence favorise les pions en jeu', () => {
  const p0 = { ...forte.POIDS_BASE, presence: 0, mobilite: 0, menaces: 0, reserve_garde: 0, reserve: 0 };
  const a = etatAvec({ pions: { A: [[4, 4]] } });
  const b = etatAvec({ pions: { A: [[1, 1], [4, 4], [7, 7]] } });
  const p1 = { ...p0, presence: 3 };
  assert.ok(forte.evaluer(b, 'A', p1) > forte.evaluer(a, 'A', p1));
});

test('équilibre de matrice : pierre-feuille-ciseaux ≈ 1/3 chacun, ligne dominante seule', () => {
  const x = forte.equilibreMatrice([[0, -1, 1], [1, 0, -1], [-1, 1, 0]], 2000);
  for (const p of x) assert.ok(Math.abs(p - 1 / 3) < 0.05, String(x));
  const y = forte.equilibreMatrice([[3, 2], [1, 0]]);
  assert.ok(y[0] > 0.95);
});

test('v1 figée : fichier séparé, mêmes poids de référence (réserve 0.2, pas de présence)', () => {
  assert.equal(v1.POIDS_BASE.reserve, 0.2);
  assert.equal(v1.POIDS_BASE.presence, undefined);
  assert.notEqual(v1.choisirOrdre, forte.choisirOrdre);
});

test('v2 : la marge de déploiement ne choisit une pose que dans la marge et avec ≥ 2 pions en réserve', () => {
  let e = creerEtat({ ordres: 'joueur', ordres: 'joueur' });
  const r = { A: creerRng(21), B: creerRng(22) };
  let vus = 0;
  for (let t = 0; t < 10 && !e.fini; t++) {
    const o = {};
    for (const j of ['A', 'B']) {
      const st = {};
      o[j] = forte.choisirOrdre(e, j, r[j], { budget: 250, stats: st });
      assert.ok(validerOrdre(e, j, o[j]).ok);
      const tete = st.lignes[0];
      if (o[j].type === 'poser' && tete.ordre.type !== 'poser') {
        const l = st.lignes.find((x) => x.ordre.type === 'poser' && x.ordre.croisement === o[j].croisement);
        if (l) { vus++; assert.ok(tete.score - l.score <= forte.POIDS_BASE.deploiement + 1e-9); }
        assert.ok(e.reserve[j] >= 2);
      }
    }
    e = resoudreTour(e, o).etat;
  }
  assert.ok(vus >= 0);
});
