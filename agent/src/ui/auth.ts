import { timingSafeEqual } from "node:crypto";

export const UI_COOKIE = "vgon_ui_session";
export function matchesSecret(actual: string | undefined | null, expected: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function hasUiSession(cookie: string | undefined, session: string): boolean {
  return (cookie ?? "").split(";").some(part => {
    const [name, ...value] = part.trim().split("=");
    return name === UI_COOKIE && matchesSecret(value.join("="), session);
  });
}
