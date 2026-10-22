/** Validate the entire acknowledgement before discarding any durable queue item. */
export function acknowledgedBatch(response: { ok: boolean; received: number; created: number; duplicated: number; failed: number; failedItems?: Array<{ externalEventId: string }> }, ids: string[]) {
  const counts = [response.received, response.created, response.duplicated, response.failed];
  const failures = response.failedItems ?? [];
  if (!response.ok || counts.some(n => !Number.isInteger(n) || n < 0) ||
      response.received !== ids.length || response.created + response.duplicated + response.failed !== ids.length ||
      failures.length !== response.failed || new Set(failures.map(f => f.externalEventId)).size !== failures.length ||
      failures.some(f => !ids.includes(f.externalEventId))) throw new Error("Confirmação incompleta da API; lote preservado para reenvio.");
  const failed = new Set(failures.map(f => f.externalEventId));
  return ids.filter(id => !failed.has(id));
}
