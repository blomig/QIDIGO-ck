# QIDIGO — règles du prototype web (PROPOSITION)

**Version 0.2 — 03/11/2026, 11 h 55 (heure de Paris).**

Historique :
- v0.1 (03/11, 11 h 48) : première version, envoyée à CDP.
- v0.2 (03/11, 11 h 55) :
  - un pion peut entrer sur le croisement qu'un pion adverse quitte pendant le même tour (décision de Lomig relayée par CDP, 11 h 52). Le croisement de départ ne compte plus dans le test de coupure, et un ordre qui dépend du départ adverse est annulé si ce pion ne part pas ; l'algorithme, les cas limites et les exemples (nouvel exemple 5) sont mis à jour ;
  - `capture` vaut `aucune` par défaut (choix de CDP en attendant Lomig) ; on la réactive dans les réglages.

Ce document sert à coder un prototype qui teste les règles. Ce n'est pas DOCS/RULES.md.
Les décisions de Lomig sont relayées par CDP, dans la formulation de CDP (Q1–Q10 le 03/11 au matin, Q11 et Q12 le 03/11 à 11 h 45, entrée sur un croisement quitté le 03/11 à 11 h 52).
Références : « Qn » = question n de questions-lomig.md ; « Kn » = fiche n de la base K du C-K public (https://blomig.github.io/QIDIGO-ck/), sur laquelle Lomig a laissé un commentaire ; « JdS » = le Jeu du siècle ; « BRIEF » = BRIEF.md du dépôt QIDIGO.
Tout ce qui n'est pas tranché par Lomig est marqué **choix proto, à tester**. Ces choix sont tous réglables, ou faciles à changer.

## 0. Vocabulaire et repères

- **Croisement** : point de la grille où se croisent deux traits. Un pion occupe un croisement.
- **Segment** : morceau de trait entre deux croisements voisins (horizontaux ou verticaux, jamais en diagonale).
- **Case** : carré délimité par 4 croisements. Une grille de N×N croisements a (N−1)² cases.
- **Bord** : les segments du pourtour de la grille.
- **Coordonnées** : un croisement se note (x, y), de 0 à N−1, avec x de gauche à droite et y de haut en bas. La case (i, j) a pour coins (i, j) et (i+1, j+1).

## 1. Règle de base

### Plateau, pions, durée
- Grille de N×N croisements, N = 9 par défaut (81 croisements, 64 cases). C'est le paramètre `grille`.
- Deux joueurs, A et B. Chacun a **5 pions**, tous identiques, dans sa **réserve** au départ (Q9). Le plateau est vide au départ (choix proto, à tester).
- **20 tours** au plus. Chaque tour a une phase de planification de **20 s** (Q8), puis une résolution animée, dont la durée est laissée libre au prototype.

### Ordres
À chaque tour, chaque joueur donne **un seul ordre**, en secret. Les deux ordres sont résolus en même temps. Un ordre est l'un des trois suivants :
- **Poser** : un pion de sa réserve va sur un croisement libre (voir « Croisement libéré » ci-dessous).
- **Déplacer** : un de ses pions suit un **trajet**, c'est-à-dire une suite de croisements voisins reliés par des segments (Q10 b : on glisse le doigt le long des traits). Règles du trajet :
  - au moins 1 segment ;
  - il ne passe pas par un croisement occupé par **un autre de ses propres pions**, et ne s'y arrête pas (choix proto, repris du JdS) ;
  - il peut passer par le croisement d'un **pion adverse**, ou s'y arrêter. L'ordre devient alors **conditionnel** : il n'aboutit que si ce pion adverse quitte son croisement à ce tour (décision de Lomig, 03/11 à 11 h 52 ; voir « Croisement libéré ») ;
  - il n'emprunte pas deux fois le même segment ; il peut repasser par un croisement déjà traversé, y compris son croisement de départ (choix proto, à tester) ;
  - il peut emprunter des segments du bord et des segments déjà colorés, par lui ou par l'adversaire, car les traces ne bloquent pas les déplacements (Q11).
- **Rien** : c'est l'ordre retenu si le chrono expire sans ordre valide (choix proto, à tester). Un ordre « rien » ne coupe rien.

L'interface refuse un ordre invalide. Il n'y a donc pas d'ordre invalide à la résolution. Elle affiche comme conditionnel un ordre qui vise le croisement d'un pion adverse.

### Croisement libéré (décision de Lomig, 03/11 à 11 h 52)
- Un pion peut entrer sur un croisement qu'un pion adverse quitte pendant ce même tour, en passage ou en arrivée.
- La même chose vaut pour une **pose** sur ce croisement (choix proto, à tester : c'est l'extension la plus directe de la décision).
- Le **croisement de départ** d'un pion qui bouge ne compte pas dans le test de coupure. S'il revient sur ce croisement plus loin dans son trajet, ce passage-là compte.
- Si le pion adverse **ne part pas** (son joueur a posé, n'a rien fait, ou a déplacé un autre pion, ou bien son trajet est annulé par une coupure), il reste sur place, et l'ordre qui visait son croisement est **annulé** lui aussi.
- Deux pions qui échangent leurs croisements par le même segment se rencontrent sur ce segment : les deux trajets sont coupés. Par des chemins différents, ils peuvent s'échanger.

### Coupure (Q2 a, Q3 a, et K99)
Comme chaque joueur ne donne qu'un ordre, il n'y a que trois conflits possibles :
1. **Deux trajets se rencontrent** s'ils ont un croisement en commun ou un segment en commun, dans n'importe quel sens et à n'importe quel moment du trajet (Q2 a).
   - Le croisement d'arrivée et les croisements traversés font partie du trajet, mais **pas le croisement de départ** (décision du 03/11 à 11 h 52). Deux pions qui arrivent sur le même croisement se rencontrent donc. Deux pions qui se croisent en sens inverse sur un segment aussi (K99 : rencontre de pions qui bougent ou qui arrivent).
   - Effet : les deux trajets sont coupés.
2. **Une pose tombe sur un croisement du trajet adverse, départ exclu** (Q3 a). Le trajet est coupé. La pose est aussi annulée, puisque le BRIEF annule « l'ordre adverse » (choix proto, à tester ; voir le paramètre `pose_coupante`).
3. **Deux poses sur le même croisement** : les deux sont annulées (choix proto, à tester).

Un trajet coupé est **annulé en entier** : le pion reste sur son croisement de départ et ne laisse aucune trace. L'ordre adverse impliqué est annulé lui aussi (BRIEF).

### Traces
- Un trajet réussi **colore** chacun de ses segments à la couleur du joueur. C'est « la ligne entre départ et arrivée ».
- Une trace reste visible jusqu'à la fin de la partie (Q11).
- Un segment n'a qu'une couleur : celle du dernier joueur qui l'a parcouru avec succès. Passer sur une trace adverse la recolore à sa couleur (choix proto, à tester ; voir le paramètre `trace_adverse`).
- Par défaut, les traces d'un joueur servent de **murs pour ses propres zones** (choix proto, à tester ; paramètre `traces`). Elles ne bloquent jamais un déplacement (Q11).

### Zone
- Pour un joueur P, les **murs** sont le bord (Q12 a) et les segments de la couleur de P.
- On regroupe les cases par **remplissage en 4-connexité** : deux cases qui partagent un côté sont dans la même région si ce côté n'est pas un mur de P.
- La région qui a le plus de cases est le **dehors**. Toutes les autres régions sont des **zones** de P : c'est la règle « on prend la plus petite part » de Q12 a.
- Si plusieurs régions sont à égalité pour le plus grand nombre de cases, toutes sont le dehors (choix proto, à tester).
- Une zone est **fermée à ce tour** si au moins un segment coloré par P à ce tour sépare une de ses cases d'une case extérieure à elle.
- On ferme donc une zone de deux façons :
  - un pion revient sur sa trace, au cours du même trajet ou d'un tour à l'autre ;
  - un trajet boucle avec le bord, d'un bord à un autre ou d'un bord au même bord.

### Territoire
- Chaque case a un **propriétaire** : personne, A ou B. Au départ, aucune case n'a de propriétaire.
- Quand P ferme une zone, il devient propriétaire de ses cases **sans propriétaire** (reprise de zone désactivée, voir `reprise`). Une case déjà possédée garde son propriétaire, même si ses murs disparaissent plus tard : le territoire est acquis (choix proto, à tester).
- **Croisement contrôlé par P** : au moins une des cases qui touchent le croisement (2 à 4 selon sa position) est à P, et aucune n'est à l'adversaire. Ce choix compte la frontière, comme le recommandait Q13, aujourd'hui suspendue (choix proto, à tester ; paramètre `comptage`). Un croisement sur une frontière commune n'est à personne.
- Les pions ne comptent pas en eux-mêmes : seul le territoire compte (choix proto, à tester).
- Exemple : une case fermée seule donne 4 croisements contrôlés.

### Capture
- **Par défaut, pas de capture** (`capture = aucune`). C'est un choix de CDP en attendant Lomig, qui remet Q4 et Q5 en question. On réactive la capture dans les réglages.
- Quand elle est réactivée (`retour` reprend Q4 a et Q5 a) :
  - un pion adverse est capturé si toutes les cases qui touchent son croisement appartiennent à une zone que P ferme à ce tour, et deviennent ou restent à P.
  - avec `retour`, le pion capturé retourne dans la réserve de son propriétaire et peut être reposé dès le tour suivant ; avec `sans_retour`, il est retiré de la partie ;
  - un pion sur la frontière de la zone n'est pas capturé, et un joueur ne capture jamais ses propres pions.

### Fin, victoire, départage
- **Seuil** : contrôler 75 % des croisements (Q7 a), arrondi au croisement supérieur. Cela fait 61 sur 81 en 9×9 (paramètre `seuil`).
- Après chaque tour :
  - si un seul joueur atteint le seuil, il gagne ;
  - si les deux l'atteignent, le plus grand total gagne ; à égalité exacte, la partie continue (choix proto, à tester).
- Après le 20e tour, le plus grand nombre de croisements contrôlés gagne.
- **Départage** (Q18 suspendue) : on compare le nombre de cases possédées, puis on déclare un nul (choix proto, à tester).

## 2. Résolution d'un tour (pseudo-algorithme)

Les étapes marquées [param] changent selon une variante (section 3).

```
ENTRÉE : état (pions, réserves, couleur de chaque segment, propriétaire de chaque case, n° de tour), ordres oA, oB
1. Lire oA et oB (ordre absent ou chrono expiré → RIEN).
2. Validation (déjà faite par l'interface ; revérifier) [param trajet_max] :
   POSER(c) : réserve > 0 ; c vide, ou occupé par un pion ADVERSE (ordre conditionnel).
   DÉPLACER(t) : pion du joueur, ≥ 1 segment, pas deux fois le même segment, longueur ≤ trajet_max,
                 aucun croisement de t (départ exclu) occupé par un AUTRE pion du joueur.
   Ordre invalide → RIEN.
   Notation : depart(t) = premier croisement de t ; croisements(t) = tous les croisements de t SAUF ce premier
   (un retour plus tard sur le départ y figure) ; segments(t) = segments non orientés de t.
   dépend(o) = ensemble des pions adverses dont le croisement (au début du tour) est c pour POSER(c),
               ou appartient à croisements(t) pour DÉPLACER(t).
3. Coupures, sur les ordres d'origine [param soutien, pose_coupante] :
   3a. DÉPLACER(tA)/DÉPLACER(tB) : si croisements(tA) ∩ croisements(tB) ≠ ∅ ou segments(tA) ∩ segments(tB) ≠ ∅
       → annuler oA et oB.
   3b. POSER(c)/DÉPLACER(t) : si c ∈ croisements(t) → annuler le trajet ; annuler aussi la pose.
   3c. POSER(c)/POSER(c) même croisement → annuler les deux.
   3d. Croisements libérés (décision du 03/11 à 11 h 52), en cascade jusqu'à stabilité :
       réussis = ordres non annulés en 3a–3c.
       répéter :
         pour chaque ordre o de réussis et chaque pion q de dépend(o) :
           si l'ordre adverse n'est pas dans réussis, ou n'est pas DÉPLACER du pion q → retirer o de réussis
       jusqu'à ce que réussis ne change plus.
       Les ordres retirés sont annulés (pion sur place, pas de trace). Avec deux ordres, la boucle fait au plus
       deux passes. Deux ordres qui dépendent l'un de l'autre (échange par des chemins différents) restent réussis
       tous les deux.
4. Exécution simultanée des ordres restants :
   POSER : pion de la réserve → croisement.
   DÉPLACER : pion → croisement d'arrivée (tous les départs sont libérés avant toutes les arrivées) ; chaque segment du trajet prend la couleur du joueur [param trace_adverse].
   Retenir pour chaque joueur P : nouveaux(P) = segments colorés par P à ce tour.
5. Fermetures, pour A et B en parallèle, sur l'état après l'étape 4 [param traces] :
   murs(P) = bord ∪ segments de couleur P.
   Remplissage 4-connexe des cases → régions ; dehors = région(s) de taille maximale ; zones = les autres.
   fermées(P) = zones dont la limite contient au moins un segment de nouveaux(P).
   gain(P) = cases des zones fermées(P) qui sont sans propriétaire [param reprise].
6. Attribution simultanée :
   case ∈ gain(A) ∩ gain(B) → elle garde son propriétaire d'avant ;
   sinon case ∈ gain(P) → propriétaire = P.
7. Captures, calculées en parallèle sur les positions après l'étape 4 [param capture] :
   pion de l'adversaire de P dont toutes les cases voisines appartiennent à une même zone de fermées(P) et sont à P
   après l'étape 6 → capturé. Appliquer toutes les captures ensemble. Par défaut (capture = aucune), l'étape est sautée.
8. Comptage : ctrl(P) = croisements contrôlés par P (définition section 1) [param comptage].
9. Fin [param seuil] :
   S = seuil en croisements.
   un seul P avec ctrl(P) ≥ S → P gagne.
   les deux ≥ S → le plus grand gagne ; égalité → continuer.
   sinon, si tour = 20 → le plus grand ctrl gagne ; égalité → plus de cases possédées ; égalité → nul.
   sinon tour += 1.
```

## 3. Variantes activables

Chaque variante est un paramètre de partie. La valeur par défaut est en gras.

| Paramètre | Valeurs | Défaut | Effet dans la résolution |
|---|---|---|---|
| `grille` | 7, 8, **9** | 9 | Initialisation : N×N croisements, (N−1)² cases. Lomig demande de ne pas exclure 8 ni 7 (K158). |
| `capture` | **`aucune`**, `retour`, `sans_retour` | `aucune` (choix de CDP en attendant Lomig, v0.2) | Étape 7. `aucune` : l'étape est sautée. `retour` : le pion va en réserve et peut être reposé au tour suivant (Q4 a, Q5 a). `sans_retour` : le pion est retiré de la partie. Lomig remet Q4 et Q5 en question (K160). |
| `trajet_max` | **`illimite`**, 3, 5 | `illimite` | Étape 2 : nombre maximal de segments d'un trajet. Lomig hésite : un long trajet risque davantage d'être coupé (K98). |
| `soutien` | `oui`, **`non`** | `non` | Étapes 2, 3a et 3b (pas 3d). Voir ci-dessous. |
| `traces` | **`bord_de_zone`**, `decoratives` | `bord_de_zone` | Étape 5. `bord_de_zone` : murs(P) = bord + toutes les traces de P. `decoratives` : les traces ne servent que d'affichage, et murs(P) = bord + segments du seul trajet de P à ce tour (une zone ne se ferme qu'en un trajet). Q11 laisse le choix ouvert. |
| `reprise` | `oui`, **`non`** | `non` | Étape 5. `non` : gain = cases sans propriétaire. `oui` : gain = toutes les cases de la zone fermée, y compris celles de l'adversaire ; on reprend un territoire par morceaux en fermant une zone qui en couvre une partie (K98). L'étape 6 s'applique telle quelle. |
| `seuil` | pourcentage entier, **75** | 75 | Étape 9 : S = ⌈seuil × N² / 100⌉. À 75 % : 61 croisements sur 81 (N = 9), 48 sur 64 (N = 8), 37 sur 49 (N = 7). |

Trois paramètres supplémentaires couvrent les choix proto de la section 1 :

| Paramètre | Valeurs | Défaut | Effet |
|---|---|---|---|
| `pose_coupante` | **`annulee`**, `maintenue` | `annulee` | Étape 3b : la pose qui coupe a lieu ou non. Q16 est suspendue. |
| `trace_adverse` | **`recolore`**, `garde` | `recolore` | Étape 4 : passer sur un segment adverse le recolore, ou bien il garde sa couleur. |
| `comptage` | **`frontiere`**, `interieur` | `frontiere` | Étape 8. `interieur` : un croisement est contrôlé seulement si toutes ses cases voisines sont à P (une case seule vaut alors 0). Q13 est suspendue. |

### Soutien façon Diplomacy (`soutien = oui`)
C'est une transposition simple, en piste (K161).
- Avec un ordre DÉPLACER, le joueur peut désigner un **soutien** : un autre de ses pions, situé à un segment du croisement de départ au début du tour. Ce pion renonce à bouger, ce qui est de toute façon le cas puisqu'un seul ordre est donné par tour.
- Étape 2 : un soutien qui n'est pas adjacent au départ est ignoré. Le trajet reste valide, mais il n'est pas soutenu.
- Étape 3a :
  - si les deux trajets sont soutenus, ou si aucun ne l'est, la règle de base s'applique ;
  - si un seul est soutenu, seul le trajet non soutenu est annulé, et le trajet soutenu s'exécute.
- Étape 3b : une pose sur un trajet soutenu ne le coupe pas. La pose est annulée et le trajet s'exécute.
- Une pose ne peut pas être soutenue.
- Le soutien ne protège pas d'une annulation de l'étape 3d : un trajet soutenu qui vise le croisement d'un pion adverse qui ne part pas est annulé.

## 4. Cas limites tranchés

Les choix de base ci-dessous sont des choix proto, à tester.
- **Entrer sur le croisement d'un pion adverse** : c'est permis et conditionnel. L'ordre aboutit si ce pion part à ce tour, et il est annulé si ce pion reste, quelle qu'en soit la raison (étape 3d).
- **Échange de croisements** : par le même segment, c'est une rencontre sur ce segment, donc une coupure ; par des chemins différents, les deux pions s'échangent.
- **Fermetures simultanées** : les deux joueurs ferment en parallèle, sur le même état. Une case gagnée par les deux au même tour garde son propriétaire d'avant (étape 6). Si la capture est réactivée, les captures des deux côtés s'appliquent ensemble : un pion qui ferme peut lui-même être capturé.
- **Zone fermée par les traces des deux joueurs** : elle n'est à personne. Chaque joueur ne compte que ses propres traces comme murs.
- **Trajet qui passe sur une trace adverse** : c'est permis, car les traces ne bloquent pas. Le segment est recoloré, ce qui ouvre un mur adverse pour ses fermetures futures. Les cases déjà possédées par l'adversaire restent à lui.
- **Trajet qui fait une boucle en un seul ordre** : c'est permis, puisqu'on peut revenir sur un croisement déjà traversé, départ compris. La boucle ferme une zone dès ce tour.
- **Pion adverse entré dans ma zone plus tard** : avec la capture réactivée, il n'est pas capturé, car on ne capture qu'au tour de la fermeture. Il peut aussi être posé dans ma zone.

### Exemples

Notation : `o` croisement vide, `A` / `b` pions, `═` et `║` traces de A, `─` trajet de B. Le bord haut et le bord gauche sont visibles ; on montre le coin d'une grille 9×9.

**1. Boucle avec deux bords (et capture, si elle est réactivée).** Le pion A va de (2,0) à (0,2) en passant par (2,1), (2,2) et (1,2).
- Les cases (0,0), (1,0), (0,1) et (1,1) forment une région de 4 cases ; le reste en fait 60. C'est donc une zone de A.
- A contrôle 9 croisements, de (0,0) à (2,2).
- Le pion b en (1,1) a ses 4 cases voisines dans la zone. Par défaut (`capture = aucune`), il reste en place. Avec `capture = retour`, il est capturé et retourne dans la réserve de B ; avec `sans_retour`, il est retiré de la partie.
- Le pion A arrivé en (0,2) est sur la frontière.

```
     x=0   1   2   3
y=0    o   o   o   o
               ║
y=1    o   b   o   o
               ║
y=2    A═══o═══o   o
y=3    o   o   o   o
```

**2. Fermeture en deux tours, en revenant sur sa trace.**
- Tour t : le pion A va de (4,4) à (5,5) en passant par (5,4).
- Tour t+1 : le même pion va de (5,5) à (4,4) en passant par (4,5).
- La case (4,4) est entourée : A gagne une zone d'une case, soit 4 croisements contrôlés.

```
     x=4   5
y=4    o═══o
       ║   ║
y=5    o═══A
```

**3. Rencontre (K99).**
- A : (3,1) → (3,2) → (3,3). B : (4,2) → (3,2) → (2,2).
- Les deux trajets ont le croisement (3,2) en commun : ils sont annulés, les pions restent en (3,1) et (4,2), et aucune trace n'est laissée.
- Même résultat si les deux pions se croisent en sens inverse sur un segment, par exemple A par (5,5) puis (6,5), et B par (6,5) puis (5,5).

```
     x=2   3   4
y=1    o   A   o
           ║
y=2    o───X───b      X = rencontre : les deux ordres sont annulés
           ║
y=3    o   o   o
```

**4. Murs mêlés et trace adverse.**
- Les côtés haut et gauche de la case (2,2) sont des traces de A ; les côtés bas et droit sont des traces de B. Aucun joueur n'a de zone, car chacun ne voit que ses propres murs.
- Si, plus tard, A passe sur le côté bas, celui-ci devient à A. A a alors trois côtés, et un trajet de A sur le côté droit fermera la case pour lui.

```
     x=2   3
y=2    o═══o
       ║   │
y=3    o───o
```

**5. Entrer sur le croisement qu'un pion adverse quitte** (décision du 03/11 à 11 h 52). A est en (2,2), b en (3,2).
- A : (2,2) → (2,3). B : (3,2) → (2,2) → (1,2), un ordre conditionnel, puisqu'il passe par le croisement de A.
- Test de coupure : on ne compte pas les départs (2,2) pour A et (3,2) pour B. Les croisements de A se réduisent à {(2,3)}, ceux de B sont {(2,2), (1,2)} : aucun croisement commun. Aucun segment commun non plus. Pas de coupure.
- Étape 3d : B dépend du départ de A, et A part. Les deux trajets aboutissent : A arrive en (2,3), b en (1,2).
- Si A avait posé un pion ailleurs, ou n'avait rien fait, A resterait en (2,2) : l'ordre de B serait annulé, et b resterait en (3,2).
- Si A avait joué (2,2) → (3,2), les deux pions s'échangeraient par le même segment : rencontre, donc les deux trajets sont coupés.

```
     x=1   2   3
y=2    o───A───b      B passe par (2,2), que A quitte
           ║
y=3    o   o   o      A descend en (2,3)
```
