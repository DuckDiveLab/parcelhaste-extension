import { checkAgentsFiles, checkSkillFormat, checkSkillsMirror } from "./check-docs.ts";
import { checkFixtures } from "./check-fixtures.ts";
import { checkImports } from "./check-imports.ts";
import { checkBunfig, checkLockfiles, checkPackageManager } from "./check-packaging.ts";
import { checkSpecs } from "./check-specs.ts";
import { checkSuppressions } from "./check-suppressions.ts";
import type { Check, Violation } from "./types.ts";

export const CHECKS: readonly Check[] = [
  checkAgentsFiles,
  checkSkillsMirror,
  checkSkillFormat,
  checkSpecs,
  checkFixtures,
  checkSuppressions,
  checkLockfiles,
  checkBunfig,
  checkPackageManager,
  checkImports,
];

export function runAllChecks(root: string): Violation[] {
  return CHECKS.flatMap((check) => check(root));
}
