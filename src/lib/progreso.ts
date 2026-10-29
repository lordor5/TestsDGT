import type { Nivel } from './types';

const COOKIES: Record<Nivel, string> = {
  facil: 'dgt_faciles',
  medio: 'dgt_medias',
  dificil: 'dgt_dificiles',
};

const COOKIE_FALLOS = 'dgt_fallos';

const DOS_ANYOS = 60 * 60 * 24 * 365 * 2;

export type Progreso = Record<Nivel, Set<string>>;

/* ---------- Codificación compacta: "224:3k9x1|225:7" ----------
   Por cada test guardamos una máscara de bits (pregunta n = bit n-1) en base 36. */

function codificar(ids: Iterable<string>): string {
  const porTest = new Map<string, bigint>();
  for (const id of ids) {
    const [test, num] = id.split('-');
    const bit = 1n << BigInt(Number(num) - 1);
    porTest.set(test, (porTest.get(test) ?? 0n) | bit);
  }
  return [...porTest]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([test, mascara]) => `${test}:${mascara.toString(36)}`)
    .join('|');
}

function decodificar(valor: string): Set<string> {
  const ids = new Set<string>();
  if (!valor) return ids;
  for (const bloque of valor.split('|')) {
    const [test, texto] = bloque.split(':');
    if (!test || !texto) continue;
    let mascara = 0n;
    for (const caracter of texto) {
      mascara = mascara * 36n + BigInt(parseInt(caracter, 36));
    }
    for (let i = 0; mascara > 0n; i++, mascara >>= 1n) {
      if (mascara & 1n) ids.add(`${test}-${i + 1}`);
    }
  }
  return ids;
}

/* ---------- Capa de almacenamiento (aquí se cambiaría a localStorage) ---------- */

function leer(nombre: string): string {
  const cookie = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`));
  return cookie ? cookie.slice(nombre.length + 1) : '';
}

function escribir(nombre: string, valor: string): void {
  document.cookie = `${nombre}=${valor}; max-age=${DOS_ANYOS}; path=/; SameSite=Lax`;
}

/* ---------- API pública ---------- */

export function cargarProgreso(): Progreso {
  return {
    facil: decodificar(leer(COOKIES.facil)),
    medio: decodificar(leer(COOKIES.medio)),
    dificil: decodificar(leer(COOKIES.dificil)),
  };
}

export function guardarProgreso(progreso: Progreso): void {
  (Object.keys(COOKIES) as Nivel[]).forEach((nivel) =>
    escribir(COOKIES[nivel], codificar(progreso[nivel]))
  );
}

export function nivelDe(id: string, progreso: Progreso): Nivel | undefined {
  if (progreso.dificil.has(id)) return 'dificil';
  if (progreso.medio.has(id)) return 'medio';
  if (progreso.facil.has(id)) return 'facil';
  return undefined;
}

export function haSidoRealizada(id: string, progreso: Progreso): boolean {
  return nivelDe(id, progreso) !== undefined;
}

/** Máquina de estados: a qué nivel pasa una pregunta tras responderla. */
export function siguienteNivel(actual: Nivel | undefined, acierto: boolean): Nivel {
  if (!acierto) return 'dificil';
  if (actual === 'dificil') return 'medio';
  return 'facil'; // nueva, media o fácil acertada
}

export interface Resultado {
  id: string;
  acierto: boolean;
}

/** Aplica todos los resultados de un test y guarda las cookies una sola vez. */
export function registrarResultados(resultados: Resultado[]): Progreso {
  const progreso = cargarProgreso();

  for (const { id, acierto } of resultados) {
    const nuevo = siguienteNivel(nivelDe(id, progreso), acierto);
    progreso.facil.delete(id);
    progreso.medio.delete(id);
    progreso.dificil.delete(id);
    progreso[nuevo].add(id);
  }

  guardarProgreso(progreso);
  return progreso;
}

/** Cuenta el número de fallos (medio + dificil) para un conjunto de IDs. */
export function contarFallos(ids: string[], progreso: Progreso): number {
  let fallos = 0;
  for (const id of ids) {
    const nivel = nivelDe(id, progreso);
    if (nivel === 'medio' || nivel === 'dificil') fallos++;
  }
  return fallos;
}

/** Cuenta el total de fallos (medio + dificil) en todo el progreso. */
export function contarFallosTotales(progreso: Progreso): number {
  return progreso.medio.size + progreso.dificil.size;
}
