export interface FieldInfo {
  tag: "input" | "textarea" | "select";
  name: string | null;
  label: string | null;
  type: string;
  required: boolean;
  placeholder: string | null;
  /** Human-readable constraints, e.g. "maxlength=200", "type=url", "accept=image/*". */
  constraints: string[];
}

export interface FormInfo {
  name: string | null;
  action: string | null;
  method: string;
  fields: FieldInfo[];
  submitLabels: string[];
}

export interface PageInfo {
  url: string;
  path: string;
  title: string | null;
  description: string | null;
  headings: string[];
  internalLinks: string[];
  /** Same-origin links with their visible label (optional: older analyses lack it). */
  links?: Array<{ label: string; path: string }>;
  navLabels: string[];
  /**
   * Headings inside result/output regions (aria-live, role=status, <output>, id/class "result"),
   * i.e. what the page shows after its main action. Optional: older analyses lack it.
   */
  resultHeadings?: string[];
  buttons: string[];
  forms: FormInfo[];
  /** Inputs outside any <form> (common in client-side React apps). */
  looseFields: FieldInfo[];
  textSample: string;
  clientRendered: boolean;
}

export interface AppAnalysis {
  baseUrl: string;
  mode: "http" | "browser";
  pages: PageInfo[];
  warnings: string[];
}

export interface RepoFileExcerpt {
  path: string;
  excerpt: string;
}

export interface RepoAnalysis {
  url: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  framework: string | null;
  readme: string | null;
  routes: string[];
  apiEndpoints: string[];
  components: string[];
  keyFiles: RepoFileExcerpt[];
  hints: string[];
  warnings: string[];
}

export interface ProjectAnalysis {
  app: AppAnalysis | null;
  repo: RepoAnalysis | null;
  errors: Array<{ kind: "application" | "repository"; message: string }>;
}
