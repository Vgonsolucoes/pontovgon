import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingMessage } from "http";

export function nodeReqToFetchRequest(req: NextApiRequest, host = "localhost"): Request {
  const protocol = (req as any).protocol || "https";
  const url = `${protocol}://${host}${req.url || "/"}`;
  const method = req.method || "GET";

  const headers = new Headers();
  const nodeHeaders = (req as IncomingMessage).headers;
  for (const [k, v] of Object.entries(nodeHeaders)) {
    if (Array.isArray(v)) for (const val of v) headers.append(k, val);
    else if (typeof v === "string") headers.append(k, v);
  }

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) body = req.body;
    else if (req.body !== undefined && typeof req.body !== "string") body = JSON.stringify(req.body);
    else if (typeof req.body === "string") body = req.body;
  }

  return new Request(url, { method, headers, body, duplex: body ? "half" : undefined } as RequestInit);
}

export async function writeFetchResponse(res: NextApiResponse, response: Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((val, key) => {
    const lk = key.toLowerCase();
    if (lk === "transfer-encoding" || lk === "connection") return;
    res.setHeader(key, val);
  });
  const arrBuf = await response.arrayBuffer();
  if (arrBuf.byteLength === 0) {
    res.end();
    return;
  }
  res.send(Buffer.from(arrBuf));
}

export type ApiHandlerFn = (req: Request) => Promise<Response>;
export type ApiHandlerDynamicFn = (
  req: Request,
  segment: { params: Promise<{ id: string }> },
) => Promise<Response>;

export function runAgentHandler(method: string, fn: ApiHandlerFn) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
      if ((req.method || "GET").toUpperCase() !== method.toUpperCase()) {
        res.setHeader("Allow", method.toUpperCase());
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        return;
      }
      const fetchReq = nodeReqToFetchRequest(req);
      const out = await fn(fetchReq);
      await writeFetchResponse(res, out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Unhandled", detail: msg });
    }
  };
}

export function runAgentHandlerWithId(method: string, fn: ApiHandlerDynamicFn) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
      if ((req.method || "GET").toUpperCase() !== method.toUpperCase()) {
        res.setHeader("Allow", method.toUpperCase());
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        return;
      }
      const fetchReq = nodeReqToFetchRequest(req);
      const id = String(req.query.id || "");
      const segment = { params: Promise.resolve({ id }) };
      const out = await fn(fetchReq, segment);
      await writeFetchResponse(res, out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Unhandled", detail: msg });
    }
  };
}
