import type { APIRoute } from 'astro';
import { aPreguntaCliente, getTodasLasPreguntas } from '../lib/tests';

export const GET: APIRoute = async () => {
  const preguntas = (await getTodasLasPreguntas()).map(aPreguntaCliente);

  return new Response(JSON.stringify(preguntas), {
    headers: { 'Content-Type': 'application/json' },
  });
};
