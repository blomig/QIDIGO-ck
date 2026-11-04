# QIDIGO prototype : questions

Points que ni regles-proto.md v0.2 ni les décisions de Lomig et du CDP (03/11) ne tranchent.
Le code les marque `// A CONFIRMER (regles-proto.md)`.

## Tranchées (03/11)

1. **Départ libéré : traverser ou seulement s'arrêter.** Lomig a tranché (décision relayée par le
   CDP) : par défaut, on peut s'arrêter sur le croisement que quitte un pion adverse, ou le traverser,
   comme dans la v0.2. Si ce pion ne part pas, l'ordre qui visait ou traversait son croisement est
   annulé, en chaîne. Réglage `depart_libere` = `traversee` (défaut) | `arrivee_seule`.
5. **IA** : niveau Fort (défaut, ai/ia-forte.js) et Facile (ai/ia-faible.js : ordres légaux au hasard,
   Passer environ une fois sur 20, pas de soutien).
10. **Pose sur un croisement occupé (veto gratuit)** : Lomig a tranché (décision relayée par le CDP).
    On ne peut pas poser sur un croisement occupé par un pion, à soi ou à l'adversaire. La pose sur
    le départ d'un pion adverse est donc interdite : l'ordre est illégal, refusé à la validation et
    remplacé par « rien » s'il arrive quand même au moteur.
    - Cela remplace l'ordre conditionnel de regles-proto.md v0.2 (étape 2) et le choix du CDP « une pose
      sur le départ coupe les deux ordres ».
    - Motif : au banc, l'IA forte posait chaque tour sur le départ du seul pion adverse en jeu. La pose
      était annulée sans coûter de pion, et 10 parties sur 12 finissaient 0–0.
    - Interprétation retenue (la plus littérale), à confirmer : l'occupation se lit au début du tour,
      quand on donne les ordres. Un croisement que son pion quitte pendant le tour reste interdit à la
      pose. Seul un déplacement peut y arriver (départ libéré). Un croisement libre au début du tour
      reste posable, même si un pion adverse y arrive pendant le tour ; c'est alors une coupure (étape 3b).

14. **Comptage du territoire en CASES** : Lomig a tranché (décision relayée par le CDP, 03/11). C'est
    le nouveau défaut (`comptage = cases`), le seul défaut changé ce jour-là.
    - Seuil : ⌈75 × (N−1)² / 100⌉ cases, calcul entier puis arrondi au supérieur : 48/64 (9×9),
      37/49 (8×8, 36,75 → 37), 27/36 (7×7). `engine/params.js` (`seuilScore`, `totalScore`).
    - L'ancien comptage reste en réglage : `frontiere` (croisements, frontière comprise ; 61/81,
      48/64, 37/49) et `interieur`. Les tests de la logique des croisements y sont épinglés.
    - Conséquence à confirmer : au dernier tour, l'égalité se départageait « aux cases ». En cases,
      ce départage est identique au score, donc une égalité de cases donne un nul (pas de
      départage aux croisements : ce serait une règle inventée).

## Réglage provisoire validé par le CDP

2. **Segment de sa couleur reparcouru** (étape 5, nouveaux(P)) : il compte comme « nouveau »
   pour fermer une zone (engine/resolution.js, `fermeturesDe`). Validé par le CDP en attendant Lomig.
3. **Les deux au seuil à égalité de croisements, au dernier tour** : on applique la règle du
   dernier tour, avec départage aux cases puis nul (engine/resolution.js, `verifierFin`). Validé par
   le CDP en attendant Lomig.

## Reprise de territoire (décision de Lomig, 03/11 : `reprise = oui` par défaut)

Ce que regles-proto.md v0.2 (§3 et étapes 5 à 8) tranche déjà, et que le code applique tel quel :
- **Reprise partielle** : seules les cases couvertes par la zone fermée changent de main (étape 5).
- **Décompte vers le seuil** : l'étape 8 recompte ctrl(P) pour les deux joueurs à chaque tour. Une
  reprise fait donc baisser le compteur de l'adversaire et monter le sien.
- **Territoire acquis** : une case ne se perd jamais parce que ses murs disparaissent. Avec la reprise,
  seule une zone adverse fermée qui la couvre la fait changer de main. Sans reprise, elle ne change
  plus jamais de main.

Point flou, avec une interprétation provisoire mise en réglage :

6. **Reprise disputée au même tour** (`reprise_meme_tour`, défaut `defense`). A ferme une zone qui
   couvre une case de B, et B ferme au même tour une zone qui couvre aussi cette case.
   L'étape 5 dit « gain = toutes les cases de la zone fermée ». Lue à la lettre, cette phrase met la
   case dans les deux gains, donc elle reste à B (étape 6). C'est l'interprétation choisie.
   L'autre lecture (`attaque`) exclut ses propres cases de son gain, et A prend alors la case.
   Deux reprises sur des cases différentes au même tour ont lieu toutes les deux.

## Ouverte

4. **Choix proto non réglables** : regles-proto.md n'en décrit qu'une seule valeur. Il s'agit de
   plateau_depart, poses_meme_croisement, dehors_egalite, territoire_acquis, pions_comptent,
   seuil_egalite, departage et fermetures. Il faudrait les alternatives pour pouvoir les tester.

7. **Une fermeture peut prendre l'espace libre en faisant de son propre territoire le « dehors »**
   (partie de Lomig, graine 2761909367, tour 11 : A passe de 58 à 81 et gagne 24 cases contenant des
   pions B). Diagnostic : **pas un bug du moteur, un défaut de la règle**.
   - Texte : §1 « Zone » (« La région qui a le plus de cases est le dehors. Toutes les autres régions
     sont des zones de P ») et §2 étape 5 (« dehors = région(s) de taille maximale ; zones = les
     autres ; gain(P) = cases des zones fermées(P) sans propriétaire »). §1 Territoire : « Les pions
     ne comptent pas en eux-mêmes ». Code : `zonesDe` et `fermeturesDe` (engine/resolution.js) font
     exactement cela, sur toutes les cases, y compris celles que P possède déjà.
   - Mécanisme : avant le tour 11, les régions des murs de A font 24 (le reste libre, c'est le
     dehors), 12, 8 et 20 (déjà à A). Le trajet (2,4)→(2,0) coupe les 24 en 8 + 16. La plus grande
     région devient alors le territoire de A (20 cases) : elle passe « dehors », et les deux morceaux
     libres deviennent des zones de A, fermées par les nouveaux segments. Les pions B en (0,2) et
     (2,6) n'y changent rien.
   - Options (simulées sur ce tour, hors moteur) :
     1. **Dehors calculé hors de son territoire** : la plus grande région se cherche seulement parmi
        les cases que P ne possède pas. Tour 11 : +8 cases, A 73 (gagne quand même au seuil, 61).
     2. **Pas de zone sur un pion adverse** : une région qui touche un croisement occupé par un pion
        adverse n'est pas une zone. Tour 11 : +0, A reste à 58, la partie continue.
     3. **Zone plafonnée** : une zone fait au plus la moitié des cases que P ne possède pas encore.
        Tour 11 : +8, A 73.
   - **Réglage `zone_regle` (demande du CDP, 03/11)** : les trois options sont maintenant dans le moteur,
     pour les essayer. Le défaut reste `actuel` (dehors = plus grande région) : rien ne change sans
     action dans les Réglages. Valeurs : `actuel` | `sans_pion_adverse` | `dehors_non_possede` |
     `moitie_libre`.
     - `sans_pion_adverse`, choix à confirmer : « contient » = un pion adverse sur un croisement
       **intérieur** de la région (ses 4 cases dans la région). Un pion sur le bord de la région, sur
       un mur de P ou au bord du plateau, ne l'empêche pas. Au tour 11, cela donne +8 (A 73), pas +0 :
       le pion B en (0,2) est sur le bord du plateau, donc sur le bord du morceau de 8. Avec « touche »
       (la simulation ci-dessus), on aurait +0.
     - `moitie_libre`, choix à confirmer : la taille d'une zone est son nombre total de cases. On la
       compare au nombre de cases du plateau que P ne possède pas. Le dehors (plus grande région) est
       exclu comme dans `actuel`.
     - `dehors_non_possede` : à égalité, toutes les régions en tête sont le dehors (comme `dehors_egalite`).
     - Les pions lus sont ceux d'après les déplacements et les poses du tour (étape 5), avant les captures.
   Lomig tranche.

8. **Valeur par défaut de `reprise`** : le tableau de regles-proto.md §3 indique `non`, la décision
   de Lomig (03/11) donne `oui`. Le proto suit Lomig. La partie de Lomig a été jouée avec `non` (le
   test la rejoue avec `reprise = non`).

9. **Journal de Lomig, tour 10** : le journal ne donne que le départ et l'arrivée. Sept trajets
   différents donnent le même résultat. Le test garde le premier (tests/journaux/lomig-2026-11-03-ordres.json).

## Q4 : capture des pions enfermés (demande du CDP, 03/11 ; défaut inchangé : `capture = aucune`)

- **La valeur `retour` existante fait exactement ce qui est proposé.** Aucune nouvelle valeur.
  regles-proto.md §Capture (l. 84–89) et étape 7 (l. 141–143) : un pion adverse est capturé si toutes
  les cases qui touchent son croisement sont dans une zone que P ferme à ce tour et deviennent ou restent
  à P. Avec `retour`, il revient dans la réserve de son propriétaire et peut être reposé dès le tour
  suivant. Un pion sur la frontière de la zone n'est pas capturé, et on ne capture jamais ses propres
  pions. On capture seulement au tour de la fermeture (l. 195).
- **« Enfermé »** : croisement intérieur (4 cases), mais aussi au bord du plateau (2 cases) ou dans un
  coin (1 case), si toutes ses cases sont dans la zone. Un pion posé sur le mur de P n'est pas pris.
  Couvert par tests/capture-q4.test.js.
- **Interaction avec `zone_regle = sans_pion_adverse`** : une région qui a un pion adverse sur un
  croisement intérieur n'est pas une zone. Un pion intérieur n'est donc jamais capturé. Un pion au bord
  ou dans un coin ne compte pas pour cette règle et peut encore être capturé. Au banc, les 49 captures
  sur 49 sont au bord. À trancher : faut-il que l'option compte aussi les croisements du bord ?
- **IA forte** : poids dédié `capture` (2,0 par capture faite, −2,0 par capture subie), lu seulement
  si capture ≠ aucune. Sans ce poids, une capture `retour` rend un pion à la réserve adverse, et
  l'évaluation la jugeait légèrement négative.

## Capture définitive (demande du CDP, 03/11 ; défaut inchangé : `capture = aucune`)

- **`definitive` = alias de `sans_retour`.** regles-proto.md (étape 7) dit déjà « avec `sans_retour`, il
  est retiré de la partie » : c'est exactement la capture définitive. Les deux valeurs donnent le
  même état et le même journal (test `capture-definitive.test.js`) ; `sans_retour` est gardé.
- **À confirmer par Lomig : un joueur sans aucun pion** (plus rien en jeu ni en réserve). Les règles
  ne disent rien. Choix neutre du proto : il continue, ne peut que passer et garde son territoire ;
  la partie va au seuil ou au dernier tour. Le journal l'annonce (« … n'a plus aucun pion : il ne
  pourra plus que passer. »). Alternative possible : défaite immédiate, ou fin de partie.
- **Poids de l'IA forte** : `capture_definitive = 8` (contre 4 pour `retour`, relevé de 2 à 4 avec le
  comptage en cases). À 4, la forte entrait encore dans 3 des pièges réels relevés au banc ; à 8,
  aucun. Voir banc/def-tableau.md pour les résultats en cases.

## Passe « IA robuste » (03/11) : ce que les fortes révèlent des règles (pour Lomig ; aucune règle changée)

- **Les vetos ne coûtent rien.**
  - Une RENCONTRE annule les deux trajets.
  - Avec `pose_coupante = annulee`, une pose qui coupe reste en réserve.
  - Deux fortes passent donc leur temps à se bloquer. Entre deux v1, 92 % des déplacements ne s'exécutent pas
    (82 RENCONTRE et 12 COUPURE sur 102). Chaque joueur garde environ 1 pion en jeu, et 77 parties sur 500 finissent 0–0.
- **Bloquer est la bonne réponse.** Une IA qui renonce à un trajet percuté (`repetition` = 3) perd 35 % contre 65 %
  face à la v1 : renoncer laisse passer la fermeture adverse. Le blocage mutuel est donc un équilibre de la règle, pas
  un défaut de l'IA.
- **Leviers possibles, à trancher par Lomig :**
  - qu'une pose coupante soit consommée (`pose_coupante = maintenue`) ;
  - qu'une rencontre ne coûte qu'à un seul des deux joueurs (le soutien existe déjà) ;
  - qu'un pion de réserve non posé coûte quelque chose.


## Ordres par pion (`ordres = pion`, défaut depuis le 04/11)

- **Q « ordres » : tranchée par Lomig (04/11).** `ordres = pion` devient le défaut, avec `poses_par_tour = 1` : au plus
  une pose depuis la réserve par tour, en plus d'un ordre par pion en jeu. `joueur` et `illimite` restent des réglages.

Les points 2 à 6 restent des **choix proto, à soumettre à Lomig un par un**. Les points 7 à 11 sont aussi des lectures
du CDP. Le principe suivi : ce qui serait un auto-sabotage absurde est **refusé à la saisie** (ordre invalide, remplacé
par « rien » dans le journal ; l'interface ne permet pas de le donner), plutôt que de s'annuler en silence.

2. **Pion sans ordre** (à soumettre) : il passe (Passer implicite). Un lot vide équivaut à « Passer ».
3. **Deux trajets amis qui se croisent ou partagent un segment** (à soumettre) : refusé à la saisie. Le test est le même qu'entre
   adversaires (même fonction de rencontre, réglage `depart_libere` compris). Seul le premier trajet saisi est gardé.
   Alternative possible : ils s'annulent comme entre adversaires.
4. **Deux pions amis qui visent la même arrivée** (à soumettre) : c'est un croisement commun, donc refusé à la saisie (cas 3).
5. **Départ ami libéré et échange de places** (à soumettre) : un pion qui vise le départ d'un pion ami qui part : permis, c'est l'équivalent du « départ libéré ». On peut s'y
   arrêter ou le traverser (`traversee`), ou seulement s'y arrêter (`arrivee_seule`). Si le pion de tête est arrêté (par
   exemple par une rencontre adverse), le suiveur est annulé en chaîne (code CHAINE, « votre pion en … ne part pas »),
   comme pour un départ adverse. Traverser un pion ami qui ne bouge pas est refusé à la saisie. Deux pions amis peuvent
   échanger leurs places par des trajets disjoints : les déplacements d'un même joueur sont simultanés.
6. **Pose sur le trajet de son propre pion** (à soumettre) : refusée à la saisie, car elle le couperait. La pose sur le départ de son
   propre pion reste interdite, comme avant (croisement occupé au début du tour, Q10). Deux poses amies sur le même
   croisement sont refusées.
7. **Un pion, un ordre** : un second ordre pour le même pion est refusé.
8. **Fermetures multiples dans un même tour** (toutes les zones fermées comptent, à soumettre avec 2 à 6) : tous les segments tracés par le joueur à ce tour forment ensemble
   `nouveaux(P)`, et toute zone qu'ils ferment compte (gain = union). Les captures et la reprise s'appliquent ensuite
   comme d'habitude.
9. **Conflits avec l'adversaire quand chacun a plusieurs ordres** : ils sont lus sur les ordres d'origine. Un trajet qui
   rencontre deux trajets adverses les annule tous les deux. Une pose adverse ne coupe que le trajet qu'elle touche ; les
   autres trajets du joueur s'exécutent.
10. **Soutien** : remplacé par le §3 de regles-proto v0.3.1 (voir la section « Passe v0.3 » ci-dessous).
11. **Saisie à l'écran** (choix du CDP pour le proto) :
    - glisser depuis un pion qui a déjà un trajet remplace ce trajet ;
    - toucher un pion qui a un ordre annule cet ordre ;
    - toucher une pose prévue l'annule ;
    - avec une pose au plus par tour, une nouvelle pose remplace la précédente ;
    - « Tout effacer » vide le lot ;
    - le compteur « ordres n/m » compte m = pions en jeu + poses encore permises (limite et réserve) ;
    - un tracé qui traverse un pion ami ne s'allonge que si ce pion a déjà un trajet. Il faut donc donner d'abord
      l'ordre du pion de tête.
    - Si l'annulation d'un ordre rend un autre ordre invalide (un suiveur qui comptait sur le départ du pion de tête),
      cet autre ordre est retiré lui aussi, et un message le dit.

## Passe v0.3 / v0.3.1 (04/11)

### Soutien (§3) : lectures L1 à L5 tranchées par Lomig le 04/11 (relais CDP), toutes restent réglables
- **L1 `soutien_point = arrivee`** — tranchée 04/11 : soutenir l'arrivée soutient tout le trajet, à tout point de rencontre
  (arrivée, croisement traversé, segment). Variantes de test : `rencontre`, `trajet`.
- **L2 `soutien_adverse = non`** — tranchée 04/11. Avec `oui` (test) : un ordre de soutien `pour: 'adverse'` renforce les trajets adverses.
- **L3 `soutien_pose = non`** — tranchée 04/11 : une pose vaut toujours 1. Avec `oui` (test) : 1 + soutiens sur son croisement.
- **L4 trajets amis qui se croisent** — tranchée 04/11 : refusés à la saisie (et deux trajets amis n'ont pas la même
  arrivée). Vérifié avec le soutien activé (test `L4` de tests/v03.test.js). Un trajet ami ne traverse pas un pion qui soutient.
- **L5 `coupure = arret`** — tranchée 04/11 : seule une arrivée adverse sur le pion qui soutient coupe le soutien (sauf si ce
  trajet part du croisement soutenu) ; la coupure tient même si l'attaque échoue. Variante de test : `traversee`.
- Les noms des 4 réglages de soutien sont ceux du CDP : la v0.3.1 ne les nomme pas.

### Points codés à la lecture la plus littérale (à confirmer si besoin)
1. **Plusieurs causes d'annulation** : avec `annule_coupe = oui`, 4a, 4b et 4c se lisent tous sur les ordres d'origine et
   chaque cause est journalisée (un trajet qui rencontre deux trajets adverses reçoit deux lignes). Avant la v0.3, le proto
   lisait 4b sur les survivants de 4a en mode pion : un trajet annulé en 4a ne coupait plus une pose. Le mode joueur est
   inchangé (un seul conflit possible) : la référence de 300 parties est identique.
2. **`annule_coupe = non`** : relu de façon séquentielle (4a entre ordres actifs, puis 4b, puis 4c, puis 5, en boucle).
   Un recalcul simultané de 4 sur les survivants redonnerait exactement le résultat de `oui` au premier passage ; la lecture
   séquentielle est la seule qui change quelque chose. **À confirmer par le Créa.**
3. **Conflit pose contre trajet, avec soutien** : une pose vaut 1 ; un trajet soutenu (2+) annule la pose et passe ; à
   égalité, `pose_coupante` décide. Si une pose touche deux trajets, chaque paire se lit à part (S3 « contre chacun »).
4. **Soutien en défense / sans objet** : lu sur les ordres d'origine (S1) : défense si un pion ami est en x et n'a pas d'ordre
   de déplacement ; sinon « soutien sans objet » s'il ne vise pas l'arrivée d'un trajet ami. Un soutien vers l'arrivée d'un
   trajet ami qui est annulé plus tard reste « soutien d'un trajet » au journal.
5. **Garde-fou « pose invalide »** : une pose sur un croisement occupé est refusée à la validation (INVALIDE) ; le garde-fou
   de l'étape 5 reste, journalisé « pose invalide » (il ne peut pas se déclencher avec la validation actuelle).
6. **`territoire_acquis = murs`** : appliqué juste après l'exécution (étape 6), avant les fermetures ; une fermeture du même
   tour peut donc reprendre la case. « Mur de P » = segment à la couleur de P au début du tour. **À confirmer.**
7. **`departage = traces`** : compte tous les segments à la couleur du joueur à la fin du dernier tour.
8. **`retrace_ferme`** : le DEPLACEMENT du journal porte maintenant `retraces` (segments déjà à P reparcourus). La
   couleur est la même dans les deux valeurs ; seule l'appartenance à nouveaux(P) change.
9. **Ancien soutien (v0.1/v0.2, champ `soutien` d'un déplacement)** : supprimé, le champ est ignoré.

### Observé au banc (banc/soutien, banc/v03) : à lire par le Créa
- Avec la forte v2, ~76-79 % des poses et trajets donnés sont annulés, avec ou sans soutien (l'IA donne beaucoup
  d'ordres « offerts » qui échouent). Le soutien ne baisse ce taux que de 3 points : l'IA ne joue que ~1,5 soutien par
  partie. Voir banc/soutien/tableau.md.

- Banc v0.3 (200 parties, IA v2) : retrace_ferme = non et departage = traces ne bougent pas les nuls de façon significative (4,5 / 4,0 / 3,5 %). Voir banc/v03-etat.md.

## Conflit synchro (piste de Lomig, relayée par le CDP le 04/11 — non publiée, hors v0.3.1)

Réglages `conflit` = [trajet] | synchro et `conflit_issue` = [annule] | arret, ce dernier sans effet en mode trajet (vérifié par un test). Code : `resoudreCoupures`, bloc `synchro` ; tests : tests/synchro.test.js. Lectures littérales prises, **à confirmer** :

1. **Pas** : au pas k, un pion qui se déplace est en chemin[k], puis reste sur son arrivée. Une pose et un pion sans déplacement (immobile, qui soutient, ou dont l'ordre est annulé) occupent leur croisement à tous les pas, y compris le pas 0.
2. **Un seul conflit par paire** : pour deux pions, seul le PREMIER conflit dans le temps compte (croisement au pas k, ou face-à-face entre k et k+1). La force est comparée en ce seul point (« strictement plus fort », règle S3 de la v0.3.1) avec la force habituelle (soutien sur l'arrivée d'origine, même si le trajet est ensuite arrêté).
3. **arret** : on s'arrête en chemin[k−1] pour un conflit de croisement au pas k, et en chemin[k] pour un face-à-face entre k et k+1. S'il ne reste aucun segment, l'ordre est annulé. Seuls les segments réellement parcourus sont colorés, et ils peuvent fermer. Si plusieurs conflits sont perdus, c'est l'arrêt le plus tôt qui s'applique. ~~Un pion déjà arrivé qui perd est traversé~~ → **tranché par Lomig le 04/11 (11 h 49)** : un pion déjà arrivé fait obstacle, même plus faible ; le trajet adverse s'arrête juste avant lui (annule : il reste à son départ). On ne déloge jamais un pion ; jamais deux pions sur un croisement (test de propriété). **À égalité entre deux déplacements, les deux s'arrêtent avant le conflit (arret)** : tranché par Lomig le 04/11. Journal : code ARRET.
4. **Obstacles et recalcul** : oui. Un pion annulé (resté au départ) ou arrêté devient un obstacle pour les pas suivants, et on recalcule sur ce nouvel état, en boucle jusqu'à stabilité (cascade, test « cascade »). La passe 1 se fait sur les ordres d'origine, et **rien n'est repêché** : un ordre annulé ou arrêté ne revient jamais, même si sa cause disparaît. C'est l'équivalent pas à pas de l'étape 5 (départs libérés). Contre un pion sans ordre, celui qui arrive perd toujours (CHAINE, « on ne déloge jamais un pion immobile »).
5. **Pions amis** : seul un pion ami déjà arrêté (immobile, arrivé, posé ou arrêté) fait obstacle (CHAINE). Deux trajets amis qui se touchent restent **refusés à la saisie selon la géométrie** (L4, règle actuelle), même en synchro.
6. **Poses** : une pose occupe son croisement dès le pas 0. Un trajet adverse qui l'atteint au pas k est en conflit : les forces sont comparées, et à égalité **la pose tient et le trajet s'arrête avant** (tranché par Lomig le 04/11, 11 h 49) : en synchro, `pose_coupante` n'a plus d'effet (il ne joue qu'en mode trajet). Changement : avant, le défaut « annulée » annulait aussi la pose. Deux poses adverses au même endroit : les deux annulées. Une pose ne peut pas « s'arrêter » : avec arret, elle est annulée. Pose sur un pion adverse resté sur place : « pose invalide » (garde-fou).
7. **Coupure de soutien** : inchangée (S2 sur les ordres d'origine : un trajet adverse dont l'**arrivée** est le pion qui soutient le coupe, même s'il est ensuite annulé ou arrêté avant). Ce trajet est de toute façon en conflit avec le pion immobile.
8. **depart_libere** : sans effet en synchro. Le calendrier tranche à lui seul : on peut traverser ou rejoindre un départ que l'adversaire a déjà quitté, puisqu'il l'a quitté au pas 1. `annule_coupe` est aussi sans effet en synchro (lecture unique, ordres d'origine puis recalcul).
9. **Mode joueur** (`ordres = joueur`) : même règle, appliquée avec un ordre par joueur.
10. **Banc (300 parties par combinaison)** : en synchro, les annulations passent de 78,7 % à 57,7 % (annule) et à 33 % (arret, plus 19 % d'arrêts). Mais A gagne seulement 37 à 42 % des parties décisives (IC95 sous 50 %) : biais à expliquer. Voir banc/synchro/tableau.md.
11. **Bug corrigé (04/11, 11:20)** : en synchro, un segment parcouru par les deux camps à des pas différents prenait toujours la couleur de B (ordre de traitement A puis B). Désormais **le dernier passage dans le temps colore** (avec trace_adverse = garde, le premier reste) : lecture littérale, **à confirmer**. Équilibre A/B revenu à environ 50 % (banc/synchro/tableau.md). Le point 10 ci-dessus date d'avant le correctif.

12. **Tranché par Lomig le 04/11 à 11 h 39 (relayé par le CDP)** : défauts conflit = synchro, conflit_issue = arret, soutien = oui (v0.5). Les anciennes valeurs restent réglables. Les lectures littérales 1 à 9 et 11 ci-dessus restent à confirmer.
13. **Tranchés par Lomig le 04/11 à 11 h 49 (relayés par le CDP)**, v0.5.1 : (1) pion arrivé = obstacle, même plus faible ; (2) égalité entre deux déplacements : les deux s'arrêtent avant ; (3) égalité pose contre trajet : la pose tient, le trajet s'arrête avant. Nouvelles lectures littérales, **à confirmer** :
   - le « pion arrivé » est un pion qui a atteint son arrivée à un pas **antérieur** ; deux pions qui atteignent le même croisement **au même pas** restent un conflit de forces (le plus faible, ou les deux, s'arrête avant) ;
   - une pose reste un conflit de forces (S-4 : un trajet plus fort que la pose la fait annuler), elle n'est pas un « pion arrivé » ;
   - en synchro, le réglage « pose qui coupe » n'a plus d'effet ;
   - code journal : RENCONTRE / ARRET avec `obstacle: 'arrive'`.
