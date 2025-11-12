import fs from "node:fs";

const { SONAR_TOKEN = "ac17d897b28f370c4eb1c3ba9f0e1f1894269709", SONAR_PROJECT_KEY = "edwinhati_tagaroa" } = process.env;

if (!SONAR_TOKEN) {
  throw new Error("Missing SONAR_TOKEN environment variable");
}

const ps = 500;
let page = 1;
const all = [];

while (true) {
  const url = new URL("https://sonarcloud.io/api/issues/search");
  url.searchParams.set("componentKeys", SONAR_PROJECT_KEY);
  url.searchParams.set("ps", String(ps));
  url.searchParams.set("p", String(page));

  const res = await fetch(url, {
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SONAR_TOKEN}:`).toString("base64"),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const issues = data.issues ?? [];
  all.push(...issues);
  if (issues.length < ps) break;
  page++;
}

fs.writeFileSync("sonar_issues.json", JSON.stringify(all, null, 2));
console.log("Total issues:", all.length);
