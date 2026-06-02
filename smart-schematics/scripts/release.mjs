#!/usr/bin/env node
// One-command release. Run from the smart-schematics/ directory:
//
//   npm run release -- patch        # 0.0.3 -> 0.0.4
//   npm run release -- minor        # 0.0.3 -> 0.1.0
//   npm run release -- major        # 0.0.3 -> 1.0.0
//   npm run release -- 1.2.3        # explicit version
//
// It runs tests, bumps the version everywhere, stamps the CHANGELOG's
// [Unreleased] section, then commits, tags, and pushes — which triggers the
// GitHub Actions release build and auto-publish. Write your notes under
// "## [Unreleased]" in CHANGELOG.md *before* releasing.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const appDir = process.cwd() // smart-schematics/

const run = (cmd, cwd = appDir) =>
  execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const stream = (cmd, cwd = appDir) => execSync(cmd, { cwd, stdio: 'inherit' })
const die = (msg) => {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

const repoRoot = run('git rev-parse --show-toplevel')

// ── Resolve target version ────────────────────────────────────────────────
const arg = process.argv[2]
if (!arg) die('Usage: npm run release -- <patch|minor|major|X.Y.Z>')

const pkgPath = `${appDir}/package.json`
const cur = JSON.parse(readFileSync(pkgPath, 'utf8')).version
const [maj, min, pat] = cur.split('.').map(Number)

let next
if (arg === 'patch') next = `${maj}.${min}.${pat + 1}`
else if (arg === 'minor') next = `${maj}.${min + 1}.0`
else if (arg === 'major') next = `${maj + 1}.0.0`
else if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg
else die(`Invalid version "${arg}". Use patch | minor | major | X.Y.Z`)

const tag = `v${next}`
console.log(`\n▶ Releasing ${cur} → ${next}\n`)

// ── Preconditions ─────────────────────────────────────────────────────────
const branch = run('git rev-parse --abbrev-ref HEAD')
if (branch !== 'main') die(`Must be on main (currently on "${branch}").`)
if (run('git status --porcelain')) die('Working tree is not clean — commit or stash first.')

run('git fetch origin main')
if (run('git rev-list --count HEAD..origin/main') !== '0')
  die('Local main is behind origin/main — pull first.')

if (run('git tag --list').split('\n').includes(tag))
  die(`Tag ${tag} already exists.`)

// ── Lockfile must be in sync (CI runs `npm ci`, which is strict) ──────────
// Refreshes only the lockfile; if that produces a diff, the committed lock was
// out of sync and would break the CI build — bail so it gets committed first.
run('npm install --package-lock-only')
if (run(`git -C "${repoRoot}" status --porcelain smart-schematics/package-lock.json`))
  die('package-lock.json was out of sync — refreshed it. Commit the change, then re-run release.')

// ── Tests must pass before we touch anything ──────────────────────────────
console.log('▶ Running tests…\n')
stream('npm run test:run')

// ── Stamp the CHANGELOG ───────────────────────────────────────────────────
const clPath = `${repoRoot}/CHANGELOG.md`
let cl = readFileSync(clPath, 'utf8')
const head = '## [Unreleased]'
const start = cl.indexOf(head)
if (start === -1) die('No "## [Unreleased]" section in CHANGELOG.md.')

const bodyStart = start + head.length
const nextSection = cl.indexOf('\n## [', bodyStart)
const bodyEnd = nextSection === -1 ? cl.length : nextSection
const body = cl.slice(bodyStart, bodyEnd).trim()
if (!body)
  die('The [Unreleased] section is empty — add release notes there first.')

const today = new Date().toISOString().slice(0, 10)
const block = `${head}\n\n## [${next}] - ${today}\n\n${body}\n`
cl = cl.slice(0, start) + block + cl.slice(bodyEnd)
writeFileSync(clPath, cl)
console.log('\n✓ CHANGELOG.md stamped')

// ── Bump version in all the places that carry it ──────────────────────────
const bump = (path, re, replacement) => {
  const s = readFileSync(path, 'utf8')
  if (!re.test(s)) die(`Could not find a version to bump in ${path}`)
  writeFileSync(path, s.replace(re, replacement))
}
bump(pkgPath, /("version":\s*")[\d.]+(")/, `$1${next}$2`)
bump(`${appDir}/src-tauri/tauri.conf.json`, /("version":\s*")[\d.]+(")/, `$1${next}$2`)
bump(`${appDir}/src-tauri/Cargo.toml`, /^version = "[\d.]+"/m, `version = "${next}"`)
bump(
  `${appDir}/src-tauri/Cargo.lock`,
  /(name = "app"\nversion = ")[\d.]+(")/,
  `$1${next}$2`,
)
console.log('✓ Bumped package.json, tauri.conf.json, Cargo.toml, Cargo.lock')

// Keep the npm lockfile's version in sync with package.json (it carries its own
// "version" field). Without this it drifts a version behind every release and
// trips the lockfile precondition on the next run.
run('npm install --package-lock-only')
console.log('✓ Synced package-lock.json')

// ── Commit, tag, push ─────────────────────────────────────────────────────
run(`git -C "${repoRoot}" add -A`)
run(`git -C "${repoRoot}" commit -m "Release ${tag}"`)
run(`git -C "${repoRoot}" tag -a ${tag} -m "Smart Schematics ${tag}"`)
console.log(`✓ Committed and tagged ${tag}\n`)

stream(`git -C "${repoRoot}" push origin main`)
stream(`git -C "${repoRoot}" push origin ${tag}`)

const repo = run('git config --get remote.origin.url')
  .replace(/^git@github\.com:/, '')
  .replace(/^https:\/\/github\.com\//, '')
  .replace(/\.git$/, '')
console.log(`\n✅ ${tag} pushed. CI is building and will auto-publish:`)
console.log(`   https://github.com/${repo}/actions\n`)
