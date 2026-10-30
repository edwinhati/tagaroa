// Golden-prompt eval: does each prompt pull in the expected skill?
// Usage: [SKILL_EVAL_CAP=15] node scripts/skill-eval.mjs [runs=3] [substring-filter]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const runs = Number(process.argv[2] ?? 3);
const filter = process.argv[3] ?? "";
const cap = Number(process.env.SKILL_EVAL_CAP ?? 15);
const golden = JSON.parse(
  readFileSync(new URL("./skill-eval.golden.json", import.meta.url), "utf8"),
).filter((g) => g.prompt.includes(filter));

// Resolves with the first skill the agent invokes ("" if it finishes without one).
function firstSkill(prompt) {
  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      [
        "-p",
        prompt,
        "--output-format",
        "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--disallowedTools",
        "Edit",
        "Write",
        "NotebookEdit",
        "Bash",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let buf = "";
    let tools = 0;
    const done = (skill) => {
      child.kill();
      resolve(skill);
    };
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        for (const c of msg.message?.content ?? []) {
          if (c.type === "tool_use" && c.name === "Skill")
            return done(c.input.skill);
          // Skills load early; a run that has used `cap` other tools without one is a "none".
          if (c.type === "tool_use" && ++tools >= cap) return done("");
        }
      }
    });
    child.on("close", () => resolve(""));
  });
}

let failed = 0;
for (const { prompt, expect } of golden) {
  const picked = [];
  for (let i = 0; i < runs; i++) picked.push(await firstSkill(prompt));
  const ok = picked.filter((s) =>
    expect.length ? expect.includes(s) : s === "",
  ).length;
  if (ok < runs) failed++;
  console.log(
    `${ok}/${runs}  ${prompt.slice(0, 70)}\n       want [${expect}]  got [${picked.map((s) => s || "none")}]`,
  );
}
process.exit(failed ? 1 : 0);
