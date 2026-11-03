# QIDIGO prototype : questions ouvertes

Points que ni regles-proto.md v0.2 ni les décisions du CDP (03/11) ne tranchent. Le code les marque
`// A CONFIRMER (regles-proto.md)` et applique, pour l'instant, le choix provisoire indiqué ici.
Les questions réglées (départ libéré, annulations en chaîne, pose sur un départ, échanges, ordre
au chrono expiré, capture par défaut) ont été retirées.

1. **Écart entre v0.2 et le CDP sur le croisement libéré.** v0.2 note comme une décision de Lomig
   (11 h 52) qu'un pion peut entrer sur le croisement qu'un pion adverse quitte « en passage ou en arrivée ».
   Le CDP (03/11) n'autorise que l'arrivée. Le code applique le CDP. Il faut savoir laquelle des deux
   formulations est bien celle de Lomig (voir l'exemple 5).
2. **Segment de sa couleur reparcouru** (étape 5, nouveaux(P)) : un segment déjà à P et reparcouru
   ce tour compte-t-il comme « nouveau » pour fermer une zone ? Provisoirement **oui**
   (engine/resolution.js, `fermeturesDe`).
3. **Les deux au seuil à égalité de croisements, au dernier tour** : « on continue » est impossible.
   Provisoirement, on applique la règle du dernier tour, avec départage aux cases puis nul
   (engine/resolution.js, `verifierFin`).
4. **Choix proto non réglables** : regles-proto.md n'en décrit qu'une seule valeur, donc on ne les
   change pas dans le panneau. Il s'agit de plateau_depart, poses_meme_croisement, dehors_egalite,
   territoire_acquis, pions_comptent, seuil_egalite, departage et fermetures. Il faudrait les
   alternatives pour pouvoir les tester.
5. **IA** : regles-proto.md n'en parle pas. Le prototype embarque une IA « faible ». Elle joue au
   hasard mais toujours des ordres légaux, passe environ une fois sur 20 et n'utilise jamais le
   soutien. Faut-il une IA plus forte pour tester les règles ?
