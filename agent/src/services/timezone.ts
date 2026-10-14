/**
 * Utilitários de fuso horário do VGON PONTO Agent.
 *
 * O equipamento Control iD iDFace opera em horário LOCAL America/Sao_Paulo.
 * Os timestamps de access_logs chegam como epoch Unix (segundos, UTC) e
 * precisam ser convertidos para date/time locais SEM deslocamento duplo.
 */

export const SP_TZ = "America/Sao_Paulo";

export interface SpParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
}

/** Componentes de data/hora no fuso America/Sao_Paulo (horário local do equipamento). */
export function spParts(d: Date): SpParts {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour === "24" ? "00" : map.hour}:${map.minute}`,
    day: Number(map.day),
    month: Number(map.month),
    year: Number(map.year),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}
