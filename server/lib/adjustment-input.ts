import { z } from "zod";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Data inválida");
const request = z.object({ operation: z.literal("request"), employeeId: z.string().cuid(), type: z.enum(["INSERT", "REPLACE", "EXCLUDE"]), date, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null), targetEntryId: z.string().cuid().nullable().default(null), justification: z.string().trim().min(10, "Justifique o ajuste com pelo menos 10 caracteres").max(2000) }).strict();
const review = z.object({ operation: z.literal("review"), id: z.string().cuid(), decision: z.enum(["APPROVE", "REJECT"]), note: z.string().trim().max(2000).default("") }).strict();
export const adjustmentInput = z.discriminatedUnion("operation", [request, review]).superRefine((value, ctx) => {
  if (value.operation === "request") {
    if (value.type !== "INSERT" && !value.targetEntryId) ctx.addIssue({ code: "custom", path: ["targetEntryId"], message: "Selecione a batida original" });
    if (value.type === "INSERT" && value.targetEntryId) ctx.addIssue({ code: "custom", path: ["targetEntryId"], message: "Uma inclusão não altera batidas existentes" });
    if (value.type !== "EXCLUDE" && !value.time) ctx.addIssue({ code: "custom", path: ["time"], message: "Informe o novo horário" });
  } else if (value.decision === "REJECT" && value.note.length < 10) ctx.addIssue({ code: "custom", path: ["note"], message: "Justifique a rejeição com pelo menos 10 caracteres" });
});
