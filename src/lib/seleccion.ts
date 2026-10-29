import { PREGUNTAS_POR_TEST } from './config';
import { nivelDe, type Progreso } from './progreso';
import { mezclarConSemilla } from './rng';
import type { Modo, Nivel, PreguntaCliente } from './types';

/** Qué niveles admite cada modo. `undefined` = pregunta nunca realizada. */
const ADMITE: Record<Modo, (nivel: Nivel | undefined) => boolean> = {
  repaso: (n) => n === 'medio' || n === 'dificil',
  dificil: (n) => n === 'dificil',
};

export type Seleccion =
  | { ok: true; preguntas: PreguntaCliente[]; disponibles: number; advertencia?: string }
  | { ok: false; disponibles: number; necesarias: number };

/**
 * Elige 30 preguntas al azar para el modo indicado.
 * Permite tests con menos de 30 preguntas pero muestra advertencia.
 */
export function seleccionarPreguntas(
  todas: readonly PreguntaCliente[],
  progreso: Progreso,
  modo: Modo
): Seleccion {
  // Se filtra sobre las preguntas reales, así que los IDs
  // obsoletos de las cookies se ignoran solos.
  const candidatas = todas.filter((p) => ADMITE[modo](nivelDe(p.id, progreso)));

  if (candidatas.length === 0) {
    return { ok: false, disponibles: 0, necesarias: PREGUNTAS_POR_TEST };
  }

  if (candidatas.length < PREGUNTAS_POR_TEST) {
    // Permitir test parcial con advertencia
    const semilla = Math.floor(Math.random() * 0xffffffff);
    const falta = PREGUNTAS_POR_TEST - candidatas.length;
    return {
      ok: true,
      disponibles: candidatas.length,
      preguntas: mezclarConSemilla(candidatas, semilla),
      advertencia: `Solo tienes ${candidatas.length} preguntas disponibles. Haz más tests para acumular más fallos y completar las ${PREGUNTAS_POR_TEST} preguntas.`,
    };
  }

  const semilla = Math.floor(Math.random() * 0xffffffff);
  return {
    ok: true,
    disponibles: candidatas.length,
    preguntas: mezclarConSemilla(candidatas, semilla).slice(0, PREGUNTAS_POR_TEST),
  };
}

/** Recuento exacto, ignorando IDs de cookies que ya no existen en el JSON. */
export function resumenProgreso(idsValidos: Iterable<string>, progreso: Progreso) {
  const resumen = { facil: 0, medio: 0, dificil: 0, sinHacer: 0 };
  for (const id of idsValidos) {
    const nivel = nivelDe(id, progreso);
    if (nivel) resumen[nivel]++;
    else resumen.sinHacer++;
  }
  return resumen;
}

/** Texto del aviso cuando no hay 30 preguntas para el modo. */
export function avisoInsuficiente(modo: Modo, disponibles: number) {
  const falta = PREGUNTAS_POR_TEST - disponibles;

  const que = modo === 'repaso' ? 'medias o difíciles' : 'difíciles';
  return {
    titulo: 'Todavía no hay suficientes preguntas para este test',
    texto: `Tienes ${disponibles} preguntas ${que} y se necesitan ${PREGUNTAS_POR_TEST} (te faltan ${falta}). Haz más tests numerados: cada pregunta que falles se acumulará aquí para repasarla.`,
  };
}
