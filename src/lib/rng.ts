/** PRNG determinista (mulberry32): misma semilla, misma secuencia. */
export function mulberry32(semilla: number) {
  return function () {
    let t = (semilla += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates con semilla. No modifica el array original. */
export function mezclarConSemilla<T>(items: readonly T[], semilla: number): T[] {
  const azar = mulberry32(semilla);
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
