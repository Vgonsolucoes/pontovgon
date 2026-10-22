/** A persisted ONLINE flag is insufficient without recent communication. */
export function isRecentCommunication(date: Date | string | null, now = Date.now(), maxAgeMs = 120000) {
  if (!date) return false;
  const age = now - new Date(date).getTime();
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}

