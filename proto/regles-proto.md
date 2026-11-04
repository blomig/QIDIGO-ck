# QIDIGO — règles du prototype web (PROPOSITION)

**Version 0.4 — 04/11/2026, 11 h 41 (heure de Paris).**

Historique :
- v0.1 (03/11, 11 h 48) : première version.
- v0.2 (03/11, 11 h 55) : entrée sur le croisement qu'un pion adverse quitte ; `capture = aucune` par défaut. Copie : `proto/regles-proto-v0.2.md`.
- v0.3 (04/11, 10 h 45) : décrit la règle en vigueur du prototype en ligne (https://blomig.github.io/QIDIGO-ck/proto/). Changements :
  - **un ordre par pion**, au plus une pose par tour (Lomig, 04/11) ; la résolution est réécrite ;
  - pose interdite sur un croisement occupé (Lomig, 03/11) ;
  - départ libéré confirmé, en passage comme en arrivée (Lomig) ;
  - boucle jusqu'à stabilité, avec journal des annulations ;
  - « Passer » à l'expiration du chrono ;
  - `trajet_max = 5` par défaut (Q22) ;
  - `reprise = oui` par défaut (Q20 b) ;
  - territoire compté **en cases**, seuil à 75 % des cases (remplace Q7) ; `comptage = cases` par défaut, et les deux anciens comptages en croisements ne restent que pour les tests ;
  - nouveau réglage `soutien` (Lomig, 04/11), qui remplace l'ancien ;
  - les réglages déjà codés par Dev sont décrits (`ordres`, `poses_par_tour`, `depart_libere`, `zone_regle`, `reprise_meme_tour`, `repasser_croisement`) ;
  - des alternatives sont proposées pour trois choix fixes (`retrace_ferme`, `departage`, `annule_coupe`) et un quatrième (`territoire_acquis`).

- v0.3.1 (04/11, 10 h 33) : §3 figé selon les décisions de Lomig du 04/11, relayées par CDP (L1 b, L2 a, L3 a, L4 a, L5 a). Copie de la v0.3 : `proto/regles-proto-v0.3.md`.
  - on soutient l'**arrivée** d'un trajet, ce qui soutient tout le trajet ; la force vaut en tout point de rencontre ;
  - un soutien qui ne vise pas une arrivée amie vaut une défense, ou rien ;
  - la liste des lectures à soumettre est retirée ;
  - S-3 est revu, et l'exemple S-5 est ajouté.

- v0.4 (04/11, 11 h 41) : décisions de Lomig du 04/11, relayées par CDP, dans la formulation de CDP. Copie de la v0.3.1 : `proto/regles-proto-v0.3.1.md`.
  - **conflit synchronisé** pas à pas, par défaut (`conflit = synchro`) ;
  - **le perdant s'arrête avant le conflit** (`conflit_issue = arret`) ;
  - **soutien activé** par défaut (`soutien = oui`) ;
  - un trait partagé prend la couleur du dernier passage (point 11 de Dev) ;
  - les lectures 1 à 10 de Dev sont reprises comme choix proto ;
  - résolution réécrite (§2), l'ancienne étant gardée au §2 bis ;
  - exemples revus, et nouveaux exemples 7, 8 et S-6.

Ce document sert au prototype. Ce n'est pas DOCS/RULES.md.
Sources : décisions de Lomig relayées par CDP, dans la formulation de CDP (03/11 et 04/11), et retours de Dev.
Références : « Qn » = question n de questions-lomig.md ; « Kn » = fiche K du C-K public.
Tout ce que Lomig n'a pas tranché est marqué **choix proto** : c'est réglable, ou facile à changer.

## 0. Vocabulaire

- **Croisement** : point où se croisent deux traits. Un pion occupe un croisement.
- **Segment** : morceau de trait entre deux croisements voisins (jamais en diagonale). Un **pas** = un segment.
- **Case** : carré délimité par 4 croisements. Une grille de N×N croisements a (N−1)² cases.
- **Bord** : les segments du pourtour.
- **Coordonnées** : (x, y) de 0 à N−1, x vers la droite, y vers le bas. La case (i, j) a pour coins (i, j) et (i+1, j+1).
- **Chemin d'un trajet** : ses croisements **sauf le croisement de départ**, arrivée comprise. Un retour sur le départ plus loin dans le trajet en fait partie.

## 1. Règle de base

### Plateau, pions, durée
- Grille de N×N croisements, N = 9 par défaut (paramètre `grille`).
- Deux joueurs, A et B, chacun avec **5 pions identiques** dans sa réserve (Q9). Le plateau est vide au départ (choix proto).
- **20 tours** au plus, chacun avec **20 s** de planification (Q8), puis une résolution animée.

### Ordres : un par pion (Lomig, 04/11)
À chaque tour, chaque joueur donne en secret :
- **un ordre à chacun de ses pions posés** :
  - **Bouger** : le pion suit un trajet ;
  - **Tenir** : il reste immobile ;
  - **Soutenir** : seulement si `soutien = oui`, voir la section 3 ;
- **au plus une pose** : un pion de sa réserve va sur un croisement **libre au début du tour**.

**Passer** :
- c'est un bouton explicite : tous mes pions tiennent et je ne pose pas ;
- **quand le chrono expire**, l'ordre enregistré est « Passer » pour tout ce qui n'est pas validé. Les pions qui n'ont pas d'ordre validé tiennent, et la pose non validée n'a pas lieu.
- Choix proto : les ordres déjà validés avant l'expiration restent valables.

**Règles du trajet** :
- de 1 à **5 pas** (Q22 ; paramètre `trajet_max`) ;
- jamais deux fois le même segment ; on peut repasser par un croisement déjà traversé, départ compris ;
- les traces ne bloquent pas (Q11) ;
- il peut passer ou s'arrêter sur le croisement **d'un de ses propres pions** seulement si ce pion bouge à ce tour. Cet ordre est aussi conditionnel : si le pion de tête est arrêté, le suiveur est annulé en chaîne. C'est le départ libéré entre amis (lecture de CDP codée par Dev ; décision de Lomig du 04/11, relayée par CDP, L4 a). Traverser un pion ami qui ne bouge pas est refusé ;
- il peut passer ou s'arrêter sur le croisement **d'un pion adverse**, mais il devient alors **conditionnel** : voir « Départ libéré ».

**Ordres amis entre eux** : l'interface refuse (choix proto) :
- deux trajets amis qui ont un croisement de chemin ou un segment en commun (donc aussi deux trajets amis vers le même croisement) ;
- une pose amie sur le chemin d'un trajet ami.

Un même joueur voit tous ses ordres : il n'a pas à se couper lui-même. **Toutes les coupures de la résolution opposent donc A à B.**

**Validation** : l'interface refuse les ordres invalides, et la résolution les revérifie. Un ordre invalide devient « Tenir », ou « pas de pose », et il est journalisé.

### Pose : jamais sur un croisement occupé (Lomig, 03/11)
- On ne pose que sur un croisement **sans pion au début du tour**, même si ce pion part pendant le tour.
- La pose conditionnelle de la v0.2 (choix proto C73) est donc supprimée.

**Écart noté.**
- La v0.2 et le premier code de Dev admettaient une pose sur le départ d'un pion qui bouge. Dev la traitait comme une coupure des deux ordres, au nom de Q3, même avec le soutien ou `pose_coupante = maintenue`.
- Avec la règle du 03/11, ce cas ne peut plus se produire, puisque le départ est occupé au début du tour. La règle de Dev n'a donc plus d'objet ; elle peut rester dans le code comme garde-fou, journalisée « pose invalide ».
- Le blocage gratuit (poser sur le départ adverse pour annuler son trajet) disparaît.
- Une pose sur un croisement **traversé ou d'arrivée** du trajet adverse coupe toujours ce trajet (Q3 a).

### Départ libéré (Lomig : confirmé)
- En synchro (défaut), le calendrier règle ce cas tout seul : `depart_libere` n'a pas d'effet. Les règles ci-dessous décrivent le mode `conflit = trajet`.
- Un trajet peut **traverser** le croisement qu'un pion adverse quitte à ce tour, **ou s'y arrêter**. La v0.2 est confirmée. Dev avait d'abord codé « arrivée seule » ; le défaut du code est maintenant `depart_libere = traversee`.
- Le croisement de départ ne compte jamais dans les coupures.
- Avec `depart_libere = arrivee_seule` (réglage de test), traverser ce croisement est une rencontre : les deux trajets sont coupés.
- Si le pion adverse **ne part pas** (il tient, soutient, ou son trajet est annulé), le trajet qui passait ou s'arrêtait sur son croisement est **annulé**, avec la cause « départ non libéré ».
- **On ne déloge jamais un pion immobile.**
- Deux pions qui échangent leurs croisements par le même segment se rencontrent : coupure. Par des chemins différents, ils s'échangent.

### Conflit synchronisé (défaut v0.4)
Décision de Lomig du 04/11, relayée par CDP. Formulation de CDP : « conflit synchro (conflit seulement quand deux pions adverses sont au même endroit au même pas), arrêt du perdant avant le conflit et soutien activé, tous par défaut. »
Réglages : `conflit = synchro` et `conflit_issue = arret`, codés par Dev. Les règles détaillées ci-dessous reprennent les lectures de Dev (QUESTIONS.md, section « Conflit synchro », points 1 à 11). Chaque règle est marquée **décision** quand elle vient de la formulation de CDP, et **choix proto** quand c'est une lecture de Dev que Lomig n'a pas tranchée explicitement.

1. **Le temps se compte en pas** (point 1, choix proto pour le détail).
   - Au pas k, un pion qui se déplace est en chemin[k] ; chemin[0] est son départ. Une fois arrivé, il reste sur son arrivée.
   - Une pose, ou un pion sans déplacement (il tient, soutient, ou son ordre est annulé), occupe son croisement à tous les pas, y compris le pas 0.
2. **Conflit** (**décision**) : deux pions adverses sont sur le même croisement au même pas.
   - Se croiser en sens inverse sur un même segment, entre les pas k et k+1, est aussi un conflit : c'est le **face-à-face** (point 2, choix proto).
   - Deux pions qui passent au même endroit à des pas différents n'ont **pas** de conflit.
3. **Un seul conflit par paire** : entre deux pions, seul le **premier** conflit dans le temps compte (point 2, choix proto).
4. **Force au moment de la rencontre.** On compare force(t) = 1 + les soutiens non coupés qui visent l'arrivée d'origine de t (§3), même si le trajet est arrêté plus tard (point 2).
   - Le strictement plus fort **passe**.
   - Une pose a la force 1.
5. **Le perdant s'arrête avant le conflit** (**décision**, `conflit_issue = arret`). Il s'arrête :
   - en chemin[k−1] pour un conflit sur un croisement au pas k ;
   - en chemin[k] pour un face-à-face entre les pas k et k+1 (point 3).
   Seuls les segments réellement parcourus sont colorés, et ils peuvent fermer une zone. Si aucun segment n'est parcouru, l'ordre est annulé, et le pion reste à son départ sans trace.
   - Si un pion perd plusieurs conflits, c'est l'arrêt le plus tôt qui s'applique (point 3, choix proto).
   - **Égalité entre deux déplacements** : les deux pions subissent le même sort, donc chacun s'arrête avant le conflit (description de `conflit_issue`, choix proto).
6. **On ne déloge jamais un pion immobile.** Contre un pion sans déplacement, le trajet qui arrive perd toujours, quelle que soit sa force. C'est la cause CHAINE (point 4, conforme à la règle du §1).
7. **Obstacles et recalcul** (point 4, choix proto).
   - La passe 1 se fait sur les ordres d'origine.
   - Un pion annulé (resté à son départ) ou arrêté devient alors un obstacle pour les pas suivants. On recalcule sur ce nouvel état, en boucle jusqu'à stabilité.
   - **Rien n'est repêché** : un ordre annulé ou arrêté ne revient jamais, même si sa cause disparaît.
8. **Pions amis** (point 5, choix proto).
   - Seul un pion ami déjà arrêté (immobile, arrivé, posé ou arrêté) fait obstacle, avec la cause CHAINE : le suiveur s'arrête avant lui.
   - Deux trajets amis qui se touchent restent **refusés à la saisie**, selon la géométrie (L4 a, décision de Lomig du 04/11).
9. **Poses** (point 6, choix proto). Une pose occupe son croisement dès le pas 0.
   - Un trajet adverse qui l'atteint au pas k est en conflit avec elle : on compare les forces.
   - **À égalité, le trajet perd** (il s'arrête avant), et `pose_coupante` décide du sort de la pose (défaut : annulée).
   - Une pose qui perd est annulée, puisqu'elle ne peut pas s'arrêter.
   - Deux poses adverses au même endroit : les deux sont annulées.
10. **Coupure du soutien** : inchangée (§3, S2, sur les ordres d'origine ; point 7).
11. **`depart_libere` et `annule_coupe` n'ont pas d'effet** (point 8). Le calendrier tranche seul : un départ quitté au pas 1 est libre pour la suite.
12. **Mode joueur** (`ordres = joueur`) : même règle, avec un seul ordre par joueur (point 9).
13. **Trait partagé** (**décision**, point 11) : un segment parcouru par les deux camps à des pas différents prend la couleur du **dernier passage dans le temps**. Avec `trace_adverse = garde`, c'est la première couleur qui reste.
    - Mesure de Dev après ce correctif : l'équilibre entre A et B est revenu à environ 50 % (QUESTIONS.md, point 11).

### Coupures avec `conflit = trajet` (réglage de test ; Q2 a, Q3 a, K99)
Elles se calculent **entre A et B** et **sur les ordres d'origine** : un ordre annulé ailleurs coupe quand même (choix proto ; paramètre `annule_coupe`).
1. **Trajet contre trajet** : un croisement de chemin ou un segment en commun, à n'importe quel moment. Les deux trajets sont annulés. Si `soutien = oui`, voir la section 3.
2. **Pose sur le chemin d'un trajet adverse** : le trajet est annulé, et la pose aussi par défaut (paramètre `pose_coupante`).
3. **Deux poses adverses sur le même croisement** : les deux sont annulées.

Un trajet annulé laisse le pion sur son départ, sans trace. Une pose annulée laisse le pion en réserve. Un même ordre peut être annulé par plusieurs causes, et toutes sont journalisées.

### Traces
- Un trajet réussi colore ses segments à la couleur de son joueur.
- Une trace reste visible (Q11) et ne bloque rien.
- Un segment prend la couleur du dernier joueur qui l'a parcouru (paramètre `trace_adverse`). Au même tour en synchro, c'est le dernier passage dans le temps qui colore (décision, point 11 de Dev). Un pion arrêté colore les segments qu'il a parcourus.
- Par défaut, les traces de P sont des murs pour les zones de P (paramètre `traces`).
- Deux trajets adverses réussis ne partagent jamais un segment, puisqu'ils se seraient coupés : il n'y a pas de conflit de couleur.

### Zone
- Les murs de P sont le bord (Q12 a) et les segments de la couleur de P.
- On remplit les cases en 4-connexité, sans traverser les murs de P, ce qui donne des régions.
- La région la plus grande est le **dehors** ; s'il y a égalité, toutes les plus grandes sont le dehors (choix proto). Les autres régions sont des **zones** de P : on prend la plus petite part (Q12 a).
- Règle de test `zone_regle` (défaut `actuel`, c'est-à-dire ci-dessus) : Dev a montré qu'une fermeture peut rendre son propre territoire « dehors » et prendre tout l'espace libre (QUESTIONS.md n° 7). Trois correctifs sont codés en réglage ; Lomig tranche.
- Une zone est **fermée à ce tour** si sa limite contient au moins un segment de nouveaux(P) (voir l'étape 6 et `retrace_ferme`).

### Territoire, reprise, comptage
- Chaque case a un propriétaire : personne, A ou B.
- Quand P ferme une zone, **toutes** ses cases deviennent à P, y compris celles de l'adversaire. C'est la reprise par morceaux (Q20 b ; `reprise = oui` par défaut). Avec `reprise = non`, seules les cases sans propriétaire sont prises.
- Une case gagnée au même tour par A et par B garde son propriétaire d'avant.
- Le territoire est persistant : une case reste à son propriétaire même si ses murs sont recolorés, jusqu'à ce qu'une fermeture la reprenne.
- **Score = nombre de cases possédées.** Cela remplace Q7 : on ne compte plus les croisements, et les pions ne comptent pas.
- Le paramètre `comptage` vaut **`cases`** par défaut. `frontiere` et `interieur` sont les anciens comptages en croisements (seuils de 61, 48 et 37 croisements sur 81, 64 et 49), gardés seulement pour comparer en test. Ils n'ont plus de sens dans la règle en vigueur.

### Capture
- **Par défaut, pas de capture** (`capture = aucune`). Q19 reste ouverte.
- Si on la réactive (`retour`, `sans_retour`) : on capture un pion adverse dont toutes les cases voisines sont dans une zone fermée par P à ce tour, et à P après l'attribution. Le pion retourne en réserve (`retour`) ou quitte la partie (`sans_retour`).

### Fin, victoire, départage
Seuil S = ⌈seuil × (N−1)² / 100⌉ cases. À 75 % :

| Grille | Cases | Seuil |
|---|---|---|
| 9 | 64 | **48** |
| 8 | 49 | **37** (36,75 arrondi au-dessus) |
| 7 | 36 | **27** |

Après chaque tour :
- si un seul joueur a au moins S cases, il gagne ;
- si les deux en ont au moins S, celui qui a le plus de cases gagne ; à égalité, on continue, sauf au 20e tour ;
- après le 20e tour, celui qui a le plus de cases gagne ; à égalité, la partie est nulle par défaut (paramètre `departage` ; Q18 suspendue).

## 2. Résolution d'un tour (défaut : `conflit = synchro`, `conflit_issue = arret`, `soutien = oui`)

```
1. Collecte, puis 2. Validation : comme au §2 bis (étapes 1 et 2), y compris les refus d'ordres amis à la saisie.
3. Soutiens : S1 et S2 (§3), sur les ordres d'origine ; force(t) = 1 + soutiens non coupés sur l'arrivée de t.
4. Calendrier : pos(p, k) pour k = 0 … trajet_max.
   Un trajet est en chemin[k], puis reste sur son arrivée ; une pose ou un pion sans déplacement est fixe.
5. Conflits, passe 1 sur les ordres d'origine. Pour chaque paire de pions adverses, prendre le premier conflit :
   même croisement au même pas k, ou face-à-face entre k et k+1.
   - trajet contre trajet : le strictement plus fort passe. Le perdant s'arrête en chemin[k−1]
     (croisement) ou en chemin[k] (face-à-face) ; à égalité, les deux s'arrêtent ainsi.
   - trajet contre pion sans déplacement : le trajet perd toujours.
   - trajet contre pose : le strictement plus fort passe ; à égalité, le trajet perd et pose_coupante s'applique.
     Une pose qui perd est annulée.
   - pose contre pose : les deux sont annulées.
   Arrêt sans segment parcouru → ordre annulé. Plusieurs pertes → l'arrêt le plus tôt s'applique.
   [conflit_issue = annule : le perdant est annulé au lieu de s'arrêter.]
6. Recalcul : les pions annulés ou arrêtés deviennent des obstacles (fixes) à partir de leur arrêt.
   Un pion ami arrêté fait aussi obstacle (CHAINE). Refaire l'étape 5 sur ce nouvel état
   (on ne fait qu'ajouter des pertes, rien n'est repêché), jusqu'à stabilité.
7. Exécution : segments réellement parcourus, dans l'ordre du temps.
   Un segment prend la couleur du dernier passage [trace_adverse = garde : la première couleur reste].
   nouveaux(P) comme au §2 bis, étape 6 [retrace_ferme].
8. Fermetures, attribution, captures, score et fin : §2 bis, étapes 7 à 10.
```

Garantie : à la fin, deux pions adverses ne sont jamais au même croisement au même pas. Un pion arrêté occupe son croisement d'arrêt.

## 2 bis. Résolution avec `conflit = trajet` (défaut jusqu'en v0.3.1, réglage de test)


```
ENTRÉE : état (pions, réserves, couleur des segments, propriétaire des cases, tour), ordres de A et de B.
JOURNAL : liste de (ordre, cause, ordre ou pion responsable).

1. Collecte. Pour chaque pion posé : BOUGER(t) | TENIR | SOUTENIR(c). Pour chaque joueur : au plus une POSER(c).
   Rien de validé à l'expiration → PASSER (tous les pions tiennent, pas de pose).
2. Validation [trajet_max, soutien] : un ordre invalide → TENIR ou pas de pose, journalisé « invalide ».
   POSER(c) : réserve > 0, c sans pion au début du tour.
   BOUGER(t) : 1 ≤ pas ≤ trajet_max ; pas deux fois un segment ; chemin(t) sans pion ami immobile ;
               pas de chemin ou de segment commun avec un autre trajet ami ; pas de pose amie sur chemin(t).
   SOUTENIR(c) : seulement si soutien = oui ; c voisin du pion par un segment.
   dépend(t) = pions (adverses ou amis) dont le croisement au début du tour est dans chemin(t).
3. Soutiens [soutien = oui, sinon sauter] : collecte, puis coupure (section 3, étapes S1 et S2).
4. Coupures, entre A et B, sur les ordres d'origine (ou survivants, si annule_coupe = non) :
   4a. trajet a de A contre trajet b de B, avec un point commun (croisement de chemin ou segment) :
       soutien = non → annuler a et b (cause « rencontre »).
       soutien = oui → conflit, section 3, étape S3.
   4b. POSER(c) de P contre trajet adverse t avec c ∈ chemin(t) :
       annuler t (« pose sur trajet ») ; annuler la pose si pose_coupante = annulee.
       soutien = oui → section 3, étape S3 (la pose a la force 1).
   4c. POSER(c) de A et POSER(c) de B → annuler les deux (« poses sur le même croisement »).
   réussis = ordres BOUGER et POSER non annulés.
5. Départs libérés : boucle jusqu'à stabilité.
   répéter
     pour chaque trajet t de réussis, pour chaque pion q de dépend(t) :
       si q n'a pas de BOUGER dans réussis → retirer t de réussis, journal « départ non libéré (q) ».
   jusqu'à ce que réussis ne change plus.
   (Le résultat est le plus grand ensemble stable : une rotation de pions qui partent tous réussit.
    Un ordre retiré ici ne relance pas l'étape 4 : les coupures sont déjà faites.)
6. Exécution simultanée : tous les départs sont libérés, puis toutes les arrivées et les poses ont lieu.
   Chaque segment d'un trajet réussi prend la couleur de son joueur [trace_adverse].
   nouveaux(P) = segments de P à ce tour [retrace_ferme] :
     retrace_ferme = oui (défaut en vigueur) → tous les segments parcourus par P, même déjà à sa couleur ;
     retrace_ferme = non → seulement les segments dont la couleur devient P à ce tour.
7. Fermetures de A et de B en parallèle, sur l'état d'après 6 [traces] :
   régions de P → dehors et zones ; fermées(P) = zones dont la limite touche nouveaux(P).
   gain(P) = cases de fermées(P) [reprise = oui] ou cases sans propriétaire de fermées(P) [reprise = non].
8. Attribution : case dans gain(A) et gain(B) → propriétaire inchangé ; dans gain(P) seul → P.
9. Captures [capture ; sautée si aucune].
10. Score : cases(P). Fin : section 1, « Fin, victoire, départage » [seuil, departage].
```

Garanties :
- deux trajets réussis n'ont jamais de croisement ni de segment en commun ; aucun ne passe ni ne s'arrête sur un pion resté sur place ;
- une pose réussie ne tombe jamais sur un pion ni sur le chemin d'un trajet réussi.

L'exécution n'a donc pas de conflit (mode trajet).

## 3. Réglage `soutien = non | oui` (validé par Lomig le 04/11)

But : réduire les déplacements annulés. Cette section remplace l'ancienne définition du soutien (v0.1 et v0.2). Le soutien est activé par défaut depuis la v0.4 (décision de Lomig du 04/11, relayée par CDP). Avec `soutien = non`, la règle de base s'applique sans changement.
Toutes les règles de cette section sont des décisions de Lomig du 04/11, relayées par CDP, sauf celles marquées **choix proto**.

**Règle.**
1. **Ordre.** À chaque tour, un pion posé **bouge, ou soutient** : jamais les deux. Soutenir, c'est rester immobile.
2. **Cible.** Le soutien vise un croisement x **voisin du pion**, à un pas le long d'un trait. Au doigt : on touche le pion, puis le croisement voisin. Selon ce qui se trouve en x, le soutien vaut :
   - **soutien d'un trajet**, si x est le **croisement d'arrivée** d'un trajet ami de ce tour. Soutenir l'arrivée, c'est soutenir tout le trajet.
   - **soutien en défense**, si x n'est l'arrivée d'aucun trajet ami et qu'un pion ami y reste immobile (il tient ou soutient). Voir le point 6.
   - **rien** dans tous les autres cas (croisement vide, croisement traversé seulement, arrivée d'un trajet adverse) : le soutien est sans objet, et il est journalisé « soutien sans objet ».
   - Deux trajets amis n'ont jamais la même arrivée : l'interface l'interdit (§1, ordres amis). Un soutien vise donc au plus un trajet.
3. **Force.** force(t) = 1 + le nombre de soutiens **non coupés** de son joueur qui visent l'**arrivée** de t.
   - Cette force est la même **en tout point de rencontre** du trajet : son arrivée, un croisement qu'il traverse, ou un segment.
   - On ne soutient ni un trajet adverse ni une pose : une pose a toujours la force 1.
4. **Conflit.** Quand deux ordres adverses entrent en conflit, on compare leurs forces au moment de la rencontre. En synchro (défaut), c'est le premier conflit de la paire (§1, « Conflit synchronisé ») ; en mode trajet, ce sont les étapes 4a et 4b du §2 bis.
   - Le plus fort **passe**. Le plus faible **s'arrête avant le conflit** (défaut v0.4), ou il est annulé si `conflit_issue = annule` ou en mode trajet (cause « plus faible, f contre g »).
   - À égalité entre deux déplacements, les deux s'arrêtent avant le conflit (en synchro) ou sont annulés (en mode trajet). Entre une pose et un trajet à égalité, le trajet perd, et `pose_coupante` décide du sort de la pose.
   - Un trajet qui rencontre plusieurs ordres adverses doit être strictement plus fort que **chacun** d'eux pour passer.
5. **Coupure du soutien.** Le soutien d'un pion p est **coupé** si un trajet adverse **s'arrête** sur le croisement de p. Un trajet qui ne fait que le traverser ne coupe pas.
   - Exception (comme dans Diplomacy, K222) : le soutien n'est pas coupé si ce trajet part du croisement que p soutient.
   - Le soutien est coupé **même si ce trajet échoue ensuite**. En QIDIGO, ce trajet échoue toujours : p ne part pas, et un trajet qui vise un pion immobile est annulé.
6. **Défense.** On peut soutenir un croisement où un de ses pions reste immobile.
   - Gagner un conflit, c'est seulement passer : **on ne déloge jamais un pion immobile**.
   - Ce soutien n'a donc pas d'effet en v0.3.1 : un trajet qui vise ce pion échoue de toute façon (« départ non libéré »). Il est permis et journalisé.
7. **Interface.**
   - Deux trajets amis ne se croisent pas, et ils n'ont pas la même arrivée : l'interface l'interdit.
   - Un trajet ne traverse pas un pion ami qui soutient, puisque ce pion ne bouge pas. Il peut en revanche suivre un pion ami qui part.

**Place dans la résolution.**
- **S1. Collecte**, après la validation. Pour chaque soutien, on calcule ce qu'il vise : un trajet ami, une défense, ou rien (point 2).
- **S2. Coupure** : un seul passage, **sur les ordres d'origine**, avant tout conflit.
  - Le résultat ne dépend d'aucune annulation : il n'y a pas de circularité.
  - Un soutien coupé par un trajet qui est lui-même annulé plus tard reste coupé.
- **S3. Conflits** : étapes 5 et 6 du §2 en synchro (étapes 4a et 4b du §2 bis en mode trajet), avec force(t) calculée sur les soutiens non coupés.
  - Les conflits se calculent sur les ordres d'origine, comme les coupures. Un trajet qui gagne un conflit puis qui est annulé à l'étape 5 ne rend pas la vie au perdant (choix proto, réglage `annule_coupe`).
- **Boucle jusqu'à stabilité** : étape 6 du §2 (synchro), ou étape 5 du §2 bis (mode trajet).

**Exemples** (défauts v0.4 : synchro, arrêt, soutien = oui).

*S-1. Arrivée soutenue.*
- Coups : a1 (3,1) → (3,2) ; b1 (3,3) → (3,2) ; a2, en (2,2), soutient (3,2), qui est l'arrivée de a1.
- Au pas 1, les deux pions sont en (3,2). Forces : a1 vaut 2, b1 vaut 1.
- a1 arrive. b1 devrait s'arrêter en chemin[0], mais il n'a parcouru aucun segment : son ordre est annulé et il reste en (3,3).
- Sans le soutien, c'est l'égalité : les deux sont annulés. Le résultat est le même qu'en v0.3.1.

*S-2. Soutien coupé par un trajet qui échoue.*
- Coups : ceux de S-1, plus b2 (1,2) → (2,2), qui s'arrête sur a2.
- S2 : le soutien de a2 est coupé.
- Pas 1 : a1 contre b1 à 1 contre 1, les deux sont annulés. b2 contre a2, qui est immobile : b2 perd toujours et il est annulé.
- Même résultat qu'en v0.3.1.

*S-3. Arrivée contre traversée.*
- Coups : a1 (4,3) → (4,2) ; b1 (3,2) → (4,2) → (5,2) ; a2, en (4,1), soutient (4,2).
- Au pas 1, les deux pions sont en (4,2). a1 passe (2 contre 1), et b1 est annulé, sans segment parcouru.
- Variante : b2, en (6,2), soutient (5,2). C'est alors l'égalité (2 contre 2), et les deux sont annulés. Même résultat qu'en v0.3.1.

*S-4. Pose contre trajet soutenu.*
- Coups : a1 (2,4) → (2,5) ; B pose en (2,5) ; a2, en (1,5), soutient (2,5).
- La pose occupe (2,5) dès le pas 0, et a1 l'atteint au pas 1. a1 passe (2 contre 1), et la pose est annulée.
- Sans le soutien, c'est 1 contre 1 : le trajet perd et il est annulé (aucun segment). La pose est annulée avec `pose_coupante = annulee` ; elle a lieu avec `maintenue`.

*S-5. Rencontre au milieu d'un trajet soutenu par son arrivée.*
- Coups : a1 (2,3) → (3,3) → (4,3) ; b1 (3,2) → (3,3) → (3,4) ; a2, en (5,3), soutient (4,3).
- Au pas 1, les deux pions sont en (3,3). a1 passe (2 contre 1) et arrive en (4,3). b1 est annulé, sans segment parcouru.
- **Décalage d'un pas** : b1 part de (3,1) et fait (3,1) → (3,2) → (3,3) → (3,4).
  - Au pas 1, a1 est en (3,3) et b1 en (3,2). Au pas 2, a1 est en (4,3) et b1 en (3,3).
  - Il n'y a **aucun conflit** : les deux réussissent. En mode trajet, ils se seraient rencontrés en (3,3).

*S-6. Arrêt avant le conflit.*
- Coups : a1 (4,3) → (4,2) ; b1 (2,2) → (3,2) → (4,2) → (5,2) ; a2, en (4,1), soutient (4,2).
- Au pas 1, a1 arrive en (4,2) et b1 est en (3,2). Au pas 2, b1 atteint (4,2), où se trouve a1.
- a1 est un pion arrivé, pas un pion sans déplacement. On compare donc les forces (point 3 de Dev) : a1 vaut 2, b1 vaut 1, et b1 perd.
- b1 **s'arrête en (3,2)**, chemin[1]. Il colore le segment (2,2)-(3,2), qui peut fermer une zone.

## 4. Paramètres

La valeur par défaut est en gras.

| Paramètre | Valeurs | Source du défaut | Étape |
|---|---|---|---|
| `grille` | 7, 8, **9** | BRIEF ; Lomig ne veut pas exclure 7 ni 8 | init. |
| `capture` | **`aucune`**, `retour`, `sans_retour` | choix de CDP ; Q19 ouverte | 9 |
| `trajet_max` | 3, **5**, `illimite` | Q22 (5 pas) | 2 |
| `conflit` | `trajet`, **`synchro`** | décision de Lomig du 04/11, relayée par CDP | 4–6 |
| `conflit_issue` | `annule`, **`arret`** | décision de Lomig du 04/11, relayée par CDP (« arrêt du perdant avant le conflit ») ; sans effet en mode trajet | 5 |
| `soutien` | `non`, **`oui`** | décision de Lomig du 04/11, relayée par CDP (section 3) | 3, 5 |
| `traces` | **`bord_de_zone`**, `decoratives` | choix proto (Q11 laisse le choix ouvert) | 7 |
| `reprise` | `non`, **`oui`** | Q20 b | 7 |
| `seuil` | pourcentage, **75** | Lomig ; en cases : 48, 37 et 27 cases sur 64, 49 et 36 | 10 |
| `pose_coupante` | **`annulee`**, `maintenue` | choix proto (BRIEF : l'ordre adverse est annulé) | 4b |
| `trace_adverse` | **`recolore`**, `garde` | choix proto | 6 |
| `retrace_ferme` | `non`, **`oui`** | en vigueur : `oui` (Dev, validé à titre provisoire par CDP) ; je recommande de tester `non` | 6 |
| `departage` | **`cases_puis_nul`** (= nul en cases), `traces` | en vigueur ; `traces` proposé (question b de Dev ; Q18 suspendue) | 10 |
| `ordres` | `joueur`, **`pion`** | Lomig, 04/11 | 1, 2 |
| `poses_par_tour` | **1**, `illimite` | Lomig, 04/11 | 2 |
| `depart_libere` | **`traversee`**, `arrivee_seule` | Lomig (confirmé) ; sans effet en synchro | 2 bis |
| `comptage` | **`cases`**, `frontiere`, `interieur` | Lomig (cases) ; les deux autres pour test | 10 |
| `zone_regle` | **`actuel`**, `sans_pion_adverse`, `dehors_non_possede`, `moitie_libre` | codé par Dev à la demande de CDP (défaut de la règle du dehors, QUESTIONS.md n° 7) ; Lomig tranche | 7 |
| `reprise_meme_tour` | **`defense`**, `attaque` | choix proto codé par Dev (lecture littérale de l'étape 8) | 8 |
| `repasser_croisement` | **`oui`**, `non` | choix proto | 2 |
| `territoire_acquis` | **`acquis`**, `murs` (proposé) | choix proto | 8 |
| `annule_coupe` | **`oui`**, `non` | choix proto ; sans effet en synchro | 2 bis |

Valeurs à préciser :
- `departage = traces` : à égalité de cases, gagne le joueur qui a le plus de segments à sa couleur ; à nouvelle égalité, nul.
- `annule_coupe = non` : les coupures et les conflits ne se calculent qu'entre ordres encore réussis. Dans ce cas, refaire les étapes 4 et 5 en boucle jusqu'à stabilité. Cela peut réduire les annulations : à tester.
- `territoire_acquis = murs` (proposé) : une case possédée redevient sans propriétaire si un de ses côtés qui était un mur de son propriétaire est recoloré par l'adversaire. Cela rend la défense active (C37 du C-K) et peut débloquer des parties figées.
- `retrace_ferme = non` : seuls les segments qui deviennent de la couleur de P à ce tour comptent pour fermer.

## 5. Cas limites

- **Synchro, même endroit mais à des pas différents** : il n'y a pas de conflit (exemple S-5, avec le décalage).
- **Synchro, face-à-face sur un segment** : c'est un conflit. Le perdant s'arrête au croisement d'où il entrait sur ce segment.
- **Synchro, trait partagé à des pas différents** : il prend la couleur du dernier passage (exemple 8).

- **Pose sur un croisement occupé** : refusée, même si le pion part (Lomig, 03/11).
- **Trajet sur un pion adverse qui part** : il réussit, en passage comme en arrivée. Si le pion ne part pas, le trajet est annulé.
- **Rotation** : trois pions qui partent chacun vers le départ d'un autre, sans point commun, réussissent tous.
- **Chaîne d'annulations** : si un trajet est coupé, ceux qui dépendaient de son départ tombent un par un. L'étape 5 boucle jusqu'à stabilité.
- **Fermetures simultanées** : A et B ferment en parallèle. Une case gagnée par les deux garde son propriétaire d'avant.
- **Zone fermée par des murs mêlés** : chaque joueur ne voit que ses propres murs.
- **Reprise** : fermer une zone qui couvre des cases adverses les prend (Q20 b).

## 6. Exemples

Notation : `o` croisement vide ; `A` / `b` pions ; `═` `║` traces de A ; `─` trajet de B.

**1. Boucle avec deux bords.**
- Le pion A va de (2,0) à (0,2) par (2,1), (2,2) et (1,2).
- Les cases (0,0), (1,0), (0,1) et (1,1) forment une zone de 4 cases ; le dehors en a 60. **A possède 4 cases.**
- Le pion b en (1,1) reste par défaut. Avec `capture = retour`, il retourne en réserve.

```
     x=0   1   2   3
y=0    o   o   o   o
               ║
y=1    o   b   o   o
               ║
y=2    A═══o═══o   o
```

**2. Fermeture en deux tours, sur sa trace.**
- Tour t : (4,4) → (5,4) → (5,5). Tour t+1 : (5,5) → (4,5) → (4,4).
- Au tour t+1, les segments (5,5)-(4,5) et (4,5)-(4,4) sont nouveaux : la case (4,4) est fermée et **A possède 1 case**.

```
     x=4   5
y=4    o═══o
       ║   ║
y=5    o═══A
```

**3. Rencontre (K99).**
- Coups : A (3,1) → (3,2) → (3,3) ; B (4,2) → (3,2) → (2,2).
- Synchro (défaut) : au pas 1, les deux pions sont en (3,2). Sans soutien, c'est 1 contre 1 : chacun s'arrête en chemin[0], sans segment parcouru. Les deux sont donc annulés, sans trace.
- Même résultat pour deux pions qui se croisent en sens inverse sur un segment, entre les pas 0 et 1 (face-à-face).
- Si B partait de (5,2), par (4,2), (3,2) puis (2,2) : B est en (3,2) au pas 2, mais A en est parti au pas 2. Il n'y a pas de conflit, et les deux réussissent. Le mode trajet les aurait annulés.

```
     x=2   3   4
y=1    o   A   o
           ║
y=2    o───X───b      X = rencontre
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
**5. Départ libéré : traversée** (Lomig : confirmé). A est en (2,2), b en (3,2).
- Coups : A (2,2) → (2,3) ; B (3,2) → (2,2) → (1,2), qui **traverse** le départ de A.
- Synchro : au pas 1, A est en (2,3) et b en (2,2), que A vient de quitter. Il n'y a pas de conflit : **les deux réussissent**. A arrive en (2,3), b en (1,2).
- Si A avait tenu, b l'aurait atteint au pas 1 contre un pion immobile. b perd toujours : il est annulé, sans segment parcouru.
- Si A avait joué (2,2) → (3,2), ce serait un face-à-face sur le même segment entre les pas 0 et 1. À 1 contre 1, les deux sont annulés.

```
     x=1   2   3
y=2    o───A───b      b traverse (2,2), que A quitte
           ║
y=3    o   o   o      A descend en (2,3)
```

**6. Chaîne d'annulations (ordres par pion, boucle).** a1 est en (2,2), b1 en (3,2), a2 en (4,2).
- Coups : a1 (2,2) → (2,3) ; b1 (3,2) → (2,2) ; a2 (4,2) → (3,2) ; B pose en (2,3).
- Synchro, passe 1 : la pose occupe (2,3) dès le pas 0. a1 l'atteint au pas 1 ; à 1 contre 1, le trajet perd. a1 est annulé, sans segment, et la pose aussi (`pose_coupante = annulee`).
- Recalcul 1 : a1 reste en (2,2). b1 l'atteint au pas 1 contre un pion immobile : b1 est annulé.
- Recalcul 2 : b1 reste en (3,2). a2 l'atteint au pas 1 : a2 est annulé.
- Recalcul 3 : rien ne change. Le résultat est le même qu'en mode trajet.
- Journal :
  - a1 : pose sur trajet (pose de B) ;
  - pose de B : pose sur trajet (a1) ;
  - b1 : départ non libéré (a1) ;
  - a2 : départ non libéré (b1).

**7. Synchro : trajets qui se suivent sans se rencontrer.**
- Coups : a1 (2,2) → (3,2) → (3,3) ; b1 (1,2) → (2,2) → (3,2) → (4,2).
- Pas 1 : a1 est en (3,2), b1 en (2,2), que a1 a quitté. Pas 2 : a1 est en (3,3), b1 en (3,2). Pas 3 : b1 est en (4,2). Il n'y a aucun conflit.

**8. Trait partagé : le dernier passage colore** (décision, point 11 de Dev). Mêmes coups qu'à l'exemple 7.
- Le segment (2,2)-(3,2) est parcouru par a1 entre les pas 0 et 1, puis par b1 entre les pas 1 et 2. Il prend la couleur de **B**.
- Avec `trace_adverse = garde`, il reste à A.
