import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, segment: { params: Params }) {
  const { PATCH: _handler } = await import("./_handler");
  return _handler(req as unknown as Request, segment as any);
}
