import "server-only";
import { AppError } from "@/lib/errors";
import { safeFetch } from "@/lib/security/safe-fetch";
import { isSensitivePath, redactSecrets } from "./redact";
import type { RepoAnalysis, RepoFileExcerpt } from "./types";

const API = "https://api.github.com";
const MAX_FILE_BYTES = 40_000;
const MAX_EXCERPT_CHARS = 6_000;
const IGNORED_DIRS = /(^|\/)(node_modules|\.next|dist|build|out|coverage|vendor|\.git|public|assets|\.github)\//;

export function parseGithubRepoUrl(url: string): { owner: string; repo: string } {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(url.trim());
  if (!match) throw new AppError("validation", "Use a GitHub repository URL like https://github.com/owner/repo.");
  return { owner: match[1], repo: match[2] };
}

interface GithubClient {
  json<T>(path: string): Promise<T>;
  raw(path: string): Promise<string | null>;
}

function githubClient(token: string | undefined): GithubClient {
  const headers: Record<string, string> = { "x-github-api-version": "2022-11-28" };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    async json<T>(path: string) {
      const response = await safeFetch(`${API}${path}`, {
        allowPrivate: false,
        headers: { ...headers, accept: "application/vnd.github+json" },
        maxBytes: 5_000_000,
        timeoutMs: 15_000,
      });
      if (response.status === 404) throw new AppError("not_found", "Repository not found.");
      if (response.status === 403 || response.status === 429) {
        throw new AppError("upstream", "GitHub API rate limit reached. Set GITHUB_TOKEN to raise the limit.");
      }
      if (response.status >= 400) throw new AppError("upstream", `GitHub API returned HTTP ${response.status}.`);
      return JSON.parse(response.body) as T;
    },
    async raw(path: string) {
      const response = await safeFetch(`${API}${path}`, {
        allowPrivate: false,
        headers: { ...headers, accept: "application/vnd.github.raw+json" },
        maxBytes: MAX_FILE_BYTES,
        timeoutMs: 15_000,
      });
      if (response.status >= 400) return null;
      return response.body;
    },
  };
}

/** Maps Next.js App Router / Pages Router files to URL paths. */
export function routesFromTree(paths: string[]): { routes: string[]; apiEndpoints: string[] } {
  const routes = new Set<string>();
  const apiEndpoints = new Set<string>();
  const normalize = (segments: string[]) =>
    "/" +
    segments
      .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"))
      .join("/");
  for (const path of paths) {
    const appMatch = /^(?:src\/)?app\/(?:(.*)\/)?(page|route)\.(?:t|j)sx?$/.exec(path);
    if (appMatch) {
      const segmentsPart = appMatch[1] ?? "";
      const kind = appMatch[2];
      const url = normalize(segmentsPart ? segmentsPart.split("/") : []).replace(/\/$/, "") || "/";
      (kind === "route" ? apiEndpoints : routes).add(url);
      continue;
    }
    const pagesMatch = /^(?:src\/)?pages\/(.+)\.(?:t|j)sx?$/.exec(path);
    if (pagesMatch && !/(^|\/)_(app|document|error)$/.test(pagesMatch[1])) {
      const url = `/${pagesMatch[1].replace(/(^|\/)index$/, "")}`.replace(/\/$/, "") || "/";
      (url.startsWith("/api") ? apiEndpoints : routes).add(url);
    }
  }
  return { routes: Array.from(routes).sort(), apiEndpoints: Array.from(apiEndpoints).sort() };
}

const HINT_RULES: Array<[RegExp, string]> = [
  [/rate[\s_-]?limit|429/i, "Rate limiting is implemented"],
  [/timeout|AbortSignal\.timeout|ETIMEDOUT/i, "Requests use timeouts"],
  [/localhost|private (address|network)|ssrf|isPrivate/i, "Outbound URL / SSRF validation exists"],
  [/z\.string\(\)\.url|new URL\(|isValidUrl|type="url"/i, "URL inputs are validated"],
  [/z\.object\(|zod|yup|joi/i, "Request payloads are schema-validated"],
  [/upload|multipart|FormData|accept="image/i, "File or media upload flow exists"],
  [/max(Length|_length|imum)|\.max\(/i, "Length or size limits are enforced"],
  [/status:\s*5\d\d|500|Internal Server Error/i, "Server error responses are handled explicitly"],
  [/signIn|login|auth|session/i, "Authentication or session handling exists"],
  [/locale|i18n|ko|translation/i, "Multiple locales are supported"],
];

function deriveHints(files: RepoFileExcerpt[], readme: string | null): string[] {
  const corpus = [readme ?? "", ...files.map((file) => file.excerpt)].join("\n");
  return HINT_RULES.filter(([pattern]) => pattern.test(corpus)).map(([, hint]) => hint);
}

function detectFramework(pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null) {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  if (deps.next) return `Next.js ${deps.next}`;
  if (deps.nuxt) return "Nuxt";
  if (deps["@sveltejs/kit"]) return "SvelteKit";
  if (deps["@remix-run/react"] || deps["react-router"]) return "React Router / Remix";
  if (deps.vue) return "Vue";
  if (deps.react) return "React";
  if (deps.express) return "Express";
  if (deps.fastify) return "Fastify";
  return pkg ? "Node.js" : null;
}

/** Reads a public GitHub repository: metadata, README, routes, API endpoints and key source files. */
export async function analyzeRepository(repoUrl: string, options: { githubToken?: string }): Promise<RepoAnalysis> {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const github = githubClient(options.githubToken);
  const warnings: string[] = [];

  let meta: { private: boolean; default_branch: string; description: string | null; language: string | null };
  try {
    meta = await github.json(`/repos/${owner}/${repo}`);
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") {
      throw new AppError(
        "forbidden",
        "Repository not found or not public. QA JOO only reads public repositories and never accesses private ones.",
      );
    }
    throw error;
  }
  if (meta.private) {
    throw new AppError("forbidden", "This repository is private. QA JOO only analyzes public repositories.");
  }

  const tree = await github.json<{ tree: Array<{ path: string; type: string; size?: number }>; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`,
  );
  if (tree.truncated) warnings.push("Repository tree is large; only part of it was scanned.");
  const files = tree.tree
    .filter((entry) => entry.type === "blob" && !IGNORED_DIRS.test(entry.path) && !isSensitivePath(entry.path))
    .map((entry) => entry.path);

  const { routes, apiEndpoints } = routesFromTree(files);
  const components = files
    .filter((path) => /(^|\/)components\/.+\.(t|j)sx$/.test(path))
    .map((path) => path.split("/").pop()!.replace(/\.(t|j)sx$/, ""))
    .slice(0, 40);

  const [readmeRaw, packageRaw] = await Promise.all([
    github.raw(`/repos/${owner}/${repo}/readme`),
    files.includes("package.json") ? github.raw(`/repos/${owner}/${repo}/contents/package.json`) : Promise.resolve(null),
  ]);
  let pkg: Parameters<typeof detectFramework>[0] = null;
  try {
    pkg = packageRaw ? JSON.parse(packageRaw) : null;
  } catch {
    warnings.push("package.json could not be parsed.");
  }

  const priority = (path: string): number => {
    if (/(^|\/)app\/api\/.+\/route\.(t|j)s$/.test(path) || /(^|\/)pages\/api\//.test(path)) return 0;
    if (/(schema|validation|validator)s?\.(t|j)s$/.test(path)) return 1;
    if (/(^|\/)app\/(\(.*\)\/)?page\.(t|j)sx$/.test(path)) return 2;
    if (/(rate-limit|web-reader|http|security|auth)\.(t|j)s$/.test(path)) return 3;
    return 9;
  };
  const candidates = files
    .filter((path) => /\.(t|j)sx?$/.test(path) && priority(path) < 9)
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, 8);
  const keyFiles: RepoFileExcerpt[] = [];
  for (const path of candidates) {
    const content = await github.raw(`/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (content) keyFiles.push({ path, excerpt: redactSecrets(content).slice(0, MAX_EXCERPT_CHARS) });
  }

  const readme = readmeRaw ? redactSecrets(readmeRaw).slice(0, 12_000) : null;
  return {
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    defaultBranch: meta.default_branch,
    description: meta.description,
    language: meta.language,
    framework: detectFramework(pkg),
    readme,
    routes: routes.slice(0, 60),
    apiEndpoints: apiEndpoints.slice(0, 60),
    components,
    keyFiles,
    hints: deriveHints(keyFiles, readme),
    warnings,
  };
}
