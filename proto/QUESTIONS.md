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
