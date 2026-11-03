// Journal des tours : liste lisible des résolutions (dernier tour en premier).

const CLASSES = {
  RENCONTRE: 'j-annule', COUPURE: 'j-annule', POSES: 'j-annule', CHAINE: 'j-annule', INVALIDE: 'j-annule',
  ZONE: 'j-gain', CAPTURE: 'j-gain', FIN: 'j-fin',
};

const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Entrées d'un tour en <li> (sans la ligne « — Tour n — »). */
export function lignes(journal) {
  return journal
    .filter((e) => e.code !== 'TOUR')
    .map((e) => `<li class="${CLASSES[e.code] || ''}">${echapper(e.texte)}</li>`)
    .join('');
}

/** Rend tout le journal de la partie. */
export function rendreJournal(conteneur, etat, entete = '') {
  const h = etat.historique;
  const blocs = h
    .slice()
    .reverse()
    .map((t) => `<section class="j-tour"><h3>Tour ${t.tour}</h3><ul>${lignes(t.journal)}</ul></section>`)
    .join('');
  conteneur.innerHTML = `${entete}${blocs || '<p class="r-note">Aucun tour joué pour l’instant.</p>'}`;
}
