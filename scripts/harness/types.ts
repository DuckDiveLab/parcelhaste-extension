export interface Violation {
  /** Stable rule name, e.g. "agents-md-length". Tests assert on it. */
  rule: string;
  /** Repo-relative path with forward slashes. */
  file: string;
  message: string;
}

export type Check = (root: string) => Violation[];
