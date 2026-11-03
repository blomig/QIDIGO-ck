# QIDIGO : prototype web jouable

Prototype pour tester les règles de **regles-proto.md (v0.2)**, avec les décisions de Lomig et du CDP (03/11).
Il s'agit de HTML, CSS et JS « vanilla » en modules ES : pas de dépendance ni d'étape de build.
Les chemins sont tous relatifs, ce qui permet de le servir sous `/QIDIGO-ck/proto/` sur GitHub Pages.
Il est pensé pour Safari iPhone en portrait.

## Lancer

```sh
cd proto
python3 -m http.server 8000      # puis http://localhost:8000/ (ou l'IP locale depuis l'iPhone)
node --test                      # tests du moteur (Node ≥ 20 ; ne pas passer « tests/ » en argument)
```

## Jouer

- **Poser** : touchez un croisement **libre**. On ne pose jamais sur un croisement occupé, ni par un de ses pions ni par un pion adverse, même si ce pion part pendant le tour (décision de Lomig, 03/11, Q10). Un tap sur un pion ne pose rien.
- **Départ libéré** (décision de Lomig, 03/11) : un pion peut s'arrêter sur le croisement que quitte un pion adverse, ou le traverser.
  Si ce pion ne part pas, l'ordre est annulé, en chaîne. Le réglage `depart_libere` permet de tester « seulement s'y arrêter ».
  Seuls les déplacements peuvent viser ce départ : la pose y est interdite (croisement occupé).
- **Déplacer** : glissez depuis un de vos pions le long des traits. Revenir en arrière efface le dernier segment.
  Un déplacement fait **au plus 5 pas** (5 segments, décision de Lomig du 03/11, réglage `trajet_max` : illimité, 3, 4, 5 ou 7).
  Près du doigt, un compteur affiche « 3/5 ». À la limite, il passe en accent (« 5/5 MAX ») et le tracé ne s'allonge plus.
  On peut toujours reculer pour le raccourcir. Si le réglage vaut illimité, le compteur affiche seulement le nombre de pas.
  Le trait se colle aux croisements (avec une loupe sous le doigt).
- **Prêt** valide l'ordre. **Effacer** l'efface. Sans ordre, ce bouton devient **Passer**.
  Si le chrono expire, l'ordre en cours est envoyé s'il est valide, sinon « Passer ».
- **Soutien** (variante) : pendant un déplacement, touchez un de vos pions voisin du départ.
- **Reprise** (décision de Lomig, 03/11 : `reprise = oui` par défaut) : fermer une zone prend toutes ses cases, y compris celles de l'adversaire.
  On reprend donc un territoire par morceaux. Les cases reprises clignotent dans la couleur du nouveau propriétaire, puis gardent un liseré accent.
  Avec prefers-reduced-motion, elles sont seulement teintées. Le journal l'indique (« Joueur A reprend 2 cases à Joueur B. »).
  Le réglage permet de revenir à `non`. Une reprise disputée au même tour est réglée par `reprise_meme_tour` (provisoire, voir QUESTIONS.md).
- **Qu'est-ce qu'une zone** (`zone_regle`, Q7 en attente de Lomig) : par défaut, `actuel` (le dehors est la plus grande région).
  Trois options sont à essayer dans les Réglages : `sans_pion_adverse`, `dehors_non_possede` et `moitie_libre` (voir QUESTIONS.md).
- **Score en cases** (décision de Lomig, 03/11 : `comptage = cases` par défaut) : on compte les **cases possédées**.
  Le seuil de victoire est 75 % des (N−1)² cases, arrondi au supérieur : **48/64** en 9×9, **37/49** en 8×8 (36,75 → 37), **27/36** en 7×7.
  Les compteurs (« 25/48 cases »), le repère de seuil, le journal (« Cases possédées : A 25, B 0. ») et l'écran de fin (« seuil : 48 sur 64 ») parlent en cases.
  L'ancien comptage en croisements reste dans les Réglages pour tester : `frontiere` (61/81, 48/64, 37/49) ou `interieur`.
- **Capture** (`capture`, défaut `aucune`, Q4) : `retour` (le pion pris revient dans la réserve de son camp), `sans_retour`, ou `definitive`.
  `definitive` est un alias de `sans_retour` : le pion pris quitte la partie pour de bon (pastille barrée dans la réserve).
  Un joueur qui n'a plus aucun pion continue et ne peut que passer ; il garde son territoire (choix proto, à confirmer par Lomig).
- Pendant votre saisie, **l'aperçu** montre en pointillé la zone fermée et le gain prévu, en supposant que l'autre passe.
- **Modes** : contre l'IA (vous êtes A, noir) ou à deux sur le même téléphone. Dans ce mode, un écran de passage masque l'ordre de l'autre.
- **Niveau de l'IA** (Réglages, appliqué avec Rejouer) : **Fort** par défaut (`ai/ia-forte.js`), ou **Facile** (`ai/ia-faible.js`, au hasard).
  L'IA forte calcule dans un Web Worker (`ai/worker-ia.js`) pendant que vous planifiez, en moins de 0,9 s par coup.
  Si le navigateur refuse le worker, le calcul se fait directement dans la page.
- **Réglages** : chaque variante et chaque choix proto, avec sa description, son état et sa valeur par défaut.
  Les réglages s'appliquent à la partie suivante (**Rejouer**) et sont gardés dans `localStorage`.
- **Journal** : tous les tours, avec chaque annulation et sa cause.

## Structure

```
index.html, style.css        page et mise en page (style.css s'appuie sur les jetons --q-*)
design/                      fourni par le designer, NON modifié (tokens.css, composants.css, plateau.js…)
engine/                      moteur PUR (aucun accès au DOM, aucune dépendance à design/)
  params.js                  réglages : descripteurs (libellé, description, défaut) et normalisation
  grille.js                  croisements, segments, cases
  etat.js                    état immuable
  ordres.js                  ordres poser / deplacer / passer / rien et validation
  resolution.js              résolution d'un tour (étapes 1 à 9 de regles-proto.md) et journal
  rng.js                     hasard à graine (mulberry32)
ai/ia-faible.js              IA « Facile » : au hasard, toujours légale
ai/ia-forte.js               IA « Fort » : ordres légaux, matrice de gains contre les réponses probables (vrai moteur), choix robuste
ai/poids-tunes.json          poids lus par ia-forte (aujourd'hui POIDS_BASE : le tuning du 03/11 n'est pas significatif, voir poids-tunes.rejet.json)
ai/worker-ia.js, ai/ia.js    Web Worker et pont page ↔ worker (repli en calcul direct)
tools/arena.js               banc d'essai node : matchs, banc, tuning, vitesse d'expansion
ui/app.js                    boucle de jeu, chrono, modes, compteurs
ui/plateau.js                saisie tactile et options pour design/plateau.js (plateauSVG)
ui/reglages.js               panneau Réglages
ui/journal.js                journal
tests/                       node --test (exemples de regles-proto.md, décisions du CDP, Passer, décompte…)
QUESTIONS.md                 points encore ouverts
```

## Où brancher

- **Règles** : `engine/params.js` (réglages, avec leurs défauts et descriptions) et `engine/resolution.js`.
  Le code de chaque étape cite son numéro dans regles-proto.md. Les choix du CDP sont marqués
  `// choix proto (CDP 03/11)`, les décisions de Lomig `// décision Lomig 03/11` et les points ouverts `// A CONFIRMER (regles-proto.md)`.
- **Design** : `design/tokens.css` (piste A « Goban », seul thème retenu par Lomig),
  `design/composants.css` et `design/plateau.js`, utilisés tels quels.
  `ui/plateau.js` traduit l'état du moteur en options pour `plateauSVG`.

## IA forte, banc et tuning

`ai/ia-forte.js` :
1. génère tous les ordres légaux (poses, trajets jusqu'à `trajet_max`, Passer) ;
2. les trie par un pré-score rapide ;
3. joue les meilleurs contre un échantillon de réponses adverses probables, avec le vrai moteur (`resoudreTour`) ;
4. retient le coup robuste (mélange maximin et moyenne pondérée) et ajoute une recherche d'un tour de plus sur les meilleurs coups ;
5. tire au hasard (à graine) parmi les coups proches.

Les poids d'évaluation sont nommés dans `POIDS_BASE` : croisements (le score, quel que soit le comptage), echelle_cases, cases, potentiel, exposition, coupure, réserve, seuil, tours_restants, capture et capture_definitive.
L'IA suit `comptage` : en cases, le terme de score est multiplié par `echelle_cases` (2, une case vaut à peu près deux croisements) et le seuil est lu dans la bonne unité.
Les captures valent `capture` (4, mode `retour`) ou `capture_definitive` (8, modes `definitive` et `sans_retour`) par pion pris ou perdu.
Le budget compte les résolutions, donc un coup est reproductible. `msMax` plafonne le temps dans le navigateur.

```sh
cd proto
node tools/arena.js match --a forte --b faible --parties 100 --reglages grille=8,reprise=non
node tools/arena.js banc --paires forte:faible,tunee:forte --parties 100      # tous les réglages du banc
node tools/arena.js tuning --generations 8 --population 6 --parties 20 --validation 400 --graine 7
node tools/arena.js expansion --parties 60                                   # vitesse d'expansion selon trajet_max
```

- Les configurations sont `faible`, `forte` (POIDS_BASE), `tunee` (ai/poids-tunes.json) et `fichier:chemin.json`.
- Les couleurs alternent d'une partie à l'autre. Les parties tournent en parallèle (`--workers`) et tout est à graine (`--graine`). `--json fichier` garde le détail.
- Le rapport donne :
  - le taux de victoire avec son IC 95 % de Wilson, nuls exclus puis nuls comptés ½ ;
  - la durée des parties ;
  - les victoires au seuil ou au tour 20, et les nuls ;
  - le temps par coup (moyenne et p95), la part de Passer et la longueur des trajets.
- `tuning` est une ES (1+λ) qui tire les mêmes graines pour toute une génération. Son pool réunit faible, la base et les meilleures versions précédentes.
  Les parties de validation (tunée contre base, graines séparées) écrivent `ai/poids-tunes.json` seulement si la borne basse de l'IC dépasse 50 %.
  Sinon, elles écrivent `ai/poids-tunes.rejet.json`. `--forcer` passe outre.

### Forte v2 : passe « IA robuste » (03/11)

- `ai/ia-forte-v1.js` est une copie figée de la forte d'avant la passe. Elle sert de référence (config `v1` d'arena) et ne doit pas être modifiée.
- Diagnostic chiffré de la passivité : `banc/ia-passivite-diagnostic.md`. Points d'étape et résultats : `banc/ia-active-etat.md`.
- Ce qui a changé dans `ai/ia-forte.js` :
  - **Pré-tri des poses.** Une pose est notée selon les cases presque fermées autour du croisement (1 pour 3 murs, 0,4 pour 2, 0,1 pour 1). Avant, toutes les poses valaient 0 et les poses gardées étaient tirées au hasard. 10 poses sont gardées (6 avant).
  - **Marge de déploiement** (`deploiement` = 2). Parmi les lignes à 2 points ou moins de la meilleure, l'IA joue la meilleure pose, tant qu'il lui reste au moins 2 pions en réserve. Un pion reste toujours disponible pour couper.
  - **Termes présents mais à 0 par défaut, car ils perdaient ou cassaient des pièges :**
    - `presence`, `mobilite`, `menaces`, `reserve_garde` ;
    - `equilibre` (stratégie mixte par regret matching sur la matrice) ;
    - `repetition` (pénalité d'un ordre qui vient d'échouer) ;
    - options `mReponses` et `partMatrice`.
- Arena :
  - `node tools/arena.js match --a forte --b v1` ;
  - `tuning --defauts --depart fichier.json` joue contre un pool faible, v1, départ et versions intermédiaires, puis valide contre la v1.
- Banc des variantes : `IA=v2|v1 node banc/banc-v2.mjs <zone_regle> <capture> <n> <graine> <sortie>`, puis `python3 banc/analyse-v2.py banc/ia-v2-tableau.md`.

Résultats du 03/11 : banc/ à la racine du dépôt local (forte-faible.txt, tuning.txt, expansion.txt, forte-forte.txt ; en croisements).
Depuis le comptage en cases : cases-forte-faible.json (forte bat faible 200 à 0) et def-*.json / def-tableau.md (banc de la capture définitive).

## Ordres par pion (piste à l'essai, 03/11)

Réglages `ordres` (`joueur`, le défaut, ou `pion`) et `poses_par_tour` (`1`, le défaut, ou `illimite`). Ce sont deux
cartes du panneau Réglages ; les défauts ne changent pas.

En mode pion, chaque pion en jeu reçoit un trajet, ou passe s'il n'en reçoit pas. On peut en plus poser depuis la
réserve : une pose au plus par tour, ou sans limite selon `poses_par_tour`.

- **Moteur.** L'ordre d'un joueur est un lot `{ type: 'lot', ordres }`, construit avec `lot(...)` dans
  `engine/ordres.js` et validé par `validerLot`. La résolution reste le pipeline unique de `engine/resolution.js`,
  généralisé à N ordres. Les conflits entre ses propres ordres sont refusés à la saisie ; ce sont des choix du CDP,
  listés dans QUESTIONS.md, section « Ordres par pion ». Le mode joueur est strictement identique : 300 parties de
  référence donnent la même empreinte (`banc/ordres-pion/reference-joueur.mjs`). Tests : `tests/ordres-pion.test.js`.
- **IA.** La faible tire un lot légal au hasard. La forte (`choisirLot` dans `ai/ia-forte.js`) procède ainsi :
  1. elle garde les 4 meilleurs ordres de chaque pion et les meilleures poses, chacun évalué avec le vrai moteur ;
  2. elle tire un échantillon de lots adverses : glouton, variantes et coupures ;
  3. elle coordonne son lot par montée par coordonnées, en notant chaque lot avec le vrai moteur.

  Elle prend environ 50 ms par coup, en node comme dans le navigateur, avec un plafond de 250 ms.
- **Interface.**
  - Glisser depuis chaque pion donne son trajet ; toucher un croisement pose.
  - Toucher un pion qui a un ordre, ou une pose prévue, l'annule. « Tout effacer » vide le lot.
  - Chaque ordre porte un numéro près de son pion.
  - Le compteur « ordres n/m » s'affiche dans la ligne d'état.
- **Banc et résultats.** Voir `banc/ordres-pion-tableau.md` et `banc/ordres-pion-etat.md`.
