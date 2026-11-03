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

## Ouverte

4. **Choix proto non réglables** : regles-proto.md n'en décrit qu'une seule valeur. Il s'agit de
   plateau_depart, poses_meme_croisement, dehors_egalite, territoire_acquis, pions_comptent,
   seuil_egalite, departage et fermetures. Il faudrait les alternatives pour pouvoir les tester.
