/** 754 → "12:34" · 3754 → "1:02:34" */
export function formatearTiempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}
