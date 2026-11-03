// Générateur pseudo-aléatoire à graine (mulberry32).
// Pur et déterministe : même graine => même suite. Sert à l'IA et aux tests.

/**
 * Crée un générateur. L'objet retourné a un état interne mutable,
 * mais il n'est jamais stocké dans l'état de partie.
 * @param {number} graine entier 32 bits
 */
export function creerRng(graine) {
  let a = (graine >>> 0) || 0x9e3779b9;
  const suivant = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Réel dans [0, 1). */
    reel: suivant,
    /** Entier dans [0, n). */
    entier: (n) => Math.floor(suivant() * n),
    /** Élément au hasard d'un tableau (undefined si vide). */
    choisir: (tab) => (tab.length ? tab[Math.floor(suivant() * tab.length)] : undefined),
    /** Copie mélangée (Fisher-Yates). */
    melanger: (tab) => {
      const c = tab.slice();
      for (let i = c.length - 1; i > 0; i--) {
        const j = Math.floor(suivant() * (i + 1));
        [c[i], c[j]] = [c[j], c[i]];
      }
      return c;
    },
  };
}

/** Graine aléatoire (hors moteur pur : à n'appeler que depuis l'UI). */
export function graineAleatoire() {
  return (Math.random() * 4294967296) >>> 0;
}
