// Paramètres de partie, variantes et choix proto.
// Source : regles-proto.md v0.2 (Créa, 03/11/2026, 11 h 55) + choix proto du CDP (03/11), qui priment.
// Chaque point marqué « choix proto, à tester » dans regles-proto.md est un réglage ici,
// visible dans le panneau Réglages (ui/reglages.js lit REGLAGES).

export const JOUEURS = ['A', 'B'];
export const TAILLES_AUTORISEES = [7, 8, 9];

/**
 * Description de tous les réglages.
 *  - groupe : 'partie' | 'variante' (§3, 1er tableau) | 'choix' (§3, 2e tableau et choix proto §1/§4) | 'cdp'
 *  - desactivee : valeur qui signifie « variante désactivée » (pour l'affichage Activée/Désactivée)
 *  - fixe : true si regles-proto.md ne définit qu'une valeur (réglage affiché, non modifiable,
 *           l'alternative n'étant pas décrite — voir QUESTIONS.md).
 */
export const REGLAGES = [
  // --- Partie ---
  { id: 'grille', groupe: 'variante', libelle: 'Taille de la grille', type: 'choix', defaut: 9,
    valeurs: [[7, '7 × 7'], [8, '8 × 8'], [9, '9 × 9']],
    description: 'N×N croisements, (N−1)² cases. Lomig demande de ne pas exclure 8 ni 7 (K158).' },
  { id: 'nbPions', groupe: 'partie', libelle: 'Pions par joueur', type: 'nombre', defaut: 5, min: 1, max: 10,
    description: '5 pions identiques, tous en réserve au départ (Q9).' },
  { id: 'nbTours', groupe: 'partie', libelle: 'Nombre de tours', type: 'nombre', defaut: 20, min: 1, max: 60,
    description: '20 tours au plus.' },
  { id: 'dureeTourS', groupe: 'partie', libelle: 'Planification (s)', type: 'nombre', defaut: 20, min: 5, max: 120,
    description: 'Phase de planification de 20 s par tour (Q8).' },

  // --- Variantes activables (§3) ---
  // `capture` vaut `aucune` par défaut (décision CDP 03/11, reprise par regles-proto.md v0.2).
  { id: 'capture', groupe: 'variante', desactivee: 'aucune', libelle: 'Capture', type: 'choix', defaut: 'aucune',
    valeurs: [['aucune', 'Aucune'], ['retour', 'Retour en réserve'], ['sans_retour', 'Sans retour'], ['definitive', 'Définitive (= sans retour)']],
    description: 'Un pion adverse dont toutes les cases voisines sont dans une zone fermée à ce tour est capturé. « Retour » : il revient en réserve (Q4 a, Q5 a). « Sans retour » : il quitte la partie. « Définitive » (demande CDP 03/11) : alias de « Sans retour », le pion quitte la partie pour de bon. Un joueur sans aucun pion (en jeu ni en réserve) continue et ne peut que passer (choix proto, à confirmer par Lomig). Lomig remet Q4 et Q5 en question (K160).' },
  // décision Lomig 03/11 : un déplacement fait au plus 5 pas (5 segments) par défaut.
  { id: 'trajet_max', groupe: 'variante', desactivee: 'illimite', libelle: 'Longueur max. d’un trajet', type: 'choix', defaut: 5,
    valeurs: [['illimite', 'Illimitée'], [3, '3 segments'], [4, '4 segments'], [5, '5 segments'], [7, '7 segments']],
    description: 'Décision de Lomig (03/11) : un déplacement fait au plus 5 pas, soit 5 segments. Un trajet plus long est invalide. Les autres valeurs restent là pour tester. Un long trajet risque davantage d’être coupé (K98).' },
  { id: 'soutien', groupe: 'variante', desactivee: 'non', libelle: 'Soutien (façon Diplomacy)', type: 'choix', defaut: 'non',
    valeurs: [['non', 'Désactivé'], ['oui', 'Activé']],
    description: 'Un déplacement peut être soutenu par un pion voisin du départ : face à un trajet non soutenu, il passe ; une pose ne le coupe pas (K161).' },
  { id: 'traces', groupe: 'variante', libelle: 'Rôle des traces', type: 'choix', defaut: 'bord_de_zone',
    valeurs: [['bord_de_zone', 'Bords de zone'], ['decoratives', 'Décoratives']],
    description: '« Bords de zone » : murs = bord + toutes vos traces. « Décoratives » : murs = bord + votre seul trajet de ce tour (une zone se ferme en un trajet). Q11.' },
  // demande CDP 03/11 (Q7, en attente de Lomig) : quelles régions sont des zones. « actuel » reste le défaut.
  { id: 'zone_regle', groupe: 'variante', libelle: 'Qu’est-ce qu’une zone (Q7)', type: 'choix', defaut: 'actuel',
    valeurs: [['actuel', 'Tout sauf la plus grande région'], ['sans_pion_adverse', 'Sans pion adverse à l’intérieur'], ['dehors_non_possede', 'Dehors = le plus de cases non possédées'], ['moitie_libre', 'Au plus la moitié des cases non possédées']],
    description: 'Q7, en attente de Lomig. Vos murs découpent le plateau en régions. « Tout sauf la plus grande région » (défaut, règle actuelle) : toutes les autres sont des zones. « Sans pion adverse » : en plus, une région qui a un pion adverse sur un croisement intérieur (ses 4 cases dans la région, pas sur son bord) n’est pas une zone. « Dehors = le plus de cases non possédées » : le dehors est la région qui a le plus de cases que vous ne possédez pas. « Au plus la moitié » : en plus, une zone fait au plus la moitié des cases que vous ne possédez pas encore.' },
  // décision Lomig 03/11 : reprise = oui par défaut (on garde « non » dans les Réglages).
  { id: 'reprise', groupe: 'variante', desactivee: 'non', libelle: 'Reprise de territoire', type: 'choix', defaut: 'oui',
    valeurs: [['non', 'Désactivée'], ['oui', 'Activée']],
    description: 'Décision de Lomig (03/11) : activée par défaut. Fermer une zone prend toutes ses cases, y compris celles de l’adversaire : on reprend un territoire par morceaux en fermant une zone qui en couvre une partie (K98). Une case gagnée par les deux au même tour garde son propriétaire (étape 6). Désactivée : on ne gagne que les cases sans propriétaire.' },
  // A CONFIRMER (regles-proto.md) : reprise mutuelle au même tour. Lecture littérale de l'étape 5
  // (« gain = toutes les cases de la zone fermée ») : la case que son propriétaire referme lui-même au
  // même tour est dans les deux gains, donc il la garde (étape 6). Réglage provisoire.
  { id: 'reprise_meme_tour', groupe: 'choix', libelle: 'Reprise disputée au même tour', type: 'choix', defaut: 'defense',
    valeurs: [['defense', 'Le propriétaire qui referme aussi la garde'], ['attaque', 'L’attaquant la prend']],
    description: 'Provisoire (QUESTIONS.md). Avec la reprise : A ferme une zone qui couvre une case de B, et B ferme au même tour une zone qui couvre aussi cette case. « Garde » : la case est dans les deux gains (étape 5 : toutes les cases de la zone), elle reste à B (étape 6). « Prend » : le gain de B ne contient pas ses propres cases, A la prend.' },
  { id: 'seuil', groupe: 'variante', libelle: 'Seuil de victoire (%)', type: 'nombre', defaut: 75, min: 1, max: 100,
    description: 'Posséder ce pourcentage du territoire, arrondi au supérieur. En cases (défaut, décision de Lomig 03/11) : 75 % = 48/64 en 9×9, 37/49 en 8×8, 27/36 en 7×7. En croisements : 61/81, 48/64, 37/49 (Q7 a).' },

  // --- Choix proto réglables (§3, 2e tableau) ---
  { id: 'pose_coupante', groupe: 'choix', libelle: 'Pose qui coupe un trajet', type: 'choix', defaut: 'annulee',
    valeurs: [['annulee', 'Annulée'], ['maintenue', 'Maintenue']],
    description: 'Une pose sur un croisement du trajet adverse le coupe ; la pose elle-même est annulée ou a lieu. Q16 est suspendue.' },
  { id: 'trace_adverse', groupe: 'choix', libelle: 'Passage sur une trace adverse', type: 'choix', defaut: 'recolore',
    valeurs: [['recolore', 'La recolore'], ['garde', 'Elle garde sa couleur']],
    description: 'Passer sur un segment adverse le recolore à votre couleur, ou bien il garde la sienne.' },
  // décision Lomig (relayée par le CDP, 03/11) : le territoire se compte en CASES par défaut.
  { id: 'comptage', groupe: 'choix', libelle: 'Comptage du territoire', type: 'choix', defaut: 'cases',
    valeurs: [['cases', 'Cases possédées'], ['frontiere', 'Croisements, frontière comprise'], ['interieur', 'Croisements, intérieur seul']],
    description: 'Décision de Lomig (03/11) : on compte les cases possédées (défaut), et le seuil se calcule sur les (N−1)² cases. Ancien comptage en croisements, gardé pour tester : « Frontière » : un croisement est à vous si une case voisine est à vous et aucune à l’adversaire. « Intérieur » : toutes ses cases voisines sont à vous. Q13 est suspendue.' },
  { id: 'repasser_croisement', groupe: 'choix', libelle: 'Repasser par un croisement', type: 'choix', defaut: 'oui',
    valeurs: [['oui', 'Permis'], ['non', 'Interdit']],
    description: 'Un trajet peut repasser par un croisement déjà traversé, départ compris (jamais deux fois par le même segment).' },

  // --- Choix proto à valeur unique (affichés, non modifiables : l'alternative n'est pas décrite) ---
  { id: 'plateau_depart', groupe: 'choix', libelle: 'Plateau au départ', type: 'choix', defaut: 'vide', fixe: true,
    valeurs: [['vide', 'Vide']], description: 'Le plateau est vide au départ ; les pions entrent par des poses.' },
  // choix proto (CDP 03/11) : à la fin du chrono sans ordre, « Passer » est choisi (v0.2 : « Rien », même effet).
  { id: 'ordre_expire', groupe: 'cdp', libelle: 'Chrono expiré', type: 'choix', defaut: 'passer', fixe: true,
    valeurs: [['passer', 'Ordre « Passer »']], description: 'Sans ordre à la fin du chrono, l’ordre « Passer » est choisi. On peut aussi passer à la main (bouton). Passer ne fait rien et ne coupe rien.' },
  { id: 'poses_meme_croisement', groupe: 'choix', libelle: 'Deux poses au même endroit', type: 'choix', defaut: 'annulees', fixe: true,
    valeurs: [['annulees', 'Les deux annulées']], description: 'Deux poses sur le même croisement sont annulées.' },
  { id: 'dehors_egalite', groupe: 'choix', libelle: 'Plus grandes régions à égalité', type: 'choix', defaut: 'toutes_dehors', fixe: true,
    valeurs: [['toutes_dehors', 'Toutes sont le dehors']], description: 'Si plusieurs régions ont le plus grand nombre de cases, toutes sont le dehors.' },
  { id: 'territoire_acquis', groupe: 'choix', libelle: 'Territoire', type: 'choix', defaut: 'acquis', fixe: true,
    valeurs: [['acquis', 'Acquis']], description: 'Une case possédée garde son propriétaire, même si ses murs disparaissent. Avec la reprise (défaut), seule une zone adverse fermée qui la couvre peut la lui prendre ; sans reprise, elle ne change plus jamais de main.' },
  { id: 'pions_comptent', groupe: 'choix', libelle: 'Les pions comptent', type: 'choix', defaut: 'non', fixe: true,
    valeurs: [['non', 'Non']], description: 'Seul le territoire compte, pas les pions.' },
  { id: 'seuil_egalite', groupe: 'choix', libelle: 'Seuil atteint par les deux', type: 'choix', defaut: 'plus_grand_sinon_continuer', fixe: true,
    valeurs: [['plus_grand_sinon_continuer', 'Le plus grand ; égalité : on continue']], description: 'Si les deux atteignent le seuil, le plus grand total gagne ; à égalité, la partie continue.' },
  { id: 'departage', groupe: 'choix', libelle: 'Départage final', type: 'choix', defaut: 'cases_puis_nul', fixe: true,
    valeurs: [['cases_puis_nul', 'Cases possédées, puis nul']], description: 'Après le dernier tour à égalité : on compare les cases possédées, puis nul (Q18 suspendue).' },
  { id: 'fermetures', groupe: 'choix', libelle: 'Fermetures simultanées', type: 'choix', defaut: 'paralleles', fixe: true,
    valeurs: [['paralleles', 'En parallèle']], description: 'Les deux joueurs ferment sur le même état ; une case gagnée par les deux garde son propriétaire d’avant ; les captures s’appliquent ensemble.' },

  // --- Décisions de Lomig et du CDP du 03/11 (affichées) ---
  // décision Lomig 03/11 : traverser le départ libéré est permis par défaut (comme regles-proto v0.2) ;
  // l'ancien choix CDP « arrivée seulement » reste disponible pour le tester.
  { id: 'depart_libere', groupe: 'cdp', libelle: 'Départ libéré d’un pion adverse', type: 'choix', defaut: 'traversee',
    valeurs: [['traversee', 'On peut s’y arrêter ou le traverser'], ['arrivee_seule', 'On peut seulement s’y arrêter']],
    description: 'Décision de Lomig (03/11). Un pion peut entrer sur le croisement qu’un pion adverse quitte pendant le même tour : s’y arrêter, ou aussi le traverser (défaut, comme regles-proto v0.2). Avec « seulement s’y arrêter », y passer est une rencontre qui coupe les deux trajets. Si le pion adverse ne part pas (il ne bouge pas ou son ordre est annulé), l’ordre qui visait ou traversait son croisement est annulé, en chaîne. On ne peut pas POSER sur ce départ : une pose sur un croisement occupé est interdite (décision de Lomig 03/11, Q10).' },
  { id: 'annulations_chaine', groupe: 'cdp', libelle: 'Annulations en chaîne', type: 'choix', defaut: 'oui', fixe: true,
    valeurs: [['oui', 'Oui, jusqu’à stabilité']], description: 'Une annulation peut en entraîner une autre (ex. : le pion qui devait partir reste, l’arrivée adverse sur son croisement est annulée). On recommence jusqu’à ce que plus rien ne change.' },
];

/** Valeurs par défaut de tous les réglages. */
export function parametresParDefaut() {
  return Object.fromEntries(REGLAGES.map((r) => [r.id, r.defaut]));
}

/** Le score compte-t-il des cases (défaut, décision Lomig 03/11) ou des croisements ? */
export const compteEnCases = (p) => (p.comptage ?? 'cases') === 'cases';
/** Unité du score, pour les libellés : « cases » ou « croisements ». */
export const uniteScore = (p) => (compteEnCases(p) ? 'cases' : 'croisements');
/** Total possible : (N−1)² cases, ou N² croisements. */
export const totalScore = (p) => (compteEnCases(p) ? (p.grille - 1) ** 2 : p.grille ** 2);
/**
 * Seuil : S = ⌈seuil × total / 100⌉ (regles-proto.md §3), calcul entier puis arrondi au supérieur.
 * Cases (défaut) : 48/64 (9×9), 37/49 (8×8), 27/36 (7×7). Croisements : 61/81, 48/64, 37/49.
 */
export const seuilScore = (p) => Math.ceil((p.seuil * totalScore(p)) / 100);
/** Ancien nom, gardé : c'est le seuil dans l'unité du réglage `comptage` (cases par défaut). */
export const seuilCroisements = seuilScore;

/** Longueur max d'un trajet en segments (Infinity si illimitée). */
export const longueurMax = (p) => (p.trajet_max === 'illimite' ? Infinity : Number(p.trajet_max));

/** Complète et vérifie un objet de paramètres partiel. Retourne un objet gelé. */
export function normaliserParametres(partiel = {}) {
  const p = { ...parametresParDefaut(), ...partiel };
  for (const r of REGLAGES) {
    const v = p[r.id];
    if (r.type === 'choix' && !r.valeurs.some(([x]) => x === v)) {
      throw new Error(`Réglage « ${r.id} » : valeur inconnue ${JSON.stringify(v)}`);
    }
    if (r.type === 'nombre' && !(Number.isInteger(v) && v >= r.min && v <= r.max)) {
      throw new Error(`Réglage « ${r.id} » : nombre attendu entre ${r.min} et ${r.max}`);
    }
  }
  return Object.freeze(p);
}
