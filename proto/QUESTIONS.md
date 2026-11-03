# QIDIGO prototype : questions

Points que ni regles-proto.md v0.2 ni les décisions de Lomig et du CDP (03/11) ne tranchent.
Le code les marque `// A CONFIRMER (regles-proto.md)`.

## Tranchées (03/11)

1. **Départ libéré : traverser ou seulement s'arrêter.** Lomig a tranché (décision relayée par le
   CDP) : par défaut, on peut s'arrêter sur le croisement que quitte un pion adverse, ou le traverser,
   comme dans la v0.2. Si ce pion ne part pas, l'ordre qui visait ou traversait son croisement est
   annulé, en chaîne. Réglage `depart_libere` = `traversee` (défaut) | `arrivee_seule`.
5. **IA** : close. Pas d'IA plus forte pour l'instant. L'IA « faible » joue au hasard des ordres
   toujours légaux, passe environ une fois sur 20 et n'utilise pas le soutien.

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
   Lomig tranche. Rien n'est changé dans le moteur.

8. **Valeur par défaut de `reprise`** : le tableau de regles-proto.md §3 indique `non`, la décision
   de Lomig (03/11) donne `oui`. Le proto suit Lomig. La partie de Lomig a été jouée avec `non` (le
   test la rejoue avec `reprise = non`).

9. **Journal de Lomig, tour 10** : le journal ne donne que le départ et l'arrivée. Sept trajets
   différents donnent le même résultat. Le test garde le premier (tests/journaux/lomig-2026-11-03-ordres.json).

10. **Blocage gratuit par une pose sur le départ** (observé au banc, IA forte contre IA forte).
    Grille 9, reprise oui, 12 parties : 10 sur 12 finissent 0–0 au tour 20, pour 38 coupures par partie.
    Validation du tuning : 316 nuls sur 400.
    - Le schéma : un joueur pose chaque tour sur le croisement de départ du seul pion adverse en jeu.
      Règle (choix du CDP, réglage `depart_libere`) : « Une pose sur ce départ coupe toujours les deux ordres. »
    - La pose est annulée, donc la réserve ne baisse pas et ce veto ne coûte rien. Il se répète à
      l'infini : l'autre joueur ne bouge plus et personne ne marque.
    - `pose_coupante = maintenue` ne change rien, car le départ est un cas à part.
    - Options :
      1. Le veto coûte un pion : la pose sur un départ est maintenue (le pion est posé) ou le pion est perdu.
      2. La pose sur un départ ne coupe que le déplacement adverse, sans être annulée : elle a lieu sur le
         croisement libéré.
      3. Pas deux fois de suite sur le même pion : on ne peut pas poser sur le départ du même pion deux tours de suite.
    Avec plusieurs pions en jeu, on ne bloque qu'un pion par tour. Le blocage total vient de l'IA, qui
    garde ses pions en réserve. C'est un point à corriger côté IA (voir le rapport du banc). La règle,
    elle, rend ce veto gratuit.
