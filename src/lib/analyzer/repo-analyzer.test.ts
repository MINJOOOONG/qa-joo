import { describe, expect, it } from "vitest";
import { parseGithubRepoUrl, routesFromTree } from "./repo-analyzer";
import { isSensitivePath, redactSecrets } from "./redact";

describe("repository analysis helpers", () => {
  it("parses GitHub URLs", () => {
    expect(parseGithubRepoUrl("https://github.com/MINJOOOONG/reviewforge-agentforge-seoul")).toEqual({ owner: "MINJOOOONG", repo: "reviewforge-agentforge-seoul" });
    expect(parseGithubRepoUrl("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(() => parseGithubRepoUrl("https://github.com/a")).toThrow();
  });

  it("maps Next.js app and pages router files to routes and API endpoints", () => {
    const { routes, apiEndpoints } = routesFromTree([
      "app/page.tsx",
      "app/homepage.tsx",
      "src/app/(app)/projects/[key]/page.tsx",
      "app/api/analyze-campaign/route.ts",
      "pages/index.tsx",
      "pages/about.tsx",
      "pages/_app.tsx",
      "pages/api/legacy.ts",
    ]);
    expect(routes).toEqual(["/", "/about", "/projects/[key]"]);
    expect(apiEndpoints).toEqual(["/api/analyze-campaign", "/api/legacy"]);
  });

  it("never forwards secrets", () => {
    const text = [
      "ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
      'const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";',
      "SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2lnbmF0dXJlLXZhbHVl",
      "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
    ].join("\n");
    const redacted = redactSecrets(text);
    expect(redacted).not.toMatch(/sk-ant-api03|ghp_abc|eyJhbGci|MIIE/);
    expect(redacted).toContain("[REDACTED");
  });

  it("skips sensitive files", () => {
    expect(isSensitivePath(".env")).toBe(true);
    expect(isSensitivePath("config/.env.production")).toBe(true);
    expect(isSensitivePath(".env.example")).toBe(false);
    expect(isSensitivePath("certs/server.pem")).toBe(true);
    expect(isSensitivePath("src/app/page.tsx")).toBe(false);
  });
});
