import { copier, geler, cleSegment } from "../engine/index.js";
const sw = (j) => (j === "A" ? "B" : j === "B" ? "A" : j);
export function miroirs(n) {
  const c = (i) => (n - 1 - (i % n)) + n * Math.floor(i / n);
  const m = n - 1, k = (i) => (m - 1 - (i % m)) + m * Math.floor(i / m);
  const seg = (s) => { const [a, b] = s.split('-').map(Number); return cleSegment(c(a), c(b)); };
  const ordre = (o) => {
    if (!o) return o;
    if (o.type === 'lot') return { ...o, ordres: o.ordres.map(ordre) };
    if (o.type === 'poser') return { ...o, croisement: c(o.croisement) };
    if (o.type === 'deplacer') return { ...o, chemin: o.chemin.map(c) };
    if (o.type === 'soutenir') return { ...o, pion: c(o.pion), cible: c(o.cible) };
    return o;
  };
  const etat = (e) => {
    const b = copier(e);
    b.pions = { A: e.pions.B.map(c), B: e.pions.A.map(c) };
    b.reserve = { A: e.reserve.B, B: e.reserve.A }; b.retires = { A: e.retires.B, B: e.retires.A }; b.ctrl = { A: e.ctrl.B, B: e.ctrl.A };
    b.couleurs = Object.fromEntries(Object.entries(e.couleurs).map(([s, j]) => [seg(s), sw(j)]));
    b.proprietaires = e.proprietaires.map((_, i) => sw(e.proprietaires[k(i)]));
    b.vainqueur = sw(e.vainqueur); b.historique = [];
    return geler(b);
  };
  return { c, ordre, etat };
}
