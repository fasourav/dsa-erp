import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const originalMigration = path.join(
  root,
  "supabase/migrations/20261106024500_atomic_save_vendor.sql",
)
const forwardMigration = path.join(
  root,
  "supabase/migrations/20261106024501_save_vendor_permission_denial.sql",
)
const rlsScript = path.join(root, "supabase/tests/save_vendor_permissions.sql")
const ORIGINAL_SHA256 =
  "eeb5e04309406741dbe7f0b07b87843f39a089685dc5ec06a328e10aa588e8a7"

function sha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function bin(name: string): string | null {
  const candidates = [`/usr/lib/postgresql/16/bin/${name}`, `/usr/bin/${name}`]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

const hasPostgres = bin("psql") != null && bin("initdb") != null && bin("pg_ctl") != null

test("atomic save_vendor migration file is unchanged", () => {
  assert.equal(sha256(originalMigration), ORIGINAL_SHA256)
})

test("forward save_vendor migration keeps invoker RLS and distinguishes edit denial", () => {
  const sql = fs.readFileSync(forwardMigration, "utf8")
  assert.match(sql, /security invoker/i)
  assert.match(sql, /grant execute on function public\.save_vendor/i)
  assert.match(sql, /from public, anon/)
  assert.match(sql, /You do not have permission to edit vendors\./)
  assert.match(sql, /You do not have permission to add vendors\./)
  assert.match(sql, /not private\.can\('vendors', 'edit'\)/)
  assert.match(sql, /not private\.can\('vendors', 'add'\)/)
  assert.match(sql, /errcode = 'P0002'/)
  assert.match(sql, /errcode = '40001'/)
  assert.match(sql, /for update/i)
  assert.match(sql, /pg_advisory_xact_lock/i)
  assert.match(sql, /not private\.is_owner\(\)/)
  assert.match(sql, /lower\(v_submitted_field\) = lower\(v_prev_trimmed\)/)
  assert.doesNotMatch(sql, /security definer/i)
})

test("direct save_vendor RLS cases on disposable Postgres", { skip: !hasPostgres }, () => {
  const psql = bin("psql")
  const initdb = bin("initdb")
  const pgCtl = bin("pg_ctl")
  const createdb = bin("createdb")
  if (!psql || !initdb || !pgCtl || !createdb) return

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sv-rls-"))
  const port = "55433"
  const logFile = path.join(dataDir, "server.log")
  const init = spawnSync(
    initdb,
    ["-D", dataDir, "--username=postgres", "--auth=trust", "--no-instructions"],
    { encoding: "utf8" },
  )
  assert.equal(init.status, 0, init.stderr)

  const start = spawnSync(
    pgCtl,
    [
      "-D",
      dataDir,
      "-l",
      logFile,
      "-o",
      `-p ${port} -k ${dataDir} -c listen_addresses=127.0.0.1`,
      "start",
    ],
    { encoding: "utf8" },
  )
  assert.equal(start.status, 0, `${start.stderr}\n${fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : ""}`)

  try {
    const created = spawnSync(
      createdb,
      ["-h", dataDir, "-p", port, "-U", "postgres", "svtest"],
      { encoding: "utf8" },
    )
    assert.equal(created.status, 0, created.stderr)
    const run = spawnSync(
      psql,
      [
        "-h",
        dataDir,
        "-p",
        port,
        "-U",
        "postgres",
        "-d",
        "svtest",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        rlsScript,
      ],
      { encoding: "utf8" },
    )
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`)
  } finally {
    spawnSync(pgCtl, ["-D", dataDir, "stop", "-m", "fast"], { encoding: "utf8" })
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
})
