// Web Worker (module) : calcule l'ordre de l'IA hors du fil principal, pour que l'interface reste fluide.
// Message reçu : { id, etat, joueur, niveau: 'fort' | 'facile', graine, msMax }
// Message envoyé : { id, ordre, ms, stats }
import { creerRng } from '../engine/rng.js';
import * as forte from './ia-forte.js';
import * as faible from './ia-faible.js';

const pret = forte.chargerPoidsTunes();

self.onmessage = async ({ data }) => {
  await pret;
  const t = performance.now();
  const rng = creerRng(data.graine);
  const stats = {};
  const ordre = data.niveau === 'facile'
    ? faible.choisirOrdre(data.etat, data.joueur, rng)
    : forte.choisirOrdre(data.etat, data.joueur, rng, { msMax: data.msMax ?? 900, stats });
  delete stats.lignes;
  delete stats.reponsesDetail;
  self.postMessage({ id: data.id, ordre, ms: performance.now() - t, stats });
};
