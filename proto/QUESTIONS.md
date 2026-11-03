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
