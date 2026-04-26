import { expect, test } from "@playwright/test";

const SAMPLE_INBOUND = `Hi, I'm Dana Park, CTO at Helio Robotics. Saw your demo on LinkedIn.
We're a team of 30 evaluating ways to automate inbound RFP triage and want pricing for a pilot this week.`;

test("operator walks the lead-qualification journey end-to-end", async ({ page }) => {
  // 1. Intake page.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "New lead intake" })).toBeVisible();
  await page.getByLabel("Inbound message").fill(SAMPLE_INBOUND);
  await page.getByRole("button", { name: "Run" }).click();

  // 2. After redirect, run viewer shows the qualification gate active.
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("run-status")).toHaveText("awaiting human");
  const reviewStep = page.getByTestId("step-review_qualification");
  await expect(reviewStep).toHaveAttribute("data-status", "awaiting_human");

  // Sanity: extract step rendered with structured fields.
  const extractStep = page.getByTestId("step-extract");
  await expect(extractStep).toHaveAttribute("data-status", "completed");
  await expect(extractStep).toContainText("Helio Robotics");

  // 3. Approve qualification (edit one field to exercise the edited path).
  await reviewStep.getByLabel("Contact").fill("Dana Park (verified)");
  await reviewStep.getByTestId("approve-qualification").click();

  // 4. Reply gate becomes active; draft step is completed.
  const replyStep = page.getByTestId("step-approve_reply");
  await expect(replyStep).toHaveAttribute("data-status", "awaiting_human", { timeout: 10_000 });
  await expect(page.getByTestId("step-draft_reply")).toHaveAttribute("data-status", "completed");

  // 5. Approve reply (no edits).
  await replyStep.getByTestId("approve-reply").click();

  // 6. Run completes: dispatch confirmation visible, status badge flipped.
  await expect(page.getByTestId("dispatch-confirmation")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("run-status")).toHaveText("completed");

  // 7. Run history lists the run.
  await page.goto("/runs");
  await expect(page.getByRole("heading", { name: "Run history" })).toBeVisible();
  await expect(page.getByText("completed").first()).toBeVisible();
});
