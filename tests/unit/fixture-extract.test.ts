import { describe, expect, it } from "vitest";
import { fixtureExtract } from "../../src/engine/adapters";

describe("fixtureExtract company-name regex", () => {
  it("stops at the period after the company name (Northwind regression)", () => {
    const fields = fixtureExtract(
      "Hi, I'm Maya Chen, CTO at Northwind Logistics. Saw your demo on LinkedIn.",
    );
    expect(fields.company).toBe("Northwind Logistics");
  });

  it("stops at a comma between company and qualifier", () => {
    const fields = fixtureExtract(
      "Hello — I'm Sam from Globex Corp, the leading cogs supplier. Looking for a pilot.",
    );
    expect(fields.company).toBe("Globex Corp");
  });

  it("stops at a newline between company and the next sentence", () => {
    const fields = fixtureExtract(
      "Hi, I'm Priya Patel from Initech Systems\nWe need help triaging RFPs this week.",
    );
    expect(fields.company).toBe("Initech Systems");
  });

  it("captures company in the trailing 'team' shape", () => {
    const fields = fixtureExtract(
      "Hello there — Acme Robotics team here. We are evaluating new vendors.",
    );
    expect(fields.company).toBe("Acme Robotics");
  });

  it("falls back to 'Unknown Co' when no company pattern is present", () => {
    const fields = fixtureExtract("Just curious what you do — please send pricing.");
    expect(fields.company).toBe("Unknown Co");
  });
});
