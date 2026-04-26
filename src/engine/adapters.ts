/**
 * Step adapters. Pure functions of (input, context) → output. The engine
 * persists their results; adapters do not touch the database directly.
 *
 * The LLM adapters use a deterministic fixture implementation by default
 * so the integration test does not depend on a network call. Swap for the
 * real Anthropic adapter by setting LLM_ADAPTER=anthropic and providing
 * ANTHROPIC_API_KEY (real adapter is intentionally out of scope for SWE-4).
 */

export interface AdapterContext {
  runId: string;
  stepId: string;
  runInput: unknown;
}

export type AdapterFn = (
  input: unknown,
  context: AdapterContext,
) => Promise<Record<string, unknown>>;

export interface LeadFields {
  company: string;
  contact: string;
  role: string;
  ask: string;
  signals: string[];
  source: string;
}

export interface QualifyResult {
  score: 1 | 2 | 3 | 4 | 5;
  recommendedAction: string;
  rationale: string;
}

export function fixtureExtract(rawText: string): LeadFields {
  const lower = rawText.toLowerCase();
  const sourceGuess = lower.includes("linkedin")
    ? "linkedin"
    : lower.includes("typeform") || lower.includes("form")
      ? "web_form"
      : "email";

  // `.`, `,`, and newline are excluded from the company-name class so the
  // greedy match stops at the first sentence terminator instead of running
  // across sentence boundaries (see SWE-7).
  const companyMatch =
    rawText.match(/\b(?:from|at)\s+([A-Z][A-Za-z0-9 &-]{2,40})\b/) ??
    rawText.match(/([A-Z][A-Za-z0-9 &-]{2,40})\s+team\b/i);
  const company = (companyMatch?.[1] ?? "Unknown Co").trim();

  const contactMatch =
    rawText.match(/(?:I'?m|I am|This is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/) ??
    rawText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+here/m);
  const contact = (contactMatch?.[1] ?? "Unknown Contact").trim();

  const roleMatch = rawText.match(
    /\b(CEO|CTO|CFO|COO|VP\s+\w+|Head\s+of\s+\w+|Director\s+of\s+\w+|Founder|PM|Engineer|Operator)\b/i,
  );
  const role = roleMatch?.[0] ?? "Unknown";

  const askLine = rawText
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .find((s) =>
      /(looking|interested|need|want|exploring|wondering|help|demo|trial|pilot)/i.test(s),
    );
  const ask = askLine ?? "Unspecified inbound interest.";

  const signals: string[] = [];
  if (/budget|pricing|cost|\$/i.test(rawText)) signals.push("mentions_budget");
  if (/team of|employees|seats/i.test(rawText)) signals.push("mentions_team_size");
  if (/(this week|asap|urgent|next week)/i.test(rawText)) signals.push("urgency");
  if (/(competitor|currently using|switching from)/i.test(rawText)) signals.push("competitive");

  return {
    company,
    contact,
    role,
    ask,
    signals,
    source: sourceGuess,
  };
}

function fixtureQualify(fields: LeadFields): QualifyResult {
  let raw = 3;
  if (fields.signals.includes("mentions_budget")) raw += 1;
  if (fields.signals.includes("urgency")) raw += 1;
  if (fields.signals.includes("competitive")) raw -= 1;
  if (/CEO|CTO|Founder|VP|Head of/i.test(fields.role)) raw += 1;
  const score = Math.max(1, Math.min(5, raw)) as QualifyResult["score"];

  const recommendedAction =
    score >= 4
      ? "Schedule a 30-minute discovery call this week."
      : score === 3
        ? "Reply with two qualifying questions before booking time."
        : "Send a short reply with relevant resources; do not book time yet.";

  const rationale = [
    `Role weight: ${fields.role}.`,
    `Signals: ${fields.signals.length ? fields.signals.join(", ") : "none"}.`,
    `Source: ${fields.source}.`,
  ].join(" ");

  return { score, recommendedAction, rationale };
}

function fixtureDraftReply(
  fields: LeadFields,
  qualify: QualifyResult,
): { subject: string; body: string } {
  const subject = `Re: ${fields.ask.split("\n")[0].slice(0, 60)}`;
  const opener = `Hi ${fields.contact.split(" ")[0] || "there"},`;
  const body =
    qualify.score >= 4
      ? `${opener}\n\nThanks for reaching out about ${fields.company}. Based on what you described, this looks like a good fit on our side. ${qualify.recommendedAction}\n\nDoes Tuesday or Thursday afternoon work?\n\nBest,\nSwedenmark`
      : qualify.score === 3
        ? `${opener}\n\nThanks for the note about ${fields.company}. Before I book time, two quick questions: 1) what does success look like for you in the next 90 days, and 2) what tools do you currently use for this?\n\nBest,\nSwedenmark`
        : `${opener}\n\nAppreciate you reaching out about ${fields.company}. We may not be the right fit immediately, but here are two resources that should help: <link 1>, <link 2>. Happy to revisit later.\n\nBest,\nSwedenmark`;
  return { subject, body };
}

export const adapters: Record<string, AdapterFn> = {
  "llm.extract_lead_fields": async (_input, context) => {
    const rawText = readRawText(context.runInput);
    return { fields: fixtureExtract(rawText) } satisfies Record<string, unknown>;
  },
  "llm.qualify_lead": async (input) => {
    const fields = (input as { fields?: LeadFields })?.fields;
    if (!fields) throw new Error("qualify step missing 'fields' in input");
    return { qualification: fixtureQualify(fields) };
  },
  "llm.draft_reply": async (input) => {
    const i = input as { fields?: LeadFields; qualification?: QualifyResult };
    if (!i.fields || !i.qualification) {
      throw new Error("draft step missing 'fields' or 'qualification' in input");
    }
    return { draft: fixtureDraftReply(i.fields, i.qualification) };
  },
  "human.gate": async (input) => {
    // Human gate does not produce its own output; the operator's edited
    // payload becomes the step output via the approve endpoint.
    return { awaitingHumanInput: true, suggested: input ?? null };
  },
  "dispatch.mock": async (input) => {
    const draft = (input as { draft?: { subject: string; body: string } })?.draft;
    if (!draft) throw new Error("dispatch step missing 'draft' in input");
    return {
      dispatched: true,
      to: "<mocked-recipient>",
      subject: draft.subject,
      body: draft.body,
      sentAt: new Date().toISOString(),
    };
  },
};

function readRawText(runInput: unknown): string {
  if (
    runInput &&
    typeof runInput === "object" &&
    "rawText" in runInput &&
    typeof (runInput as { rawText: unknown }).rawText === "string"
  ) {
    return (runInput as { rawText: string }).rawText;
  }
  throw new Error("Run input must be an object with a string `rawText` field.");
}
