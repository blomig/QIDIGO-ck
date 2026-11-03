// Pont entre l'interface et l'IA : Web Worker si possible, sinon calcul direct (même code, même graine).
import { creerRng } from '../engine/rng.js';
import * as forte from './ia-forte.js';
import * as faible from './ia-faible.js';

let worker = null;
let attente = new Map();
let compteur = 0;
let poidsCharges = null;

function demarrerWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./worker-ia.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const f = attente.get(data.id);
      attente.delete(data.id);
      if (f) f.ok(data);
    };
    worker.onerror = () => {
      // Worker indisponible (ancien navigateur) : on repasse en calcul direct.
      for (const f of attente.values()) f.repli();
      attente.clear();
      worker = false;
    };
  } catch {
    worker = false;
  }
  return worker;
}

function direct(etat, joueur, niveau, graine, msMax) {
  const t = performance.now();
  const rng = creerRng(graine);
  const ordre = niveau === 'facile' ? faible.choisirOrdre(etat, joueur, rng) : forte.choisirOrdre(etat, joueur, rng, { msMax });
  return { ordre, ms: performance.now() - t, direct: true };
}

/**
 * Ordre de l'IA (promesse). `graine` : entier tiré du générateur de la partie (reproductible).
 * @returns {Promise<{ordre, ms}>}
 */
export function demanderOrdre(etat, joueur, niveau, graine, msMax = 900) {
  const w = demarrerWorker();
  if (!w) {
    if (!poidsCharges) poidsCharges = forte.chargerPoidsTunes();
    return poidsCharges.then(() => new Promise((ok) => setTimeout(() => ok(direct(etat, joueur, niveau, graine, msMax)), 0)));
  }
  const id = ++compteur;
  return new Promise((ok) => {
    attente.set(id, { ok, repli: () => ok(direct(etat, joueur, niveau, graine, msMax)) });
    w.postMessage({ id, etat, joueur, niveau, graine, msMax });
  });
}
