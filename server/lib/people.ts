import { z } from "zod";

export const roles = ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] as const;
export const employeeStatuses = ["ATIVO", "FERIAS", "AFASTADO", "DESLIGADO"] as const;
const optionalText = (max: number) => z.string().trim().max(max).default("").transform(value => value || null);
const relation = z.string().cuid("Selecione um registro válido").nullable().default(null);
const email = z.string().trim().toLowerCase().email("Informe um e-mail válido").max(160);

export function validCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length++) {
    let sum = 0;
    for (let index = 0; index < length; index++) sum += Number(cpf[index]) * (length + 1 - index);
    const digit = (sum * 10) % 11 % 10;
    if (digit !== Number(cpf[length])) return false;
  }
  return true;
}

export const userInput = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, "Informe o nome completo").max(160),
  email,
  password: z.string().default("").refine(value => value === "" || (value.length >= 8 && new TextEncoder().encode(value).length <= 72), "A senha deve ter pelo menos 8 caracteres e até 72 bytes"),
  role: z.enum(roles),
  employeeId: relation,
  active: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (!value.id && !value.password) context.addIssue({ code: "custom", path: ["password"], message: "Informe uma senha para o novo usuário" });
});

export const employeeInput = z.object({
  photoData: z.string().max(1400000, "Foto muito grande").optional(),
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, "Informe o nome completo").max(160),
  cpf: z.string().trim().regex(/^[\d.\-\s]+$/, "CPF inválido").transform(value => value.replace(/\D/g, "")).refine(validCpf, "CPF inválido"),
  registration: z.string().trim().min(1, "Informe a matrícula").max(80),
  email: z.union([email, z.literal("")]).default("").transform(value => value || null),
  phone: optionalText(40),
  departmentId: relation,
  positionId: relation,
  workScheduleId: relation,
  managerId: relation,
  admissionDate: z.string().default("").refine(value => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "Data de admissão inválida"),
  status: z.enum(employeeStatuses).default("ATIVO"),
  externalIdDevice: optionalText(120),
  observations: optionalText(2000),
}).strict();

export type PeopleActor = { id: string; role: typeof roles[number]; employeeId: string | null };
export function userWriteError(actor: PeopleActor, before: { id: string; role: string } | null, after: { role: string; active: boolean }): string | null {
  if (!["MASTER", "ADMIN"].includes(actor.role)) return "Sem permissão para cadastrar usuários";
  if (actor.role !== "MASTER" && (["MASTER", "ADMIN"].includes(after.role) || (before && ["MASTER", "ADMIN"].includes(before.role) && before.id !== actor.id))) {
    // Administradores podem editar os próprios dados, mantendo o perfil.
    if (!(before?.id === actor.id && after.role === actor.role)) return "Somente o Master pode gerenciar perfis administrativos";
  }
  if (before?.id === actor.id && (!after.active || after.role !== actor.role)) return "Você não pode desativar sua própria conta nem alterar seu próprio perfil";
  return null;
}
