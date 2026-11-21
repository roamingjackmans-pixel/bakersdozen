// npm run balance: plays hundreds of AI nights per style and prints the balance report (docs/BALANCE.md).
import { spawnSync } from 'node:child_process';

const r = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/balance.test.ts'], { stdio: 'inherit', env: { ...process.env, BALANCE: '1' } });
process.exit(r.status ?? 1);
