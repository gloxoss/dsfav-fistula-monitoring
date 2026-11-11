import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

const startedProcesses = [];

function cleanup() {
  if (startedProcesses.length > 0) {
    console.log('\n[UP] Stopping processes started by up.mjs...');
    for (const child of startedProcesses) {
      try {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      } catch {}
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

export function checkPort(port, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolvePromise) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolvePromise(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolvePromise(false);
    });

    socket.connect(port, host);
  });
}

export async function checkHttp(url, timeoutMs = 1500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForHttp(url, name, maxRetries = 30, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkHttp(url)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${name} at ${url}`);
}

async function waitForPort(port, name, maxRetries = 20, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkPort(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${name} on port ${port}`);
}

export async function main() {
  console.log('====================================================');
  console.log('       DSFAV Demo Environment Startup               ');
  console.log('====================================================\n');

  // 1. Docker Postgres (5433)
  const pgPort = 5433;
  const pgIsUp = await checkPort(pgPort);
  if (pgIsUp) {
    console.log(`[UP] Postgres is already running on port ${pgPort}.`);
  } else {
    console.log(`[UP] Postgres not responding on port ${pgPort}. Starting via docker compose...`);
    const composeRes = spawnSync('docker', ['compose', 'up', '-d', 'postgres'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    if (composeRes.status !== 0) {
      throw new Error(`Failed to start Postgres with docker compose up -d postgres`);
    }
    await waitForPort(pgPort, 'PostgreSQL');
    console.log(`[UP] Postgres is ready on port ${pgPort}.`);
  }

  // 2. Apply Prisma migrations
  console.log('[UP] Applying Prisma migrations...');
  const apiDir = resolve(REPO_ROOT, 'apps/api-nestjs');
  const prismaBin = resolve(apiDir, 'node_modules/prisma/build/index.js');
  const migrateRes = spawnSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    cwd: apiDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PRISMA_HIDE_UPDATE_MESSAGE: 'true',
      CHECKPOINT_DISABLE: '1',
    },
  });
  if (migrateRes.status !== 0) {
    throw new Error('Failed to apply Prisma migrations.');
  }
  console.log('[UP] Prisma migrations applied.');

  // 3. DSP Service (port 8010)
  const dspUrl = 'http://localhost:8010/health';
  const dspIsUp = await checkHttp(dspUrl);
  if (dspIsUp) {
    console.log('[UP] DSP service is already running at http://localhost:8010.');
  } else {
    console.log('[UP] Starting DSP service on port 8010...');
    const dspDir = resolve(REPO_ROOT, 'apps/dsp-python');
    const dspProc = spawn('uv', ['run', 'uvicorn', 'dsfav_dsp.api:app', '--port', '8010'], {
      cwd: dspDir,
      stdio: 'ignore',
      windowsHide: true,
    });
    startedProcesses.push(dspProc);
    await waitForHttp(dspUrl, 'DSP service');
    console.log('[UP] DSP service is up at http://localhost:8010.');
  }

  // 4. API Service (port 3101)
  const apiUrl = 'http://localhost:3101/health';
  const apiIsUp = await checkHttp(apiUrl);
  if (apiIsUp) {
    console.log('[UP] API service is already running at http://localhost:3101.');
  } else {
    console.log('[UP] Building and starting API service on port 3101...');
    const distMain = resolve(apiDir, 'dist/main.js');
    if (!fs.existsSync(distMain)) {
      console.log('[UP] Building API service...');
      spawnSync('pnpm', ['--filter', '@dsfav/api', 'build'], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: true,
      });
    }
    const apiProc = spawn('node', ['dist/main.js'], {
      cwd: apiDir,
      env: { ...process.env, PORT: '3101' },
      stdio: 'ignore',
      windowsHide: true,
    });
    startedProcesses.push(apiProc);
    await waitForHttp(apiUrl, 'API service');
    console.log('[UP] API service is up at http://localhost:3101.');
  }

  // 5. Web App (port 3000)
  const webUrl = 'http://localhost:3000';
  const webIsUp = await checkHttp(webUrl);
  if (webIsUp) {
    console.log('[UP] Web app is already running at http://localhost:3000.');
  } else {
    console.log('[UP] Starting Next.js web app on port 3000...');
    const webDir = resolve(REPO_ROOT, 'apps/web-nextjs');
    const webProc = spawn('pnpm', ['exec', 'next', 'dev', '-p', '3000'], {
      cwd: webDir,
      stdio: 'ignore',
      shell: true,
      windowsHide: true,
    });
    startedProcesses.push(webProc);
    await waitForHttp(webUrl, 'Web app');
    console.log('[UP] Web app is up at http://localhost:3000.');
  }

  // 6. Print summary
  console.log('\n====================================================');
  console.log('              DSFAV SERVICES READY                  ');
  console.log('====================================================');
  console.log('Services:');
  console.log('  Web application:         http://localhost:3000');
  console.log('  Core REST/WS API:        http://localhost:3101');
  console.log('  Signal Processing (DSP): http://localhost:8010');
  console.log('  PostgreSQL database:     localhost:5433 (dsfav)');
  console.log('\nDemo User Accounts (Password: demo1234):');
  console.log('  nurse@dsfav.local        Infirmier     -> /capture');
  console.log('  nephro@dsfav.local       Néphrologue   -> /dashboard & /patients/PT-CAS-8841');
  console.log('  intern@dsfav.local       Interne       -> /training-bench');
  console.log('  admin@dsfav.local        Admin         -> /devices & /admin/audit');
  console.log('\nOne-Line Tour:');
  console.log('  Infirmier -> /capture (mesure 25 s), Néphrologue -> /dashboard & /patients/PT-CAS-8841 (tendance et alertes), Interne -> /training-bench (banc d\'apprentissage), Admin -> /devices (parc et calibration).');
  console.log('====================================================\n');

  if (startedProcesses.length > 0 && !process.argv.includes('--no-wait')) {
    console.log('[UP] Processes running. Press Ctrl+C to stop services started by this script.');
    await new Promise(() => {});
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  main().catch((err) => {
    console.error(`[UP ERROR] ${err.message}`);
    cleanup();
    process.exit(1);
  });
}
