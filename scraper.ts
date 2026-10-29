/**
 * Scraper de los tests de la revista DGT.
 *
 * Abre Brave con Puppeteer, entra en
 *   https://revista.dgt.es/es/test/Test-num-224.shtml
 * y va sumando 1 al número del test hasta que la página da "no encontrado".
 * Guarda todas las preguntas, sus respuestas y la correcta en un JSON.
 *
 * Uso:
 *   npx tsx scraper.ts                 -> empieza en el test 224, navegador visible
 *   npx tsx scraper.ts 230             -> empieza en el test 230
 *   npx tsx scraper.ts --headless      -> sin ventana de navegador
 *   npx tsx scraper.ts --out=salida.json
 *   BRAVE_PATH=/otra/ruta/brave npx tsx scraper.ts   -> otra ruta de Brave
 */
import puppeteer from 'puppeteer-core';
import { readFile, writeFile } from 'node:fs/promises';

// ---------------------------------------------------------------- tipos ---

interface RawQuestion {
  numero: number;
  pregunta: string;
  imagen: string | null;
  respuestas: { letra: string; texto: string }[];
  correcta: string | null;
}

interface RawTest {
  titulo: string;
  preguntas: RawQuestion[];
}

interface Respuesta {
  letra: string;
  texto: string;
  correcta: boolean;
}

interface Pregunta {
  numero: number;
  pregunta: string;
  imagen: string | null;
  respuestas: Respuesta[];
  respuestaCorrecta: string | null; // letra: "A", "B" o "C"
}

interface Test {
  test: number;
  titulo: string;
  url: string;
  preguntas: Pregunta[];
}

// --------------------------------------------------------- configuración ---

const args = process.argv.slice(2);
const OUT_FILE = 'tests-dgt.json';
const HEADLESS = process.env.CI === 'true' ? 'new' : false;
const START = parseInt(process.env.START_TEST || '224', 10);
const BRAVE_PATH = process.env.BRAVE_PATH || '/etc/profiles/per-user/lordor/bin/brave';
const DELAY_MS = 500;

const urlDelTest = (n: number): string =>
  `https://revista.dgt.es/es/test/Test-num-${n}.shtml`;

// ------------------------------------------------- extracción en la página ---

/**
 * Código que se ejecuta DENTRO del navegador. Va como texto (String.raw) para
 * que las expresiones regulares lleguen intactas y no dependa de selectores CSS:
 * localiza cada título "N. pregunta" (h4) y analiza todo lo que hay hasta el
 * siguiente título (opciones A./B./C. y "Respuesta correcta x").
 */
const EXTRACT_SCRIPT = String.raw`(() => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

  const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
  const questionHeads = headings.filter(
    (h) => h.tagName === 'H4' && /^\s*\d+\s*\./.test(h.textContent || '')
  );
  const testImages = Array.from(document.querySelectorAll('img')).filter((img) =>
    /\/Galerias\/test\//i.test(img.getAttribute('src') || '')
  );

  const preguntas = questionHeads.map((h, i) => {
    const m = clean(h.textContent).match(/^(\d+)\s*\.\s*(.*)$/);
    const next = headings.find((o) => h.compareDocumentPosition(o) & FOLLOWING);

    const range = document.createRange();
    range.setStartAfter(h);
    if (next) range.setEndBefore(next);
    else range.setEndAfter(document.body.lastChild);
    const frag = range.cloneContents();
    const text = clean(frag.textContent);

    // Opciones: <li> que empiezan por "A.", "B.", ...
    const respuestas = [];
    const seen = new Set();
    frag.querySelectorAll('li').forEach((li) => {
      const t = clean(li.textContent).match(/^([A-Da-d])\s*[.)]\s*(.+)$/);
      if (t && !seen.has(t[1].toUpperCase())) {
        seen.add(t[1].toUpperCase());
        respuestas.push({ letra: t[1].toUpperCase(), texto: t[2] });
      }
    });

    // Plan B por si las opciones no estuvieran en <li>
    if (respuestas.length === 0) {
      const re = /(?:^|\s)([A-D])\.\s+(.*?)(?=\s[A-D]\.\s|\s*Mostrar respuesta|\s*Respuesta correcta|$)/g;
      let r;
      while ((r = re.exec(text)) !== null) {
        if (!seen.has(r[1])) {
          seen.add(r[1]);
          respuestas.push({ letra: r[1], texto: r[2].trim() });
        }
      }
    }

    const c = text.match(/Respuesta\s+correcta\s*:?\s*([A-Da-d])\b/i);

    // Imagen: la última imagen de test situada entre la pregunta anterior y esta
    const prev = i > 0 ? questionHeads[i - 1] : null;
    const imgs = testImages.filter(
      (img) =>
        img.compareDocumentPosition(h) & FOLLOWING &&
        (!prev || prev.compareDocumentPosition(img) & FOLLOWING)
    );
    const img = imgs.length ? imgs[imgs.length - 1] : null;

    return {
      numero: Number(m[1]),
      pregunta: m[2],
      imagen: img ? img.src : null,
      respuestas,
      correcta: c ? c[1].toUpperCase() : null,
    };
  });

  const h1 = document.querySelector('h1');
  return { titulo: clean(h1 ? h1.textContent : document.title), preguntas };
})()`;


/** Lee el JSON existente (si lo hay) para no repetir tests ya escaneados. */
async function cargarTests(): Promise<Test[]> {
  try {
    const data = JSON.parse(await readFile(OUT_FILE, 'utf-8')) as Test[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []; // aún no existe
    throw new Error(`No se pudo leer ${OUT_FILE}: ${(err as Error).message}`);
  }
}

// ------------------------------------------------------------------ main ---

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const tests = await cargarTests();
  const yaEscaneados = new Set(tests.map((t) => t.test));

  try {
    for (let n = START; ; n++) {
      const url = urlDelTest(n);
      console.log(`→ Test ${n}: ${url}`);

      if (yaEscaneados.has(n)) {
        console.log(`↷ Test ${n}: ya escaneado, se salta.`);
        continue;
      }

      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 0;

      //if (status >= 400 || status === 0) {
      //  console.log(`✖ El test ${n} devuelve HTTP ${status} (no encontrado). Fin.`);
      //  break;
      //}

      const raw = (await page.evaluate(EXTRACT_SCRIPT)) as RawTest;

      // Algunas webs devuelven una página de error con código 200
      // if (raw.preguntas.length === 0) {
      //   console.log(`✖ El test ${n} no contiene preguntas (página de error). Fin.`);
      //   break;
      // }

      const preguntas: Pregunta[] = raw.preguntas.map((q) => {
        if (q.respuestas.length < 2 || !q.correcta) {
          console.warn(`  ⚠ Test ${n}, pregunta ${q.numero}: datos incompletos`);
        }
        return {
          numero: q.numero,
          pregunta: q.pregunta,
          imagen: q.imagen,
          respuestas: q.respuestas.map((r) => ({ ...r, correcta: r.letra === q.correcta })),
          respuestaCorrecta: q.correcta,
        };
      });

      tests.push({ test: n, titulo: raw.titulo, url, preguntas });
      console.log(`  ✔ "${raw.titulo}" – ${preguntas.length} preguntas`);

      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  } catch (err) {
    console.error('Error durante el scraping:', err);
  } finally {
    await browser.close();
    // Se guarda siempre lo recogido hasta el momento, aunque haya habido un error
    await writeFile(OUT_FILE, JSON.stringify(tests, null, 2), 'utf-8');
    const total = tests.reduce((sum, t) => sum + t.preguntas.length, 0);
    console.log(`\nGuardado ${OUT_FILE}: ${tests.length} tests, ${total} preguntas.`);
  }
}

main();
