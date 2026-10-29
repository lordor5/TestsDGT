import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const tests = defineCollection({
  loader: file('src/data/tests-dgt.json', {
    parser: (texto) =>
      JSON.parse(texto).map((t: { test: number }) => ({ ...t, id: String(t.test) })),
  }),
  schema: z.object({
    test: z.number(),
    titulo: z.string(),
    url: z.string().optional(),
    preguntas: z.array(
      z.object({
        numero: z.number(),
        pregunta: z.string(),
        imagen: z.string().nullable().optional(),
        respuestas: z.array(
          z.object({
            letra: z.string(),
            texto: z.string(),
            correcta: z.boolean(),
          })
        ),
        respuestaCorrecta: z.string(),
      })
    ),
  }),
});

export const collections = { tests };
