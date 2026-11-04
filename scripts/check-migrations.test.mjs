import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-migrations.sh",
);
const dir = "servers/core/drizzle";

function repo() {
  const cwd = mkdtempSync(join(tmpdir(), "tagaroa-migrations-"));
  const git = (...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  mkdirSync(join(cwd, dir), { recursive: true });
  writeFileSync(join(cwd, dir, "0000_init.sql"), "create table a ();\n");
  git("add", "-A");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "pr");
  const commit = () => {
    git("add", "-A");
    git("commit", "-qm", "change");
  };
  const check = (base = "main") =>
    spawnSync("sh", [script, base], { cwd, encoding: "utf8" });
  return { cwd, commit, check };
}

test("a new migration passes", () => {
  const r = repo();
  writeFileSync(join(r.cwd, dir, "0001_next.sql"), "create table b ();\n");
  r.commit();
  assert.equal(r.check().status, 0);
});

test("editing an applied migration fails", () => {
  const r = repo();
  writeFileSync(join(r.cwd, dir, "0000_init.sql"), "create table a (x int);\n");
  r.commit();
  assert.equal(r.check().status, 1);
});

test("deleting an applied migration fails", () => {
  const r = repo();
  spawnSync("git", ["rm", "-q", `${dir}/0000_init.sql`], { cwd: r.cwd });
  r.commit();
  assert.equal(r.check().status, 1);
});

test("renaming an applied migration away from .sql fails", () => {
  const r = repo();
  renameSync(
    join(r.cwd, dir, "0000_init.sql"),
    join(r.cwd, dir, "0000_init.txt"),
  );
  r.commit();
  assert.equal(r.check().status, 1);
});

test("an unresolvable base ref fails instead of passing", () => {
  const r = repo();
  assert.notEqual(r.check("nonexistent").status, 0);
});
