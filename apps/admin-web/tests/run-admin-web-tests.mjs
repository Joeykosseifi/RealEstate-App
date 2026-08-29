#!/usr/bin/env node
/**
 * Orchestrator for `npm run test:admin-web` — the committed, repeatable
 * admin-web regression suite (Milestone 5 audit, Phase 17).
 *
 * A plain `playwright test` isn't enough here because the suite needs a
 * real running API (Postgres/Redis-backed) and a real running admin-web
 * server, plus deterministic fixture data seeded through the actual
 * HTTP registration/verification/publication flow — not mocked. This
 * script:
 *   1. Boots the API in dev mode (so its console mail/SMS providers log
 *      verification tokens/OTPs to a file this script's global-setup
 *      step can read — see apps/api/src/mail/console-mail.provider.ts,
 *      "the sole place a verification link may become visible").
 *   2. Boots admin-web (prefers a production build if one exists, since
 *      that's what real moderators use; falls back to `next dev`).
 *   3. Waits for both to be reachable.
 *   4. Runs `playwright test` (which runs tests/global-setup.ts first to
 *      seed fixtures, then the specs).
 *   5. Always tears down both spawned servers, whatever the test result.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN_WEB_DIR = dirname(fileURLToPath(import.meta.url)) + '/..';
const API_DIR = join(ADMIN_WEB_DIR, '..', 'api');
const REPO_ROOT = join(ADMIN_WEB_DIR, '..', '..');
const LOG_DIR = join(ADMIN_WEB_DIR, 'tests', '.logs');
mkdirSync(LOG_DIR, { recursive: true });

/**
 * `apps/api`'s ConfigModule reads `.env` relative to its own process
 * cwd, but the repo's single `.env` lives at the repo root — so we load
 * it here and pass it through the child's `env` explicitly rather than
 * relying on dotenv to find it (works regardless of the spawned
 * process's cwd).
 */
function loadRootEnv() {
  const path = join(REPO_ROOT, '.env');
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[match[1]] = value;
  }
  return vars;
}

const ROOT_ENV = loadRootEnv();

const API_PORT = process.env.API_PORT ?? '3000';
const ADMIN_WEB_PORT = process.env.ADMIN_WEB_PORT ?? '3001';
const API_LOG_FILE = join(LOG_DIR, 'api.log');
const API_BASE_URL = `http://localhost:${API_PORT}`;
const ADMIN_WEB_BASE_URL = `http://localhost:${ADMIN_WEB_PORT}`;

const children = [];

function spawnServer(name, command, args, opts) {
  const logFd = openSync(join(LOG_DIR, `${name}.log`), 'w');
  const child = spawn(command, args, {
    ...opts,
    stdio: ['ignore', logFd, logFd],
    // `npm run start:dev`/`start` each spawn a nested `nest`/`next`
    // process; a SIGTERM to the npm process alone does not reach that
    // grandchild, leaving orphans bound to the ports across runs.
    // `detached: true` makes this child the leader of its own process
    // group, so killAll() below can signal the whole group at once.
    detached: true,
  });
  children.push(child);
  return child;
}

async function waitForReady(url, label, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become ready at ${url} within ${timeoutMs}ms`);
}

function killAll() {
  for (const child of children) {
    if (!child.killed) {
      try {
        // Negative pid == signal the whole detached process group
        // (npm + its nested nest/next child), not just the npm wrapper.
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  }
}

async function flushRateLimits() {
  // The suite drives real registration/login traffic through the real
  // Redis-backed rate limiter (see apps/api/src/rate-limit) — the same
  // protection production traffic gets, never weakened or bypassed for
  // this suite. Repeated local runs from the same IP would otherwise
  // exhaust that limiter across runs, so each run starts with a clean
  // counter state, exactly like the e2e suite's own `resetRateLimits`
  // test helper does per-test against its own Redis DB.
  await new Promise((resolve) => {
    const flush = spawn(
      'redis-cli',
      ['-u', ROOT_ENV.REDIS_URL ?? 'redis://localhost:6379', 'flushdb'],
      { stdio: 'ignore' },
    );
    flush.on('exit', () => resolve());
    flush.on('error', () => resolve());
  });
}

async function main() {
  await flushRateLimits();

  // 1. API — dev mode, so verification tokens/OTPs are logged (see
  // console-mail/sms providers). Uses the same DATABASE_URL/.env as
  // every other command in this repo.
  spawnServer('api', 'npm', ['run', 'start:dev'], {
    cwd: API_DIR,
    env: { ...ROOT_ENV, ...process.env, PORT: API_PORT, NODE_ENV: 'development' },
  });
  // The dev-mode Nest logger writes through stdout, which we redirected
  // to api.log above; global-setup.ts tails that same file. `/health` is
  // excluded from the global `api/v1` prefix (see main.ts), so it's the
  // most direct readiness check.
  await waitForReady(`${API_BASE_URL}/health`, 'API');

  // 2. admin-web — prefer a real production build (what moderators
  // actually use); fall back to `next dev` if none exists yet.
  const hasBuild = existsSync(join(ADMIN_WEB_DIR, '.next', 'BUILD_ID'));
  if (!hasBuild) {
    console.log('[test:admin-web] No production build found — building admin-web first…');
    await new Promise((resolve, reject) => {
      const build = spawn('npm', ['run', 'build'], {
        cwd: ADMIN_WEB_DIR,
        stdio: 'inherit',
        env: { ...process.env, NEXT_PUBLIC_API_URL: API_BASE_URL },
      });
      build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`admin-web build failed (${code})`))));
    });
  }
  spawnServer('admin-web', 'npm', ['run', 'start', '--', '-p', ADMIN_WEB_PORT], {
    cwd: ADMIN_WEB_DIR,
    env: { ...process.env, NEXT_PUBLIC_API_URL: API_BASE_URL },
  });
  await waitForReady(`${ADMIN_WEB_BASE_URL}/login`, 'admin-web');

  // 3. Run the suite.
  const exitCode = await new Promise((resolve) => {
    const test = spawn('npx', ['playwright', 'test'], {
      cwd: ADMIN_WEB_DIR,
      stdio: 'inherit',
      env: {
        ...ROOT_ENV,
        ...process.env,
        API_BASE_URL,
        ADMIN_WEB_BASE_URL,
        API_LOG_FILE,
      },
    });
    test.on('exit', (code) => resolve(code ?? 1));
  });

  process.exitCode = exitCode;
}

main()
  .catch((error) => {
    console.error('[test:admin-web]', error);
    process.exitCode = 1;
  })
  .finally(killAll);

process.on('SIGINT', () => {
  killAll();
  process.exit(130);
});
process.on('SIGTERM', () => {
  killAll();
  process.exit(143);
});
