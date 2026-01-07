'use strict';

/**
 * Convenience script to call POST /api/demo/seed locally.
 *
 * Usage:
 *   DEMO_SEED_TOKEN="<supabase_access_token>" node scripts/seed-demo.js --count=75 --url=http://localhost:3001
 *
 * Env vars:
 * - DEMO_SEED_TOKEN (required): Supabase session access token
 * - DEMO_SEED_URL   (optional): base URL (default http://localhost:3001)
 */

const { setTimeout: sleep } = require('timers/promises');

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith('--count=')) args.count = a.split('=')[1];
    if (a.startsWith('--url=')) args.url = a.split('=')[1];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const baseUrl = process.env.DEMO_SEED_URL || args.url || 'http://localhost:3001';
  const token = process.env.DEMO_SEED_TOKEN;

  if (!token) {
    console.error('Missing DEMO_SEED_TOKEN env var.');
    process.exit(1);
  }

  const count = args.count ? Number(args.count) : undefined;

  // Small delay so local dev server has time to start if chained.
  await sleep(150);

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/demo/seed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(count ? { count } : {}),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`Request failed (${res.status}):`, body);
    process.exit(1);
  }

  console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
