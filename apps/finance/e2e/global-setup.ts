import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Load .env.test if it exists
const envTestPath = path.join(__dirname, "../.env.test");
if (fs.existsSync(envTestPath)) {
  const lines = fs.readFileSync(envTestPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const authFile = path.join(__dirname, ".auth/user.json");

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "TEST_EMAIL and TEST_PASSWORD must be set in environment variables or .env.test",
    );
  }

  await page.goto("http://localhost:3001/sign-in");

  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in with Credentials" }).click();

  await page.waitForURL("http://localhost:3004/**", { timeout: 30000 });

  await page.context().storageState({ path: authFile });
  await browser.close();
}

export default globalSetup;
