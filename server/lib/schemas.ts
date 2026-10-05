import { z } from "zod";

export const TINY_TEXT = 80;
export const SHORT_TEXT = 160;
export const MEDIUM_TEXT = 320;
export const LONG_TEXT = 2000;
export const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^(\+?\d{1,3})?\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;

/* =============================================================
   DEPARTAMENTS (SETOR)
============================================================= */
export const DepartmentSchema = z.object({
  id: z.string().cuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .min(2, "Mínimo 2 caracteres")
    .max(TINY_TEXT, `Máximo ${TINY_TEXT} caracteres`),
  description: z.string().trim().max(MEDIUM_TEXT, `Máximo ${MEDIUM_TEXT} caracteres`).optional().nullable(),
  active: z.boolean().default(true),
});
export type DepartmentInput = z.infer<typeof DepartmentSchema>;

/* =============================================================
   POSITIONS (CARGOS)
============================================================= */
export const PositionSchema = z.object({
  id: z.string().cuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .min(2, "Mínimo 2 caracteres")
    .max(TINY_TEXT, `Máximo ${TINY_TEXT} caracteres`),
  departmentId: z.string().cuid().optional().nullable(),
  active: z.boolean().default(true),
  description: z.string().trim().max(MEDIUM_TEXT, `Máximo ${MEDIUM_TEXT} caracteres`).optional().nullable(),
});
export type PositionInput = z.infer<typeof PositionSchema>;

/* =============================================================
   COMPANY (EMPRESA)
============================================================= */
export const CompanySchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório").max(SHORT_TEXT),
  tradeName: z.string().trim().min(2, "Nome fantasia é obrigatório").max(SHORT_TEXT).optional().nullable(),
  cnpj: z
    .string()
    .trim()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/, "CNPF inválido")
    .optional()
    .nullable(),
  ie: z.string().trim().max(TINY_TEXT).optional().nullable(),
  im: z.string().trim().max(TINY_TEXT).optional().nullable(),
  email: z.string().trim().regex(EMAIL_REGEX, "E-mail inválido").optional().nullable(),
  phone: z.string().trim().max(TINY_TEXT).optional().nullable(),
  address: z.string().trim().max(MEDIUM_TEXT).optional().nullable(),
  city: z.string().trim().max(TINY_TEXT).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
  zip: z.string().trim().max(20).optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable(),
  timezone: z.string().trim().max(TINY_TEXT).default("America/Sao_Paulo"),
});
export type CompanyInput = z.infer<typeof CompanySchema>;

export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  payload: unknown,
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
