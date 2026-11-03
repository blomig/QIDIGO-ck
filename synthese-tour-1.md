# QIDIGO — synthèse du tour 1 du C-K (03/11/2026)

Tout est PISTE : rien n'est une règle tant que DOCS/RULES.md n'existe pas (AGENTS.md). Les décisions de Lomig iront dans DOCS/DECISIONS.md (CDP).

## Chiffres

- 166 K : 92 reprises du Jeu du siècle (chacune avec sa K d'origine et sa section de la base-K du JdS) et 74 propres à QIDIGO : 12 du dépôt (BRIEF, DECISIONS, AGENTS), 3 de Lomig relayées par CDP (captures, fin de partie, constat « compliqué et lent »), 4 tirées des règles du JdS, 46 externes à URL vérifiée, 9 déductions (K→K). Robustesse : 154 sûres, 11 à creuser, 1 évoquée.
- 60 C, dont 20 recommandées (★), réparties en 15 partitions directement sous le C0 (24 partitions en tout).
- 188 opérateurs : 9 K→K, 59 C→C, 60 K→C, 60 C→K.

## C0

> Duel classé 1 contre 1 pour iPhone (portrait), freemium sans pub, sur les 81 croisements d'une grille de traits 9×9 : chaque joueur a X pions ; à chaque tour, les deux joueurs donnent un ordre résolu en même temps — poser un pion, ou déplacer un pion par un trajet dessiné ; un trajet coupé par un ordre adverse annule les deux déplacements ; les pions peuvent être capturés et retournent alors dans la réserve de leur propriétaire ; on gagne du terrain, et la partie finit après un nombre de tours ou au-delà d'un seuil de possession (forme ouverte) ; simple, rapide, profond.

Le secret des ordres n'est pas dans le C0 : le BRIEF le laisse ouvert (« ordres simultanés en secret ? »). C'est la branche C14.

Verdict : le C0 tient comme chapeau, mais il ne décrit pas encore un jeu jouable. Trois trous structurent tout le reste : ce qu'est posséder, ce qu'est couper, et comment on capture.

## Les 5 branches les plus prometteuses

1. **C2 + C2b + C2c : le terrain se prend en fermant des zones par ses trajets, qui restent peints ; un pion adverse enfermé est capturé (C8c).** Un seul geste sert au terrain et à la capture. C'est le « Qix » du pitch, avec un précédent de capture par zone fermée (Volfied, Dots).
2. **C6 + C6a + C6c : deux trajets se coupent s'ils passent par un même croisement ou un même segment ; une pose sur un trajet adverse le coupe aussi.** La règle tient en une ligne, et la pose devient une arme contre le déplacement.
3. **C11b + C11c + C11e : la partie finit au premier des deux, N tours ou 75 % de l'aire.** 75 % de 81 croisements, c'est 61 croisements, valeur de Qix, à tester. À la limite de tours, la plus grande possession gagne, et l'égalité donne un nul.
4. **C10a + C10d : un pion capturé ne se rejoue qu'après un tour de délai, et c'est la limite de tours qui garantit la fin.** C'est le précédent du backgammon et des petits chevaux. Pas de superko à gérer.
5. **C16 + C14 : on donne un ordre en touchant le pion puis l'arrivée, avec un trajet proposé et ajustable.** Les ordres sont secrets, avec un chrono court et un bouton « Prêt ».

## Tensions

- **T-BLOCAGE** : si toute coupure annule les deux ordres, le joueur en tête peut figer la partie. Les go simultanés ont connu des amas d'annulations (K161, K144).
- **T-POSE** : poser semble dominer déplacer (K151, opinion de joueurs). Le retour en réserve remplit la réserve à chaque capture.
- **T-SIMPLE** : on mélange trois systèmes (Go, Qix, Diplomacy), alors que la leçon du JdS est « compliqué et lent » (K107).
- **T-DUREE** : voir le tableau des durées plus bas.
- **T-ECRAN** : 393 pt / 9 ≈ 43,7 pt par croisement, sous les 44 pt recommandés (K158).
- **T-SIMUL** : le simultané pose des cas ambigus : captures mutuelles, suicide, seuil franchi par les deux joueurs au même tour.
- **T-BOUCLE** : avec le retour en réserve, le matériel ne diminue jamais. Des positions peuvent se répéter, et un seuil seul ne garantit pas la fin (K160).
- **T-NUL** : sans premier coup, pas besoin de komi, mais un comptage sur 81 croisements donne des égalités.
- **T-DEJAVU** : chaque morceau existe déjà ailleurs.
- **T-BRIEF** : C7c, C7d et C8e s'écartent du point 7 du BRIEF.

## Captures (demande de Lomig du 03/11, 7 h 04)

- Pistes de capture :
  - C8 : par libertés, à la Go. Sous-branche C8a pour les groupes, C8b pour le pion seul.
  - C8c : par fermeture d'une zone par ses trajets.
  - C8d : en tenaille (Hasami shogi).
  - C8e : par interception d'un trajet.
  - C8f : par supériorité numérique (Diplomacy).
- Résolution dans un tour simultané :
  - C9 : on fait tous les mouvements, puis toutes les captures ensemble ; les captures mutuelles sont possibles.
  - C9a : ordre fixe, d'abord les anciens groupes puis les nouveaux (Diplomatic Go).
  - C9b : un pion qui quitte un encerclement pendant le tour s'en échappe.
  - C9c : les captures se jugent sur la position du début du tour (F-Go).
  - C9d : suicide interdit. Mais en simultané, on ne peut pas le vérifier au moment de la saisie.
- Effet sur le terrain : avec C2c, la zone fermée est prise et le pion adverse qu'elle contient retourne dans sa réserve. Avec C2d, la présence d'un pion adverse empêche de fermer la zone.
- Réserve : X = 5 (C12) ou 8 (C12a). Avec le retour en réserve, elle se remplit à chaque capture.
- Boucles et fin :
  - au go, on trouve le ko simple, le superko positionnel ou situationnel, et le triple ko qui donne « pas de résultat » sans superko (K121, Rules of Go) ;
  - les règles Ing rendent déjà les prisonniers à leur propriétaire ;
  - Diplomatic Go finit sur une position répétée trois fois.
- Pistes anti-boucle :
  - C10 : rejouable tout de suite ;
  - C10a : délai avant de rejouer ;
  - C10b : superko ;
  - C10c : chaque capture rapporte un point ;
  - C10d : seule la limite de tours garantit la fin.

## Fin de partie (demande de Lomig du 03/11, 7 h 06)

- Repères géométriques (sûrs) : 81 croisements, 64 cases, 144 segments. 75 % représentent 61 croisements ou 48 cases.
- Seuils sourcés : Qix 75 %, Super Qix 70 %, Volfied 80 %.
- Compter seulement les croisements occupés ne marche pas : avec 8 pions, on plafonne à 9,9 % (K159).
- Variantes de critère :
  - C11 : N tours seulement ;
  - C11a : seuil seul, à écarter puisqu'il ne garantit pas la fin ;
  - C11b : au premier des deux.
- Variantes de seuil : fixe (C11c) ou dégressif (C11d).
- Gagnant et cas particuliers :
  - C11e : à la limite de tours, la plus grande possession gagne ; à égalité, nul ;
  - C11f : départage par le nombre de captures ;
  - C11g : si les deux joueurs franchissent le seuil au même tour, le plus haut gagne ; à égalité exacte, on continue ;
  - C11h : fin quand les deux joueurs passent.
- Repère de durée au go 9×9 (à creuser) : environ 58 coups jusqu'au décompte (forum OGS), soit environ 29 coups par joueur ; 10 à 30 minutes selon les sources.

### Durée maximale d'une partie = tours × (chrono + 5 s de résolution)

Les 5 s de résolution et d'animation reprennent la valeur du JdS. C'est une hypothèse à mesurer. Le bouton « Prêt » raccourcit la partie réelle.

| Tours \ chrono | 10 s | 15 s | 20 s | 30 s |
|---|---|---|---|---|
| 10 | 2 min 30 s | 3 min 20 s | 4 min 10 s | 5 min 50 s |
| 15 | 3 min 45 s | 5 min 00 s | 6 min 15 s | 8 min 45 s |
| 20 | 5 min 00 s | 6 min 40 s | 8 min 20 s | 11 min 40 s |
| 30 | 7 min 30 s | 10 min 00 s | 12 min 30 s | 17 min 30 s |

Points de comparaison :
- JdS : 15 tours × 30 s, soit 8 min 45 s au plus, pour un jeu que Lomig juge « compliqué et lent » (K107) ;
- Clash Royale : 3 min, plus jusqu'à 2 min de prolongation (K47, K166) ;
- Hearthstone : 7 à 10 min (K48).

PROPOSITION à tester : 15 à 20 tours de 15 s, soit 5 min à 6 min 40 s au plus.

## Déjà-vu (« c'est important »)

- **Go simultané** : F-Go, Simultaneous Go (fuseki.net), Diplomatic Go (OGS, 9×9), SAS Go, go multijoueur parallèle. Le point de collision y devient interdit, ou personne ne joue.
- **Go à déplacement** : Sliding Go (la pose se fait par un glissement le long des lignes, c'est le plus proche du trajet), Slidey Go.
- **Retour des prisonniers à leur propriétaire** : règles Ing.
- **Simultané sur grille** :
  - XYMYX ;
  - Grid Kings (iOS, duel simultané) ;
  - Grid Domination (iOS, à creuser) ;
  - AtCoder AHC061 (2026).
- **Territoire** :
  - Territory Game (Yorimichi) ;
  - Dots / Kropki ;
  - Paper.io 2 ;
  - Qix et ses clones (Xonix, JezzBall, Volfied) ;
  - TwixT ;
  - Amazones ;
  - À travers le désert.
- **Capture** : Hasami shogi, Othello, jeu du moulin.
- **Combinaison non trouvée** (c'est une absence de résultat, pas une preuve d'originalité) : un trajet dessiné qui annule les deux ordres quand il est coupé, un terrain pris par fermeture à la Qix, et une réserve limitée où reviennent les pions capturés, le tout en duel simultané sur mobile.

## Écarts entre le dépôt et ce C-K

1. Le BRIEF laisse ouverts le chrono et le secret des ordres ; le JdS les avait tranchés (30 s, ordres secrets). Ici, ils restent des C (C14), pas des K de décision.
2. AGENTS.md demande de ne copier ni palette ni code des autres jeux. Or `ck.html` dérive de l'outil C-K du JdS. La palette et le code de la page ont été réécrits, mais la structure (arbre, fiche, base K) est la même.
3. AGENTS.md dit « pas une ligne de code » avant la maquette. Le générateur (Python) reste donc hors de CK/ et n'est pas destiné au dépôt. `ck.html` contient lui-même du JavaScript : c'est un outil de travail, pas le jeu.
4. Le vocabulaire est celui du dépôt : pion, trajet, croisement (et non pierre ni chemin).
5. CK/README.md devait citer le C0, la base K et ck.html. Ce C-K ajoute arbre-C.md, operateurs.md, questions-lomig.md et cette synthèse.
6. Les décisions de Lomig (captures, fin) viennent de CDP et ne sont pas encore dans DOCS/DECISIONS.md. C'est à CDP de les y inscrire.
7. Trois branches s'écartent du point 7 du BRIEF (C7c, C7d, C8e). Elles sont marquées T-BRIEF.
