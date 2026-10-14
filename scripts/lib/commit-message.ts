// Conventional Commits check used by the commit-msg hook and by CI.
// Mirrors @commitlint/config-conventional for the rules that matter here.

export const COMMIT_TYPES = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
] as const;

export const MAX_HEADER_LENGTH = 100;

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9._/-]+)\))?(?<breaking>!)?: (?<subject>\S.*)$/;
const AUTO_GENERATED = /^(Merge |Revert "|fixup! |squash! )/;

/** Returns the list of problems; an empty list means the message is valid. */
export function lintCommitMessage(message: string): string[] {
  const lines = message.split(/\r?\n/).filter((line) => !line.startsWith("#"));
  while (lines.length > 0 && (lines[0] ?? "").trim() === "") {
    lines.shift();
  }
  const header = lines[0] ?? "";
  if (header.trim() === "") {
    return ["commit message is empty"];
  }
  if (AUTO_GENERATED.test(header)) {
    return [];
  }

  const match = HEADER.exec(header);
  const type = match?.groups?.["type"];
  const subject = match?.groups?.["subject"];
  if (type === undefined || subject === undefined) {
    return [`header "${header}" must look like "type(scope)?: subject" (Conventional Commits)`];
  }

  const problems: string[] = [];
  if (!(COMMIT_TYPES as readonly string[]).includes(type)) {
    problems.push(`type "${type}" is not one of: ${COMMIT_TYPES.join(", ")}`);
  }
  if (header.length > MAX_HEADER_LENGTH) {
    problems.push(`header is ${header.length} characters, the maximum is ${MAX_HEADER_LENGTH}`);
  }
  if (subject.endsWith(".")) {
    problems.push("subject must not end with a period");
  }
  if (/^[A-Z]/.test(subject)) {
    problems.push("subject must not start with an uppercase letter");
  }
  const second = lines[1];
  if (second !== undefined && second.trim() !== "") {
    problems.push("the line after the header must be blank");
  }
  return problems;
}
