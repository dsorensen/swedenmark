import { handleApproveStep } from "@/src/api/handlers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string; stepId: string }> },
) {
  const { runId, stepId } = await ctx.params;
  const body = await safeJson(req);
  const result = await handleApproveStep(runId, stepId, body);
  return NextResponse.json(result.body, { status: result.status });
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
