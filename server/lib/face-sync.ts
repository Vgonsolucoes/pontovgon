export function supportsFaceSync(version: string | null): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 1 || (major === 1 && (minor > 0 || patch >= 4));
}
export function positiveDeviceUserId(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new Error("O ID do usuário no iDFace precisa ser um inteiro positivo");
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("ID no iDFace fora do intervalo suportado");
  return number;
}
export function confirmedEnrollment(payload: Record<string, unknown>, result: Record<string, unknown> | null | undefined, successful: boolean): boolean {
  if (!["employeeId", "deviceUniqueId", "deviceSerialNumber", "registration", "imageHash"].every(key => typeof payload[key] === "string" && payload[key] !== "")) return false;
  return !!result && result.userConfirmed === true && Number.isSafeInteger(result.userId) && Number(result.userId) > 0 &&
    result.employeeId === payload.employeeId && result.deviceUniqueId === payload.deviceUniqueId && result.deviceSerialNumber === payload.deviceSerialNumber && result.registration === payload.registration && result.imageHash === payload.imageHash &&
    (payload.expectedUserId == null || payload.expectedUserId === result.userId) && (!successful || result.photoRegistered === true);
}
export function enrollmentMetadata(payload: Record<string, unknown>) {
  const metadata = { ...payload }; delete metadata.imageBase64; return metadata;
}
