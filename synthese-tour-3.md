# QIDIGO — synthèse du tour 3 du C-K (03/11/2026)

Tout reste PISTE ou PROPOSITION : rien n'est une règle tant que DOCS/RULES.md n'existe pas (AGENTS.md).
Sources du tour : décisions Q11 et Q12 (03/11, 11 h 45), entrée sur un croisement quitté (03/11, 11 h 52) et commentaires giscus de Lomig. Tout cela est relayé par CDP : c'est une « décision ou commentaire de Lomig relayé par CDP ». Les décisions sont dans la formulation de CDP ; les commentaires sont recopiés tels quels. « capture = aucune par défaut » est un choix de CDP pour le prototype, pas une décision de Lomig.

## Chiffres

- 236 K (203 + 33 nouvelles, K204–K236) :
  - 15 décisions ou commentaires de Lomig relayés par CDP (5 décisions, 10 citations de commentaires giscus ; le commentaire sur K98 compte pour deux) ;
  - 2 K prototype : le choix de CDP et regles-proto.md v0.2 ;
  - 8 K externes à URL vérifiée : Diplomacy ×2, jeux résolus ×2, go, Chess.com ×3 ;
  - 8 déductions.
- 120 C (103 + 17 nouvelles, C60–C76) :
  - 15 choisies, 27 écartées (conservées), 77 ouvertes ;
  - 42 C portent le paramètre du prototype qui les teste.
- 376 opérateurs : 17 K→K, 119 C→C, 120 K→C, 120 C→K.
- Aucun identifiant existant n'a changé : les fils giscus restent valables. Seuls le texte du C0 et certaines décisions ont évolué.

## C0 révisé

> Duel classé 1 contre 1 pour iPhone (portrait), freemium sans pub, sur une grille de traits de 9×9 croisements (7×7 et 8×8 non exclus) : chaque joueur a 5 pions identiques ; 20 tours de 20 s ; à chaque tour, chaque joueur donne un ordre secret, résolu en même temps que l'autre — poser un pion, ou déplacer un pion par un trajet glissé le long des traits ; un pion peut entrer sur un croisement qu'un pion adverse quitte au même tour ; deux trajets qui se rencontrent (même croisement, départ exclu, ou même segment) se coupent, comme une pose sur un trajet ; un trajet coupé est annulé, ainsi que l'ordre adverse ; le trajet réussi laisse une trace colorée, visible, qui ne bloque pas les déplacements ; on gagne du terrain en fermant une zone — un pion qui revient sur sa trace ou boucle avec le bord, le bord servant de mur et la plus petite part étant prise ; la partie finit après 20 tours ou à 75 % des croisements contrôlés ; ouverts : rôle des traces comme bord de zone, reprise de zone (par morceaux ?), capture (aucune, avec ou sans retour), soutien façon Diplomacy, longueur maximale du trajet ; simple, rapide, profond.

Changements par rapport au C0 du tour 2 :
- les traces restent visibles et ne bloquent pas les déplacements (Q11) ;
- le bord sert de mur et on prend la plus petite part (Q12 a) ;
- un pion peut entrer sur un croisement qu'un pion adverse quitte (11 h 52) ;
- la capture et le retour en réserve ne sont plus acquis (Q4 et Q5 remises en question) ;
- les pions sont identiques ;
- 7×7 et 8×8 ne sont plus exclus.

**Évaluation.**
- Forces :
  - le cœur est nommé : gagner et perdre des zones ;
  - chaque option se teste par un paramètre du prototype ;
  - sans capture, la tension des boucles disparaît.
- Faiblesses :
  - sans capture, enfermer un pion adverse ne sert à rien ;
  - sans reprise, le territoire se fige ;
  - les ordres conditionnels ajoutent une étape ;
  - écart avec le BRIEF sur la taille de la grille.

## Décisions intégrées

| Source | Contenu | Effet sur l'arbre |
|---|---|---|
| Q11 | Traces visibles, ne bloquent pas ; bord de zone à voir | C2a et C27 écartées ; C2b ouverte (paramètre `traces`) |
| Q12 a | Le bord est un mur, on prend la plus petite part | C20 choisie ; C21, C22 écartées ; C76 (égalité de taille, choix proto) |
| Q4, Q5 remises en question | Capture par enfermement, retour en réserve | C2c, C8c, C10, C32 repassent ouvertes ; nouvelles C62 (pas de capture) et C63 (sans retour) |
| Q13–Q18 suspendues | — | non reposées ; leurs C restent ouvertes, avec un paramètre du prototype quand il existe |
| 11 h 52 | Entrée sur un croisement quitté | C70 et C72 choisies, C71 (ancienne règle) écartée, C73 (pose, choix proto) |
| Choix de CDP | `capture = aucune` par défaut | C62 = défaut du prototype, toujours ouverte pour Lomig |
| Commentaire de Lomig sur K158 | Ne pas exclure 7×7 et 8×8 | C53 rouverte, C60 (9×9) et C61 (8×8) |

## Gain et perte de zones

1. **Fermer une zone.**
   - Commentaire de Lomig sur K98 : un pion bouge un peu, puis rebouge pour fermer, en revenant sur lui-même ou en bouclant avec deux bords. Cela suppose que les traces des tours précédents servent de bord : c'est C23 avec `traces = bord_de_zone`, défaut du proto.
   - La variante `traces = decoratives` (C19) n'admet qu'une fermeture en un seul trajet.
   - Le bord est un mur et on prend la plus petite part (C20). La plus petite fermeture est une case, soit 4 segments (K196).
2. **Reprendre une zone.**
   - Par morceaux (C66, `reprise = oui`) : fermer une zone qui couvre une partie du territoire adverse la reprend.
   - Sans reprise (C36, défaut), le territoire est acquis.
   - La tension T-ZONE est nouvelle : un territoire acquis risque de figer la partie, une reprise fait bouger le comptage.
3. **Soutien façon Diplomacy.**
   - Diplomacy (K221, K222) : une unité soutient une unité voisine ; le plus soutenu passe ; à égalité, personne ne passe ; un soutien attaqué est coupé ; soutenir coûte l'ordre de l'unité.
   - Déduction K231 : en QIDIGO, un seul pion bouge par tour, donc soutenir ne coûte que la position.
   - Deux transpositions sont possibles :
     - C64, soutien positionnel (`soutien = oui` du proto) : un allié voisin du départ protège le trajet ;
     - C65, soutien par comptage : le plus soutenu passe ; non codé.
4. **Rencontre de pions.**
   - Commentaire de Lomig sur K99 : l'annulation vient aussi de la rencontre de pions qui bougent ou arrivent. C72 l'intègre : même arrivée, ou sens inverse sur un segment, c'est une coupure.
   - Avec l'entrée sur un croisement quitté (C70), le départ ne compte pas.
   - L'ordre qui vise un pion adverse qui ne part pas est annulé, en cascade de deux passes au plus (K235).
5. **Longueur maximale du trajet.**
   - Commentaire de Lomig sur K98 : un long trajet risque davantage la coupure.
   - Variantes : illimitée (C13, défaut), 3 (C74) ou 5 segments (C75).
   - 5 segments permettent de fermer une case en un trajet.
6. **Capture.**
   - Trois valeurs : aucune (C62, défaut du proto), avec retour (C10), sans retour (C63).
   - Sans capture, chaque joueur pose au plus 5 fois, donc au moins 15 de ses 20 ordres ne sont pas des poses (K229), et la boucle T-BOUCLE disparaît (K230).
   - Avec capture sans retour, le matériel diminue et la capture pèse lourd.

## K→K du tour

- **Diplomacy** (https://en.wikipedia.org/wiki/Diplomacy_(game)) : règles du soutien et du standoff. Déduction : le soutien est positionnel en QIDIGO (K231).
- **Grilles 7×7 et 8×8** :
  - déduction K232 : 49, 64 et 81 croisements ; seuils de 37, 48 et 61 ; environ 56,1, 49,1 et 43,7 pt par croisement, soit environ 9,3, 8,1 et 7,2 mm ; seul le 7×7 atteint les 9,2 mm de Parhi ;
  - le go 7×7 est faiblement résolu depuis 2015 ; Othello et les dames 8×8 sont nuls avec un jeu parfait (https://en.wikipedia.org/wiki/Solved_game, https://en.wikipedia.org/wiki/Reversi) ;
  - mais ces jeux sont à tour de rôle et à information parfaite, alors que QIDIGO est simultané : un petit plateau n'est pas « résolu » pour autant (K233, à creuser).
- **Chess.com** (K226–K228) :
  - modèle freemium (https://en.wikipedia.org/wiki/Chess.com) ;
  - le compte gratuit donne des parties illimitées dans toutes les cadences, mais 3 problèmes par jour, 1 analyse complète par jour et 1 partie contre le Coach par mois (https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me) ;
  - les abonnements Gold, Platinum et Diamond ajoutent apprentissage, analyse et absence de pub ; il existe aussi « No Ads » et « Friends & Family » (https://www.chess.com/membership) ;
  - aucun prix n'est relevé : ils sont affichés selon le pays ;
  - réponse à la question de Lomig : les utilisateurs paient l'amélioration et l'absence de pub, pas le droit de jouer.
  - Piste pour QIDIGO, déjà sans pub (K236) : vendre l'analyse des parties, des problèmes et l'entraînement, jamais le droit de jouer en classé.
- **Pions identiques** (commentaire de Lomig sur K107, et go : « Despite its relatively simple rules, Go is extremely complex », https://en.wikipedia.org/wiki/Go_(game)) : un ordre se réduit à « où poser » ou « quel trajet » (K234).

## C branchées sur le prototype (proto/regles-proto.md v0.2)

| Paramètre | Valeur → C |
|---|---|
| `grille` | 9 → C60 (défaut) · 8 → C61 · 7 → C53 |
| `capture` | aucune → C62 (défaut) · retour → C10 · sans_retour → C63 ; mode d'enfermement → C8c |
| `trajet_max` | illimite → C13 (défaut) · 3 → C74 · 5 → C75 |
| `soutien` | non → C7 (défaut) · oui → C64 ; C65 non codée |
| `traces` | bord_de_zone → C2b, C23 (défaut) · decoratives → C19 |
| `reprise` | non → C36 (défaut) · oui → C66 |
| `seuil` | 75 → C11c (défaut, réglable) |
| `pose_coupante` | annulee → C67 (défaut) · maintenue → C43 |
| `trace_adverse` | recolore → C68 (défaut) · garde → C69 |
| `comptage` | frontiere → C40 (défaut) · interieur → C41 |
| règle de base | C6, C6a, C6c, C11b, C12, C16a, C17, C20, C24, C28, C38, C42, C59, C70, C72 ; choix proto : C73, C76 |

Chaque fiche C du site affiche son paramètre (« Paramètre du prototype »), et chaque C→K se lit comme un test de prototype.

## Tensions

- **T-BOUCLE** : levée par défaut (pas de capture) ; elle revient avec `capture = retour`.
- **T-BLOCAGE** : Lomig y voit un choix de Diplomacy qui « force la réflexion » ; le soutien (C64, C65) est la piste.
- **T-BRIEF** : 9×9 dans le BRIEF ; 7×7 et 8×8 non exclus par Lomig.
- **T-SIMPLE** : les ordres conditionnels ajoutent une étape, bornée ; les pions identiques simplifient.
- **T-ZONE** (nouvelle) : territoire acquis contre reprise.

## Questions du tour 3 (Q19–Q22)

Q13–Q18 sont suspendues et ne sont pas reposées. Sont exclues parce que déjà tranchées :
- l'entrée sur un croisement quitté (décidée) ;
- le rôle des traces comme bord de zone, tranché implicitement par le commentaire de Lomig sur K98, qui ferme une zone sur plusieurs tours : `bord_de_zone`, défaut du proto ;
- la taille de la grille, qui reste un paramètre de test.

1. La capture de pion : on la garde ?
   a) non, pas de capture : seul le terrain compte
   b) oui, le pion enfermé retourne dans la réserve
   c) oui, le pion enfermé est perdu
   Recommandation : a) pour commencer les tests (défaut du proto), puis c) en variante.
2. L'adversaire peut-il reprendre une de mes zones ?
   a) non, une zone fermée est acquise
   b) oui, par morceaux, en fermant une zone qui en couvre une partie
   Recommandation : b) : c'est ton idée, et sans reprise la partie risque de se figer.
3. Un soutien façon Diplomacy ?
   a) non
   b) oui : un pion allié voisin du départ protège le trajet ; seul un trajet soutenu le coupe
   c) oui : le trajet le plus soutenu passe, égalité = les deux annulés
   Recommandation : b) en variante de test ; a) par défaut.
4. Longueur maximale d'un trajet ?
   a) illimitée
   b) 3 segments
   c) 5 segments
   Recommandation : a) : un long trajet risque déjà plus la coupure ; trancher après tests.

## Prochaine étape

Il faut coder le prototype (regles-proto.md v0.2, par Dev), jouer des parties avec les valeurs par défaut, puis faire basculer un paramètre à la fois : capture, reprise, soutien, trajet_max, grille. Les réponses à Q19–Q22 fixeront les défauts.
