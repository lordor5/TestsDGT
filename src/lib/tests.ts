import { getCollection } from 'astro:content';
import { mezclarConSemilla } from './rng';
import type { PreguntaCliente, PreguntaDGT, TestGenerado } from './types';

import { PREGUNTAS_POR_TEST, TESTS_POR_BLOQUE } from './config';
const TAMANO_BLOQUE = PREGUNTAS_POR_TEST * TESTS_POR_BLOQUE;

/** Cambiarla altera TODOS los tests numerados. No la toques una vez publicado. */
const SEMILLA_GLOBAL = 20260101;

let cachePreguntas: Promise<PreguntaDGT[]> | undefined;

/** Todas las preguntas del JSON, aplanadas y en orden estable. */
export function getTodasLasPreguntas(): Promise<PreguntaDGT[]> {
  cachePreguntas ??= getCollection('tests').then((tests) =>
    tests
      .flatMap(({ data }) =>
        data.preguntas.map((p) => ({
          ...p,
          id: `${data.test}-${p.numero}`,
          test: data.test,
        }))
      )
      .sort((a, b) => a.test - b.test || a.numero - b.numero)
  );
  return cachePreguntas;
}

/**
 * Tests numerados (1..N). Cada bloque de 150 preguntas se mezcla con su
 * propia semilla, así que añadir preguntas al final del JSON no altera
 * los tests ya existentes. El último test siempre tiene 30 preguntas,
 * repitiendo algunas si es necesario.
 */
export async function getTestsGenerados(): Promise<TestGenerado[]> {
  const todas = await getTodasLasPreguntas();
  const bloquesCompletos = Math.floor(todas.length / TAMANO_BLOQUE);
  const tests: TestGenerado[] = [];

  for (let b = 0; b < bloquesCompletos; b++) {
    const bloque = mezclarConSemilla(
      todas.slice(b * TAMANO_BLOQUE, (b + 1) * TAMANO_BLOQUE),
      SEMILLA_GLOBAL + b
    );
    for (let i = 0; i < TESTS_POR_BLOQUE; i++) {
      tests.push({
        numero: b * TESTS_POR_BLOQUE + i + 1,
        preguntas: bloque.slice(i * PREGUNTAS_POR_TEST, (i + 1) * PREGUNTAS_POR_TEST),
      });
    }
  }

  // Procesar el bloque final (que puede ser incompleto)
  const restoInicio = bloquesCompletos * TAMANO_BLOQUE;
  const resto = todas.slice(restoInicio);

  if (resto.length > 0) {
    const bloqueResto = mezclarConSemilla(resto, SEMILLA_GLOBAL + bloquesCompletos);
    const numTestsResto = Math.ceil(bloqueResto.length / PREGUNTAS_POR_TEST);

    for (let i = 0; i < numTestsResto; i++) {
      let preguntas = bloqueResto.slice(i * PREGUNTAS_POR_TEST, (i + 1) * PREGUNTAS_POR_TEST);

      // Si es el último test y no tiene 30 preguntas, repetir algunas hasta completar
      if (i === numTestsResto - 1 && preguntas.length < PREGUNTAS_POR_TEST) {
        const faltan = PREGUNTAS_POR_TEST - preguntas.length;
        const paraRepetir = bloqueResto.slice(0, faltan);
        preguntas = [...preguntas, ...paraRepetir];
      }

      tests.push({
        numero: bloquesCompletos * TESTS_POR_BLOQUE + i + 1,
        preguntas,
      });
    }
  }

  return tests;
}


/** Versión ligera de una pregunta para enviarla al navegador. */
export function aPreguntaCliente(p: PreguntaDGT): PreguntaCliente {
  return {
    id: p.id,
    pregunta: p.pregunta,
    imagen: p.imagen ?? null,
    respuestas: p.respuestas.map(({ letra, texto }) => ({ letra, texto })),
    respuestaCorrecta: p.respuestaCorrecta,
  };
}
