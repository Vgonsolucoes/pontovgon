import { z } from "zod";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { PeopleActor } from "./people";
import { dayLoad, scheduleInput } from "./work-schedules";

export const zone = "America/Sao_Paulo";
export const dateKey = (value: Date) => value.toISOString().slice(0, 10);
export const localToday = (now = new Date()) => formatInTimeZone(now, zone, "yyyy-MM-dd");
export function addDays(date: string, days: number) { return dateKey(new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)); }
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !isNaN(Date.parse(value)) && dateKey(new Date(value)) === value, "Data inválida");
export const entryFilters = z.object({
  start: isoDate, end: isoDate, employeeId: z.union([z.string().cuid(), z.literal(""), z.literal("unlinked")]).default(""),
  deviceId: z.union([z.string().cuid(), z.literal("")]).default(""),
  origin: z.enum(["", "IDFACE", "MANUAL", "ADMINISTRATIVO", "WEB", "APP"]).default(""),
  status: z.enum(["", "VALIDO", "AJUSTADO", "INCONSISTENTE", "EXCLUIDO_LOGICAMENTE"]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict().superRefine((value, ctx) => {
  const span = Date.parse(value.end) - Date.parse(value.start);
  if (span < 0 || span > 61 * 86400000) ctx.addIssue({ code: "custom", path: ["end"], message: "Selecione um período de até 62 dias, com fim após o início" });
});
export const sheetFilters = z.object({ employeeId: z.string().cuid(), month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, "Mês inválido") }).strict();
export function employeeScope(actor: PeopleActor): { managerId?: string; id?: string } {
  if (["MASTER", "ADMIN", "RH"].includes(actor.role)) return {};
  if (actor.role === "GESTOR") return { managerId: actor.employeeId || "no-linked-manager" };
  return { id: actor.employeeId || "no-linked-employee" };
}
export type SheetEntry = { id: string; date: string; time: string; timestamp: string | null; kind: string | null; status: string; origin: string; reviewFlags?: string[] };
type ScheduleDay = { weekday: number; isDayOff: boolean; entryTime: string | null; departureTime: string | null; breakStartTime: string | null; breakEndTime: string | null };
type Schedule = { name: string; model: string; toleranceMinutes: number; days: ScheduleDay[] };
type Absence = { start: string; end: string; label: string; partial: boolean };
export type SheetDay = { date: string; weekday: number; punches: { id: string; time: string; nextDay: boolean; origin: string }[]; expectedMinutes: number | null; workedMinutes: number | null; balanceMinutes: number | null; status: string; notes: string[] };
const clock = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const weekday = (date: string) => new Date(date + "T12:00:00Z").getUTCDay();
export function buildSheet(input: { month: string; schedule: Schedule | null; entries: SheetEntry[]; holidays: string[]; absences: Absence[]; admissionDate: string | null; now?: Date }) {
  const now = input.now ?? new Date(), today = localToday(now);
  const start = input.month + "-01", end = dateKey(new Date(Date.UTC(Number(input.month.slice(0, 4)), Number(input.month.slice(5)), 0)));
  const usableSchedule = input.schedule && scheduleInput.safeParse({ name: input.schedule.name, model: input.schedule.model, toleranceMinutes: input.schedule.toleranceMinutes, days: input.schedule.days, active: true, observations: "" }).success ? input.schedule : null;
  const scheduled = (date: string) => usableSchedule?.days.find(day => day.weekday === weekday(date));
  const grouped = new Map<string, SheetEntry[]>();
  for (const entry of input.entries) {
    if (entry.status === "EXCLUIDO_LOGICAMENTE") continue;
    let target = entry.date;
    const previousDate = addDays(entry.date, -1), previous = scheduled(previousDate), current = scheduled(entry.date);
    if (validTime(entry.time) && previous && !previous.isDayOff && previous.entryTime && previous.departureTime && clock(previous.departureTime) < clock(previous.entryTime)) {
      // Até 1h após a saída prevista; nunca incorpora a entrada do próximo turno.
      const beforeNext = !current || current.isDayOff || !current.entryTime || clock(entry.time) < clock(current.entryTime);
      if (beforeNext && clock(entry.time) <= clock(previous.departureTime) + 60) target = previousDate;
    }
    grouped.set(target, [...(grouped.get(target) ?? []), entry]);
  }
  const rows: SheetDay[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const plan = scheduled(date), notes: string[] = [];
    const holiday = input.holidays.includes(date), matchingAbsences = input.absences.filter(item => item.start <= date && item.end >= date);
    const absence = matchingAbsences.find(item => !item.partial) ?? matchingAbsences[0];
    const beforeAdmission = !!input.admissionDate && date < input.admissionDate;
    const exempt = holiday || (!!absence && !absence.partial) || beforeAdmission;
    let expectedMinutes = usableSchedule && plan ? dayLoad(plan) : null;
    if (exempt && usableSchedule) expectedMinutes = 0;
    if (!usableSchedule) notes.push("Sem jornada semanal válida vinculada");
    if (holiday) notes.push("Feriado cadastrado");
    if (absence) notes.push(absence.label + (absence.partial ? " — justificativa parcial: conferir horas" : ""));
    if (beforeAdmission) notes.push("Antes da admissão");
    const originals = grouped.get(date) ?? [];
    const repeated = originals.filter(entry => entry.reviewFlags?.includes("DUPLICATE"));
    if (repeated.length) notes.push(`${repeated.length} batida(s) repetida(s) preservada(s) em Marcações e desconsiderada(s) no cálculo`);
    const entries = originals.filter(entry => !entry.reviewFlags?.includes("DUPLICATE")).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id.localeCompare(b.id));
    let invalid = false;
    const instants: number[] = [];
    for (const entry of entries) {
      const stamp = entry.timestamp ? new Date(entry.timestamp) : fromZonedTime(`${entry.date}T${entry.time}:00`, zone);
      if (!validTime(entry.time) || !Number.isFinite(stamp.getTime()) || formatInTimeZone(stamp, zone, "yyyy-MM-dd HH:mm") !== `${entry.date} ${entry.time}` || entry.status === "INCONSISTENTE") invalid = true;
      instants.push(stamp.getTime());
    }
    let worked = 0;
    for (let index = 0; index + 1 < entries.length; index += 2) {
      const first = entries[index], last = entries[index + 1];
      if (["OUT", "EXIT", "BREAK_OUT"].includes(first.kind ?? "") || ["IN", "ENTRY", "BREAK_IN"].includes(last.kind ?? "")) invalid = true;
      const delta = (instants[index + 1] - instants[index]) / 60000;
      if (!Number.isFinite(delta) || delta <= 0 || delta >= 1440) invalid = true;
      else worked += delta;
    }
    if (new Set(entries.map(entry => `${entry.date} ${entry.time}`)).size !== entries.length) invalid = true;
    if (worked >= 1440) invalid = true;
    const incomplete = entries.length % 2 !== 0;
    if (incomplete) notes.push("Quantidade ímpar de batidas: conferir entrada e saída");
    if (invalid) notes.push("Batidas inconsistentes: conferir sequência e horário");
    const overnight = plan && !plan.isDayOff && plan.entryTime && plan.departureTime && clock(plan.departureTime) < clock(plan.entryTime);
    const completed = (overnight ? addDays(date, 1) : date) < today;
    const future = date > today;
    if (entries.some((entry, index) => instants[index] > now.getTime())) { invalid = true; notes.push("Há batida com horário futuro"); }
    const workedMinutes = invalid || incomplete ? null : Math.round(worked);
    let balanceMinutes: number | null = null;
    if (completed && expectedMinutes !== null && workedMinutes !== null && !absence?.partial) {
      const delta = workedMinutes - expectedMinutes;
      balanceMinutes = Math.abs(delta) <= (usableSchedule?.toleranceMinutes ?? 0) ? 0 : delta;
    }
    const status = invalid ? "Inconsistente" : incomplete ? "Batidas incompletas" : future ? "Previsto" : !completed ? "Em andamento" : absence ? "Ausência aprovada" : holiday ? "Feriado" : beforeAdmission ? "Antes da admissão" : !usableSchedule ? "Sem jornada" : !entries.length && !!expectedMinutes ? "Sem marcações" : plan?.isDayOff && !entries.length ? "Folga" : "Batidas completas";
    rows.push({ date, weekday: weekday(date), punches: entries.map(entry => ({ id: entry.id, time: entry.time, nextDay: entry.date !== date, origin: entry.origin })), expectedMinutes, workedMinutes, balanceMinutes, status, notes });
  }
  const closed = rows.filter(row => row.date < today && row.status !== "Em andamento");
  const pendingDays = closed.filter(row => row.balanceMinutes === null).length;
  return {
    rows, start, end, generatedAt: now.toISOString(), timezone: zone,
    totals: {
      expectedMinutes: usableSchedule ? rows.reduce((sum, row) => sum + (row.expectedMinutes ?? 0), 0) : null,
      workedMinutes: rows.reduce((sum, row) => sum + (row.workedMinutes ?? 0), 0),
      balanceMinutes: closed.length && !pendingDays ? closed.reduce((sum, row) => sum + (row.balanceMinutes ?? 0), 0) : null,
      pendingDays, punches: rows.reduce((sum, row) => sum + row.punches.length, 0),
    },
    rules: "Conferência pela jornada atual, sem fechamento de folha ou lançamento no banco de horas. Batidas são pareadas em ordem (entrada/saída); dias incompletos não geram saldo. Tolerância aplicada à diferença líquida diária. Turnos noturnos incluem batidas da manhã seguinte até 1h após a saída prevista, antes da entrada do próximo turno. Alterações na jornada atual afetam esta conferência histórica.",
  };
}
