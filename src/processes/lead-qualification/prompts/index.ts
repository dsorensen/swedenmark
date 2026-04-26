/**
 * Prompt + few-shot fixtures for the lead-qualification process.
 *
 * The fixtures are checked in so the prompt is reviewable in code review and
 * unit-testable without a network call. The shape of each FewShot entry mirrors
 * what the runtime adapters expect, so the same examples can be replayed
 * through the deterministic fixture adapter for a structural sanity check.
 */

export interface ExtractedLead {
  company: string;
  contact: string;
  role: string;
  ask: string;
  signals: string[];
  source: string;
}

export interface Qualification {
  score: 1 | 2 | 3 | 4 | 5;
  recommendedAction: string;
  rationale: string;
}

export interface Draft {
  subject: string;
  body: string;
}

export interface FewShot<TIn, TOut> {
  input: TIn;
  output: TOut;
}

export const extractPrompt = {
  system: [
    "You extract structured fields from an unstructured inbound message.",
    "Return strict JSON matching the provided schema. Do not invent facts that are not present in the input.",
    'If a field is genuinely unknown, use "Unknown" (or "Unknown Co" for company).',
    "`source` is one of: linkedin, web_form, email.",
    "`signals` is a short list drawn from this controlled vocabulary: mentions_budget, mentions_team_size, urgency, competitive.",
  ].join(" "),
  fewShots: [
    {
      input:
        "Hi, I'm Maya Chen, CTO at Northwind Logistics. Saw your demo on LinkedIn.\nWe're a team of 40 evaluating ways to automate inbound RFP triage and want pricing for a pilot this week.",
      output: {
        company: "Northwind Logistics",
        contact: "Maya Chen",
        role: "CTO",
        ask: "Pricing for a pilot to automate inbound RFP triage",
        signals: ["mentions_budget", "mentions_team_size", "urgency"],
        source: "linkedin",
      },
    },
  ] as FewShot<string, ExtractedLead>[],
};

export const qualifyPrompt = {
  system: [
    "You score an inbound lead on a 1-5 fit scale and recommend the next action.",
    "Return strict JSON matching the schema.",
    "Score interpretation: 1-2 = poor fit / send resources only; 3 = ask qualifying questions before booking time; 4-5 = book a discovery call.",
    "Weight signals: budget + urgency + senior role push the score up; competitive context pushes it down.",
    "`rationale` is a single short sentence explaining the score in plain language.",
  ].join(" "),
  fewShots: [
    {
      input: {
        company: "Northwind Logistics",
        contact: "Maya Chen",
        role: "CTO",
        ask: "Pricing for a pilot to automate inbound RFP triage",
        signals: ["mentions_budget", "mentions_team_size", "urgency"],
        source: "linkedin",
      },
      output: {
        score: 5,
        recommendedAction: "Schedule a 30-minute discovery call this week.",
        rationale: "Senior buyer with budget intent and explicit urgency on a use case we serve.",
      },
    },
  ] as FewShot<ExtractedLead, Qualification>[],
};

export const draftPrompt = {
  system: [
    "You draft a short reply email to an inbound lead.",
    "Match tone to the qualification score: warm + booking ask for 4-5; two clarifying questions for 3; resources-only for 1-2.",
    "Always sign off as Swedenmark. Keep the body under 120 words. Return strict JSON with `subject` and `body`.",
  ].join(" "),
  fewShots: [
    {
      input: {
        fields: {
          company: "Northwind Logistics",
          contact: "Maya Chen",
          role: "CTO",
          ask: "Pricing for a pilot to automate inbound RFP triage",
          signals: ["mentions_budget", "mentions_team_size", "urgency"],
          source: "linkedin",
        },
        qualification: {
          score: 5,
          recommendedAction: "Schedule a 30-minute discovery call this week.",
          rationale: "Senior buyer with budget intent and explicit urgency on a use case we serve.",
        },
      },
      output: {
        subject: "Re: Pricing for a pilot to automate inbound RFP triage",
        body: "Hi Maya,\n\nThanks for reaching out about Northwind Logistics. RFP triage is a use case we have a clean pilot path for. Happy to walk through pricing on a 30-minute call this week — does Tuesday or Thursday afternoon work?\n\nBest,\nSwedenmark",
      },
    },
  ] as FewShot<{ fields: ExtractedLead; qualification: Qualification }, Draft>[],
};
