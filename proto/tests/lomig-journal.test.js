// Non-régression : la partie de Lomig contre l'IA faible (03/11, graine 2761909367, 9×9).
// Elle a été jouée avec reprise = non (défaut publié à ce moment-là ; le journal ne contient aucune
// reprise, et avec reprise = oui la partie diverge au tour 9). On la rejoue donc avec ce réglage.
// Les ordres de A sont reconstitués depuis le journal, ceux de B figés (tests/journaux/lomig-2026-11-03-ordres.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { creerEtat, resoudreTour, creerRng, passer, validerOrdre } from '../engine/index.js';

import { choisirOrdre as forte } from '../ai/ia-forte.js';

const L = JSON.parse(fs.readFileSync(new URL('./journaux/lomig-2026-11-03-ordres.json', import.meta.url)));
const TXT = fs.readFileSync(new URL('./journaux/lomig-2026-11-03-graine-2761909367.txt', import.meta.url), 'utf8');
const casesA = (e) => e.proprietaires.filter((p) => p === 'A').length;

/** Positions réelles de la partie (début de chaque tour), avec les ordres de B figés (IA faible d'alors). */
function rejouer() {
  let e = creerEtat({ comptage: 'frontiere', ...L.params }); // partie jouée en croisements
  const etats = [];
  const journaux = [];
  for (const [t, oA] of L.ordresA.entries()) {
    etats.push(e);
    assert.ok(validerOrdre(e, 'B', L.ordresB[t]).ok, `ordre figé de B illégal au tour ${t + 1}`);
    const r = resoudreTour(e, { A: oA, B: L.ordresB[t] });
    journaux.push(r.journal);
    e = r.etat;
  }
  return { etats, journaux, fin: e };
}

test('Lomig : le moteur rejoue le journal à l’identique (A gagne 81 à 0 au tour 11)', () => {
  const { journaux, fin } = rejouer();
  const lignes = TXT.replace(/\n\s+(?=[a-zé(])/g, ' ').split('\n').map((l) => l.trim().replace(/^- /, '')).filter(Boolean);
  for (const j of journaux) for (const x of j) if (x.code !== 'TOUR') assert.ok(lignes.includes(x.texte), `ligne absente du journal de Lomig : ${x.texte}`);
  assert.equal(fin.vainqueur, 'A');
  assert.equal(fin.tour, 11);
  assert.deepEqual(fin.ctrl, { A: 81, B: 0 });
  // tour 11 : 24 cases d'un coup (diagnostic « dehors = plus grande région », voir QUESTIONS.md)
  assert.equal(casesA(fin) - casesA({ proprietaires: fin.proprietaires.map(() => null) }), 64);
});

test('Lomig : avec l’IA forte en B, les mêmes ordres de A ne gagnent plus', () => {
  let e = creerEtat({ comptage: 'frontiere', ...L.params }); // partie jouée en croisements
  const rng = creerRng(L.graine);
  for (const oA of L.ordresA) {
    if (e.fini) break;
    e = resoudreTour(e, { A: oA, B: forte(e, 'B', rng) }).etat;
  }
  assert.notEqual(e.vainqueur, 'A');
  assert.ok(e.ctrl.A < 30, `A contrôle encore ${e.ctrl.A} croisements`);
});

test('Lomig : dans les positions réelles, la forte bloque la fermeture de A aux tours 9 et 11 (au moins 3 sur 5)', () => {
  // Aux tours 7 et 8, A menace deux fermetures avec deux pions différents : un seul ordre de B
  // ne peut pas tout bloquer (89 ordres sur 406, puis 17 sur 580, arrêtent la fermeture réelle).
  const { etats } = rejouer();
  let bloquees = 0;
  const detail = [];
  for (const t of [6, 7, 8, 9, 11]) {
    const e = etats[t - 1];
    const oA = L.ordresA[t - 1];
    const sans = casesA(resoudreTour(e, { A: oA, B: passer() }).etat) - casesA(e);
    const oB = forte(e, 'B', creerRng(t));
    const avec = casesA(resoudreTour(e, { A: oA, B: oB }).etat) - casesA(e);
    assert.ok(sans > 0);
    if (avec === 0) bloquees++;
    detail.push(`${t}:${avec === 0 ? 'bloquée' : 'passe'}`);
    if (t === 9 || t === 11) assert.equal(avec, 0, `tour ${t} : la fermeture de A (${sans} cases) n’est pas bloquée`);
  }
  assert.ok(bloquees >= 3, detail.join(' '));
});
