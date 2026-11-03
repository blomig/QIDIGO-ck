# QIDIGO : prototype web jouable

Prototype pour tester les règles de **regles-proto.md (v0.2)** et les choix du CDP (03/11).
Il s'agit de HTML, CSS et JS « vanilla » en modules ES : pas de dépendance ni d'étape de build.
Les chemins sont tous relatifs, ce qui permet de le servir sous `/QIDIGO-ck/proto/` sur GitHub Pages.
Il est pensé pour Safari iPhone en portrait.

## Lancer

```sh
cd proto
python3 -m http.server 8000      # puis http://localhost:8000/ (ou l'IP locale depuis l'iPhone)
node --test                      # tests du moteur (Node ≥ 20 ; ne pas passer « tests/ » en argument)
```

## Jouer

- **Poser** : touchez un croisement libre (ou un pion adverse : ordre conditionnel).
- **Déplacer** : glissez depuis un de vos pions le long des traits. Revenir en arrière efface le dernier segment.
  Le trait se colle aux croisements (avec une loupe sous le doigt).
- **Prêt** valide l'ordre. **Effacer** l'efface. Sans ordre, ce bouton devient **Passer**.
  Si le chrono expire, l'ordre en cours est envoyé s'il est valide, sinon « Passer ».
- **Soutien** (variante) : pendant un déplacement, touchez un de vos pions voisin du départ.
- Pendant votre saisie, **l'aperçu** montre en pointillé la zone fermée et le gain prévu, en supposant que l'autre passe.
- **Modes** : contre l'IA (vous êtes A, noir) ou à deux sur le même téléphone. Dans ce mode, un écran de passage masque l'ordre de l'autre.
- **Réglages** : chaque variante et chaque choix proto, avec sa description, son état et sa valeur par défaut.
  Les réglages s'appliquent à la partie suivante (**Rejouer**) et sont gardés dans `localStorage`.
- **Journal** : tous les tours, avec chaque annulation et sa cause.

## Structure

```
index.html, style.css        page et mise en page (style.css s'appuie sur les jetons --q-*)
design/                      fourni par le designer, NON modifié (tokens.css, composants.css, plateau.js…)
engine/                      moteur PUR (aucun accès au DOM, aucune dépendance à design/)
  params.js                  réglages : descripteurs (libellé, description, défaut) et normalisation
  grille.js                  croisements, segments, cases
  etat.js                    état immuable
  ordres.js                  ordres poser / deplacer / passer / rien et validation
  resolution.js              résolution d'un tour (étapes 1 à 9 de regles-proto.md) et journal
  rng.js                     hasard à graine (mulberry32)
ai/ia-faible.js              IA au hasard, toujours légale
ui/app.js                    boucle de jeu, chrono, modes, compteurs
ui/plateau.js                saisie tactile et options pour design/plateau.js (plateauSVG)
ui/reglages.js               panneau Réglages
ui/journal.js                journal
tests/                       node --test (exemples de regles-proto.md, décisions du CDP, Passer, décompte…)
QUESTIONS.md                 points encore ouverts
```

## Où brancher

- **Règles** : `engine/params.js` (réglages, avec leurs défauts et descriptions) et `engine/resolution.js`.
  Le code de chaque étape cite son numéro dans regles-proto.md. Les choix du CDP sont marqués
  `// choix proto (CDP 03/11)` et les points ouverts `// A CONFIRMER (regles-proto.md)`.
- **Design** : `design/tokens.css` (piste A « Goban », seul thème retenu par Lomig),
  `design/composants.css` et `design/plateau.js`, utilisés tels quels.
  `ui/plateau.js` traduit l'état du moteur en options pour `plateauSVG`.
