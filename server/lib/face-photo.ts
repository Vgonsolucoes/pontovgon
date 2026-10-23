import { createHash } from "node:crypto";
export const MAX_PHOTO_BYTES = 1024 * 1024;
export function facePhoto(value: string) {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || value.length > 1400000) throw new Error("Selecione uma foto JPG ou PNG de até 1 MB");
  const bytes = Buffer.from(match[2], "base64");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES || (match[1] === "jpeg" ? !jpeg : !png) || bytes.toString("base64") !== match[2]) throw new Error("Arquivo de foto inválido");
  return { bytes, base64: match[2], type: `image/${match[1]}`, hash: createHash("sha256").update(bytes).digest("hex") };
}
export function photoAudit<T extends { photoUrl?: string | null }>(value: T) {
  const { photoUrl, ...rest } = value;
  return { ...rest, hasPhoto: !!photoUrl };
}
