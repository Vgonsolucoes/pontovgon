import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { POST: _handler } = await import("./_handler");
  return _handler(req as unknown as Request);
}
