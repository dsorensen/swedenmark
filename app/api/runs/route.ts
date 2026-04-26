import { handleCreateRun } from "@/src/api/handlers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await safeJson(req);
  const result = await handleCreateRun(body);
  return NextResponse.json(result.body, { status: result.status });
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
