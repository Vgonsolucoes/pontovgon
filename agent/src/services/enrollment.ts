import { z } from "zod";
import { createHash } from "node:crypto";

const payloadSchema = z.object({
  employeeId: z.string().min(1), deviceId: z.string().min(1), deviceUniqueId: z.string().min(1),
  deviceSerialNumber: z.string().min(1),
  registration: z.string().trim().min(1).max(80), name: z.string().trim().min(2).max(160),
  expectedUserId: z.number().int().positive().safe().nullable(),
  imageBase64: z.string().min(8).max(1400000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  imageHash: z.string().regex(/^[a-f0-9]{64}$/), timestamp: z.number().int().positive(),
}).strict();
type Request = (path: string, body: unknown) => Promise<any>;
function userId(value: unknown): number {
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("O iDFace não confirmou um ID de usuário válido");
  return id;
}
export async function enrollEmployee(raw: unknown, deviceUniqueId: string, request: Request) {
  const p = payloadSchema.parse(raw);
  if (p.deviceUniqueId !== deviceUniqueId) throw new Error("Comando destinado a outro equipamento; confira o Device ID no Agent");
  if (createHash("sha256").update(Buffer.from(p.imageBase64, "base64")).digest("hex") !== p.imageHash) throw new Error("Foto com integridade inválida");
  const info = await request("/system_information.fcgi", {});
  if ((info?.serial ?? info?.serial_number) !== p.deviceSerialNumber) throw new Error("O número de série do equipamento conectado difere do destino selecionado");
  async function load(where: Record<string, unknown>) {
    const result = await request("/load_objects.fcgi", { object: "users", fields: ["id", "name", "registration"], where: { users: where }, limit: 2 });
    if (!Array.isArray(result?.users)) throw new Error("Resposta inválida ao consultar usuários do iDFace");
    return result.users as Array<{ id: number; name: string; registration: string }>;
  }
  const matches = await load({ registration: p.registration });
  if (matches.length > 1) throw new Error("Há mais de um usuário com esta matrícula no iDFace; corrija a duplicidade antes de enviar");
  let id: number;
  if (p.expectedUserId) {
    const expected = await load({ id: p.expectedUserId });
    if (expected.length !== 1 || expected[0].registration !== p.registration || (matches[0] && userId(matches[0].id) !== p.expectedUserId)) throw new Error("O ID vinculado pertence a outra matrícula ou não existe no iDFace; confira o vínculo");
    id = p.expectedUserId;
  } else if (matches.length) id = userId(matches[0].id);
  else {
    const created = await request("/create_objects.fcgi", { object: "users", values: [{ name: p.name, registration: p.registration }] });
    if (!Array.isArray(created?.ids) || created.ids.length !== 1) throw new Error("Criação não confirmada pelo iDFace");
    id = userId(created.ids[0]);
  }
  await request("/modify_objects.fcgi", { object: "users", values: { name: p.name }, where: { users: { id } } });
  const confirmed = await load({ id });
  if (confirmed.length !== 1 || confirmed[0].name !== p.name || confirmed[0].registration !== p.registration) throw new Error("O iDFace não confirmou nome e matrícula enviados");
  const binding = { employeeId: p.employeeId, deviceUniqueId: p.deviceUniqueId, deviceSerialNumber: p.deviceSerialNumber, userId: id, registration: p.registration, userConfirmed: true, imageHash: p.imageHash, photoRegistered: false };
  const photo = await request("/user_set_image_list.fcgi", { match: true, user_images: [{ user_id: id, timestamp: p.timestamp, image: p.imageBase64 }] });
  const result = Array.isArray(photo?.results) && photo.results.length === 1 ? photo.results[0] : null;
  if (!result || userId(result.user_id) !== id || result.success !== true) {
    const reasons: Record<string, string> = { "Face not detected": "Rosto não detectado", "Face exists": "Rosto já cadastrado para outra pessoa", "Face not centered": "Centralize o rosto na foto", "Face too distant": "Rosto muito distante", "Face too close": "Rosto muito próximo", "Face pose not centered": "Olhe de frente para a câmera", "Low sharpness": "Foto sem nitidez suficiente", "Face too close to image borders": "Rosto muito próximo da borda" };
    const errors = Array.isArray(result?.errors) ? result.errors.map((error: { message?: string }) => reasons[error.message ?? ""] ?? "Foto recusada pelo iDFace").join("; ") : "Resposta de cadastro facial inválida";
    return { ok: false, result: binding, error: errors || "Foto não confirmada pelo iDFace" };
  }
  return { ok: true, result: { ...binding, photoRegistered: true } };
}
