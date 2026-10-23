import { z } from "zod";

export const scheduleModels = { CINCOXDOIS: "5x2", SEISXUM: "6x1", DOZEXTRINTASEIS: "12x36", PERSONALIZADA: "Personalizada" } as const;
export const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:mm)").nullable();
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function dayLoad(day: { isDayOff: boolean; entryTime: string | null; departureTime: string | null; breakStartTime: string | null; breakEndTime: string | null }): number {
  if (day.isDayOff || !day.entryTime || !day.departureTime) return 0;
  const elapsed = (minutes(day.departureTime) - minutes(day.entryTime) + 1440) % 1440;
  const interval = day.breakStartTime && day.breakEndTime ? (minutes(day.breakEndTime) - minutes(day.breakStartTime) + 1440) % 1440 : 0;
  return elapsed - interval;
}
const dayInput = z.object({
  weekday: z.number().int().min(0).max(6), isDayOff: z.boolean(),
  entryTime: time, breakStartTime: time, breakEndTime: time, departureTime: time,
}).strict().superRefine((day, ctx) => {
  if (day.isDayOff) return;
  const issue = (field: string, message: string) => ctx.addIssue({ code: "custom", path: [field], message });
  if (!day.entryTime || !day.departureTime) { issue("entryTime", "Informe entrada e saída ou marque folga"); return; }
  const entry = minutes(day.entryTime);
  const offset = (value: string) => (minutes(value) - entry + 1440) % 1440;
  const end = offset(day.departureTime);
  if (!end) issue("departureTime", "Entrada e saída devem ser diferentes (turno menor que 24 horas)");
  if (!!day.breakStartTime !== !!day.breakEndTime) issue("breakStartTime", "Informe os dois horários do intervalo");
  if (day.breakStartTime && day.breakEndTime && !(offset(day.breakStartTime) > 0 && offset(day.breakEndTime) > offset(day.breakStartTime) && offset(day.breakEndTime) < end)) issue("breakStartTime", "O intervalo deve começar e terminar dentro do turno, em ordem");
});
export const scheduleInput = z.object({
  id: z.string().cuid().optional(), name: z.string().trim().min(2, "Informe o nome da jornada").max(120),
  model: z.enum(["CINCOXDOIS", "SEISXUM", "DOZEXTRINTASEIS", "PERSONALIZADA"]),
  toleranceMinutes: z.number().int().min(0).max(120), active: z.boolean(),
  observations: z.string().trim().max(2000), days: z.array(dayInput).length(7, "Configure os sete dias da semana"),
}).strict().superRefine((schedule, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", path: ["days"], message });
  if (new Set(schedule.days.map(day => day.weekday)).size !== 7) issue("Cada dia da semana deve aparecer uma única vez");
  const working = schedule.days.filter(day => !day.isDayOff);
  if (!working.length) issue("Informe pelo menos um dia de trabalho");
  if (schedule.model === "CINCOXDOIS" && working.length !== 5) issue("O modelo 5x2 precisa de cinco dias de trabalho e duas folgas");
  if (schedule.model === "SEISXUM" && working.length !== 6) issue("O modelo 6x1 precisa de seis dias de trabalho e uma folga");
  if (schedule.model === "DOZEXTRINTASEIS") ctx.addIssue({ code: "custom", path: ["model"], message: "O ciclo 12x36 exige uma escala com data inicial. Use uma jornada personalizada para horários semanais; a escala alternada ainda não está disponível." });
  for (const day of working) {
    const next = schedule.days.find(item => item.weekday === (day.weekday + 1) % 7);
    if (day.entryTime && day.departureTime && minutes(day.departureTime) < minutes(day.entryTime) && next && !next.isDayOff && next.entryTime && minutes(next.entryTime) < minutes(day.departureTime)) issue(`O turno de ${weekdays[day.weekday]} sobrepõe a entrada do dia seguinte`);
  }
}).transform(schedule => ({ ...schedule, days: schedule.days.map(day => day.isDayOff ? { ...day, entryTime: null, breakStartTime: null, breakEndTime: null, departureTime: null } : day) }));
export function scheduleLoads(days: Parameters<typeof dayLoad>[0][]) {
  const loads = days.map(dayLoad);
  return { dailyLoadMinutes: Math.max(...loads), weeklyLoadMinutes: loads.reduce((sum, value) => sum + value, 0) };
}
