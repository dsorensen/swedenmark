import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "../../middleware";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("https://example.com/", { headers }) as unknown as Parameters<
    typeof middleware
  >[0];
}

describe("demo basic-auth middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op when no demo password is configured (local dev)", async () => {
    vi.stubEnv("DEMO_BASIC_AUTH_USER", "");
    vi.stubEnv("DEMO_BASIC_AUTH_PASSWORD", "");
    const res = await middleware(makeRequest());
    expect(res.status).toBe(200);
  });

  it("returns 401 with WWW-Authenticate when password is set and missing header", async () => {
    vi.stubEnv("DEMO_BASIC_AUTH_PASSWORD", "swordfish");
    const res = await middleware(makeRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("returns 401 when credentials are wrong", async () => {
    vi.stubEnv("DEMO_BASIC_AUTH_PASSWORD", "swordfish");
    const wrong = `Basic ${btoa("demo:nope")}`;
    const res = await middleware(makeRequest({ authorization: wrong }));
    expect(res.status).toBe(401);
  });

  it("passes through with correct default-user credentials", async () => {
    vi.stubEnv("DEMO_BASIC_AUTH_PASSWORD", "swordfish");
    const ok = `Basic ${btoa("demo:swordfish")}`;
    const res = await middleware(makeRequest({ authorization: ok }));
    expect(res.status).toBe(200);
  });

  it("respects a custom user", async () => {
    vi.stubEnv("DEMO_BASIC_AUTH_USER", "ceo");
    vi.stubEnv("DEMO_BASIC_AUTH_PASSWORD", "swordfish");
    const ok = `Basic ${btoa("ceo:swordfish")}`;
    const res = await middleware(makeRequest({ authorization: ok }));
    expect(res.status).toBe(200);
  });
});
