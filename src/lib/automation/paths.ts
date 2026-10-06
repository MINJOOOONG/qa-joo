import { slugify } from "@/lib/domain/case-key";

/** Repository-relative spec path, e.g. `tests/reviewforge/RF-TC-001.spec.ts`. */
export function automationFilePath(projectName: string, caseKey: string): string {
  return `tests/${slugify(projectName)}/${caseKey}.spec.ts`;
}

/** Guards against path traversal when a runner materializes spec files on disk. */
export function isSafeSpecPath(filePath: string): boolean {
  return /^tests\/[a-z0-9-]+\/[A-Z0-9-]+\.spec\.ts$/.test(filePath);
}
