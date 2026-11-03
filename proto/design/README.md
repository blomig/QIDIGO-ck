# QIDIGO · direction visuelle du prototype (planche v0, 03/11/2026)

> **Pistes de travail à affiner, pas des décisions.** Deux ambiances : **A « Goban »** (recommandée, entièrement détaillée) et **B « Qix nuit »** (un écran-type et une palette). Règles : `../regles-proto.md` (Dev) et C-K tour 2 (https://blomig.github.io/QIDIGO-ck/).

## Fichiers

| Fichier | Rôle |
|---|---|
| `tokens.css` | Variables CSS `--q-*` : couleurs (A sur `:root`, B sur `[data-theme="nuit"]`), tailles, épaisseurs, rayons, typo, durées, courbes. **Généré**, ne pas éditer à la main. |
| `tokens.json` | Les mêmes valeurs, plus la formule de grille et le tableau des contrastes WCAG. |
| `composants.css` | Classes `q-*` : écran, plateau SVG, pions, traits, coupure, zones, chrono, compteur, bouton Prêt, mouvement réduit. |
| `plateau.js` | Module ES : `plateauSVG(options)` renvoie le SVG d'un plateau (rendu de référence, à reprendre ou réécrire). |
| `svg/` | 17 SVG autonomes (styles embarqués) : pions (noir, blanc, sélectionné, menacé, arrivée prévue), zone tactile, trajet en cours, validé, révélé, trace, mur, annulation, zone Noir, zone Blanc, chrono, plateaux 9×9 A et B. |
| `planche.html` | Page autonome (aucune ressource externe) : écrans A et B en 390 × 844, palettes, contrastes, composants et leurs états, animations en direct. |
| `planche.png` / `planche.jpg` | Capture de la planche (Chrome headless, 1440 px de large) ; jpg < 2 Mo. |
| `apercu-daltonisme.jpg` | Les deux écrans en vision normale, deutéranopie, protanopie, tritanopie (Machado 2009). |
| `_src/` | `tokens.py` (source unique des tokens), `build.py`, `svg.mjs`, `capture.sh`, `contrastes.py`, `daltonisme.py`, `planche.src.html`. |

Régénérer : `python3 _src/build.py && node _src/svg.mjs && sh _src/capture.sh && python3 _src/daltonisme.py`.

## Mode d'emploi pour Dev

1. Charger `tokens.css` puis `composants.css`. Piste B : `data-theme="nuit"` sur `<html>` ou sur `.q-screen`. Les motifs et dégradés SVG prennent la couleur du thème de leur ancêtre : un plateau = un `<svg>` avec ses propres `<defs>` (identifiants uniques, déjà gérés par `plateauSVG`).
2. Plateau :
   ```js
   import { plateauSVG } from './design/plateau.js';
   const N = 9, L = innerWidth;                                  // 375, 390, 393, 430…
   const pitch = Math.min(56, Math.floor((L - 32) / (N - 1)));   // 42, 44, 45, 49
   const margin = (L - (N - 1) * pitch) / 2;
   board.innerHTML = plateauSVG({ n: N, pitch, margin, hoshi, zones, traces, pions, encours, valide, coupure, doigt, loupe });
   ```
   Données : `pions [{x,y,c:'n'|'b', sel, ghost, capt}]`, `traces [{c, pts:[[x,y]…], mur}]`, `zones [{c:'n'|'b'|'x', cells:[[i,j]…], apercu, anim}]`, `encours {pts}`, `valide {pts}`, `reveles [{c, pts}]`, `coupure {at:[x,y], trajets:[{c,pts}]}`, `hits [{x,y,on}]`, `controles [{x,y,c}]`. Coordonnées identiques à `regles-proto.md` (x vers la droite, y vers le bas, case (i, j) de coins (i, j) et (i+1, j+1)).
3. Saisie (zone tactile) : convertir le point touché en croisement par `Math.round((px - margin) / pitch)`, borné à [0, N−1]. On obtient des cellules carrées pitch × pitch sans trou, et celles du bord vont jusqu'au bord d'écran. Pendant le glissé : projection sur l'axe dominant, passage au croisement suivant au-delà de 60 % de l'écart (C47, C48), loupe décalée de 86 pt au-dessus du doigt (C49), retour arrière qui efface, lever du doigt qui valide (C52).
4. États et classes :
   - trajet : `.q-encours` (pointillé indigo qui défile), puis `.q-valide` (plein) au lever, `.q-revele` (se dessine, 450 ms) à la résolution, puis trace `.q-trace` ; `.q-mur` quand la trace borde une zone gagnée ;
   - coupure : ajouter `coupure` au rendu ; la classe `.q-coupe` joue 400 ms une fois (flash 0–80, secousse 80–240, dissolution 240–400) puis on retire le trajet : **aucune trace ne reste** (règles proto) ;
   - zone : `anim:true` → fondu 350 ms ; `apercu:true` → aperçu de fermeture de mon ordre (calculé côté client avec le moteur) ;
   - pion : `sel`, `ghost` (arrivée prévue), `capt` (sera capturé si l'ordre passe) ; `.q-pion--capture` = sortie 300 ms ;
   - chrono : `.q-chrono.is-running` (anneau 20 s en CSS) ; ajouter `.is-urgent` à ≤ 5 s ; le chiffre est mis à jour en JS ;
   - compteur : `.q-counter--n|b` avec `style="--v:16;--g:9"` (g = gain prévu) ; `--q-total` et `--q-seuil` à régler pour 8×8 (64 / 48) et 7×7 (49 / 37) ;
   - bouton : `.q-btn-pret[data-etat=inactif|actif|envoye|urgent]`.
5. Mise en page 390 × 844 (voir `planche.html`, classes `.top`, `.hud`, `.board-wrap`, `.ordre`, `.pret`) : barre haute à 50 pt, compteurs et chrono à 100 pt, plateau carré de 196 à 586 pt, carte « Ton ordre » à 598 pt, bouton Prêt de 56 pt dont le bas est à 46 pt du bas d'écran (34 pt de zone sûre + 12 pt). Sur d'autres hauteurs, garder le plateau centré et le bouton collé en bas.
6. Safari : pas de filtre CSS sur les pions (ombre = disque décalé). Le léger halo des traits en B (`--q-line-glow`) peut être ignoré par Safari, sans conséquence pour la lisibilité. `touch-action:none` sur `.q-screen` pour éviter le zoom et le défilement pendant le tracé.

## Lisibilité

**Contrastes WCAG 2.1** (calculés par `_src/contrastes.py`, détail dans `tokens.json`). Texte ≥ 4,5:1, éléments graphiques ≥ 3:1 (1.4.11).

| Paire | A Goban | B Qix nuit |
|---|---|---|
| texte / fond | 14,3 | 16,6 |
| texte secondaire / fond | 6,6 | 7,3 |
| texte du bouton Prêt / bouton | 9,6 | 10,6 |
| grille / plateau | 3,0 | 3,1 |
| pion noir / plateau | 10,7 | 1,1 (lu par son anneau ambre : 10,5) |
| pion blanc : contour / plateau | 10,4 (gaine d'encre) | 10,9 (anneau cyan) |
| trait Blanc / plateau | 10,4 (gaine) | 10,9 |
| trajet en cours (accent) / plateau | 5,9 | 10,5 |
| coupure (alerte) / plateau | 4,0 | 6,2 |

**Daltonisme** (voir `apercu-daltonisme.jpg`). En A, aucune information ne passe par la teinte seule. Noir et Blanc s'opposent par la luminance, et chaque zone a son motif : hachures à 45° pour Noir, points pour Blanc. Les traces sont des lignes, les zones des surfaces à motif. Mon ordre se distingue par le pointillé animé, la coupure par la croix et la secousse. Les trois simulations gardent tout lisible. En B, l'ambre et le cyan restent distincts dans les trois simulations, mais le cyan pâlit vers le blanc en protanopie. Les motifs sont donc indispensables en B aussi.

**Cibles tactiles.** Sur 9 croisements, il y a 8 intervalles et 2 marges. Une cible carrée égale au pitch demande 8 × 44 + 2 × 22 = 396 pt, ce qui ne tient pas dans 375 pt. On prend donc pitch = min(56, ⌊(L − 32) / (N − 1)⌋), avec une marge d'au moins 16 pt pour rester hors du geste retour de Safari au bord gauche :

| Largeur | N | Pitch | Marge | ≈ mm (0,166 mm/pt, K195) |
|---|---|---|---|---|
| 375 | 9 | 42 | 19,5 | 7,0 |
| 390 | 9 | **44** | 19 | 7,3 |
| 393 | 9 | 45 | 16,5 | 7,5 |
| 430 | 9 | 49 | 19 | 8,1 |
| 375 | 8 / 7 | 49 / 56 | 16,5 / 19,5 | 8,1 / 9,3 |

Sous 390 pt, la cible fait 42 pt, soit 4,5 % sous les 44 pt d'Apple. On compense :
- la cible est un carré sans trou, et non un disque ;
- le glissé est aimanté : on choisit une direction, pas un point ;
- la loupe montre ce qui est caché sous le doigt ;
- la pose se valide au lever du doigt, ce qui permet de corriger en glissant.

Le bouton Prêt et les boutons secondaires font au moins 44 pt (56 pt pour Prêt). Prêt occupe toute la largeur sous le pouce, et le plateau reste à portée d'une main.

**Mouvement réduit** (`prefers-reduced-motion`) : pas de secousse, de pulsation ni de pointillé animé, et des fondus de 200 ms.

## Points ouverts (règles qui changent le visuel)

1. **Couleur d'une trace adverse recolorée** (`trace_adverse`) : une trace qui change de camp doit-elle signaler le changement (bref flash) ?
2. **Traces décoratives ou murs** (`traces`, Q11). Si toutes les traces sont des murs, faut-il garder la distinction trace 3 pt / mur 4 pt ?
3. **Comptage de la frontière** (Q13, `comptage`). Faut-il afficher les croisements contrôlés (petits carrés, prévus en option) pour que les 61 se lisent ? Une frontière commune n'est à personne : elle n'a pas de marqueur.
4. **Pose coupante** (Q16, `pose_coupante` = `annulee`). L'animation de coupure s'applique alors à la pose comme au trajet. Il faudra un visuel de « pose annulée » : un pion fantôme qui se dissout.
5. **Soutien façon Diplomacy** (variante `soutien`) : il faudra un lien visuel entre le pion qui soutient et le trajet soutenu, non dessiné ici.
6. **Ordre « rien »** si rien n'est donné. Le bouton Prêt inactif dit « sans ordre = ne rien faire » : faut-il permettre de passer volontairement ?
7. **Information cachée** : seul mon ordre se voit avant la révélation. Pour un test à deux sur un même iPhone, il faudra un écran de passage de main.
8. **Aperçu de fermeture et de capture** : la planche suppose que le client calcule l'aperçu (+9, pion menacé). C'est à confirmer avec Dev (moteur côté client).
9. **Variantes 7×7 et 8×8** : le C-K avait écarté 7×7 (C53), mais Lomig demande de ne pas exclure 8 ni 7 (regles-proto, K158). La formule de pitch les couvre, avec les seuils 48 et 37.
10. **Durée de résolution** : la séquence complète dure environ 1,2 à 2 s, compatible avec la piste de 2 à 3 s du C-K.
