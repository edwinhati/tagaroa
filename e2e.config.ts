import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

const mlx = createOpenAICompatible({
  name: "mlx",
  baseURL: "http://127.0.0.1:8081/v1",
});

const selected = process.env.QA_EXPLORATION_TARGET ?? "admin";
const targets = ["auth", "workspace", "admin"];
if (!targets.includes(selected))
  throw new Error("QA_EXPLORATION_TARGET must be auth, workspace or admin.");

export default {
  agents: {
    default: {
      model: mlx.chatModel("/Users/edwinhati/Models/Qwen3.5-9B-MLX-4bit"),
      providerOptions: {
        mlx: { chat_template_kwargs: { enable_thinking: false } },
      },
    },
  },
  tests: "tests/exploration/*.e2e.ts",
  workers: 1,
  retries: 0,
  video: "off",
  // Each run seeds one operator; switch targets in separate runs.
  targets: targets
    .map((name, index) => ({
      name,
      engine: web({
        initScripts: [
          () => {
            const install = () => {
              const style = document.createElement("style");
              style.textContent =
                "#impeccable-live-global-bar, #internal-devtools, button[aria-label='Open TanStack Devtools'] { display: none !important; }";
              document.head.append(style);
            };
            if (document.head) install();
            else
              document.addEventListener("DOMContentLoaded", install, {
                once: true,
              });
          },
        ],
      }),
      app: {
        url: `http://localhost:${13001 + index}`,
        readyUrl: "http://localhost:18080/api/health/live",
        command: {
          executable: "node",
          args: ["scripts/start-exploration.mjs"],
          log: ".e2e/stack.log",
          startupTimeout: 120000,
        },
      },
    }))
    .filter((target) => target.name === selected),
} satisfies E2EConfig;
