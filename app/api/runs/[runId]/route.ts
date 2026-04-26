import { handleGetRun } from "@/src/api/handlers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const result = await handleGetRun(runId);
  return NextResponse.json(result.body, { status: result.status });
}
