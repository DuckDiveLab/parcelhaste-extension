// Claude Code PostToolUse hook: formats the file an Edit/Write tool call touched.
// Comfort only; `bun run check` remains the gate for every agent.
import { spawnSync } from "node:child_process";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  let file: unknown;
  try {
    file = (JSON.parse(input) as { tool_input?: { file_path?: unknown } }).tool_input?.file_path;
  } catch {
    return;
  }
  if (typeof file !== "string" || !/\.(ts|tsx|js|mjs|cjs|json|jsonc|css|html)$/.test(file)) {
    return;
  }
  spawnSync("bunx", ["biome", "format", "--write", "--no-errors-on-unmatched", file], {
    stdio: "inherit",
  });
});
