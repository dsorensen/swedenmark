/**
 * Deterministic fixture LLM implementation. Used by default and by every
 * test that does not explicitly opt into the real Anthropic adapter so the
 * integration / e2e suites stay hermetic.
 */

import type { Draft, LeadFields, LlmAdapter, QualifyResult } from "../adapters";

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

export function fixtureQualify(fields: LeadFields): QualifyResult {
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

export function fixtureDraftReply(fields: LeadFields, qualify: QualifyResult): Draft {
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

export const fixtureLlmAdapter: LlmAdapter = {
  async extract(rawText) {
    return fixtureExtract(rawText);
  },
  async qualify(fields) {
    return fixtureQualify(fields);
  },
  async draftReply(fields, qualification) {
    return fixtureDraftReply(fields, qualification);
  },
};
