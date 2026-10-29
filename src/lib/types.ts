export interface Respuesta {
  letra: string;
  texto: string;
  correcta: boolean;
}

export interface PreguntaDGT {
  /** Identificador estable: `${test original}-${número de pregunta}` */
  id: string;
  test: number;
  numero: number;
  pregunta: string;
  imagen?: string | null;
  respuestas: Respuesta[];
  respuestaCorrecta: string;
}

export interface TestGenerado {
  numero: number;
  preguntas: PreguntaDGT[];
}

export type Nivel = 'facil' | 'medio' | 'dificil';


export type Modo = 'repaso' | 'dificil';

/** Lo que viaja al navegador: sin los booleanos `correcta`. */
export interface PreguntaCliente {
  id: string;
  pregunta: string;
  imagen: string | null;
  respuestas: { letra: string; texto: string }[];
  respuestaCorrecta: string;
}
