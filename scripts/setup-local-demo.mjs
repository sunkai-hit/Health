import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filename = resolve('.dev.vars');
if (existsSync(filename)) {
  console.log('.dev.vars already exists; not overwriting local secrets.');
} else {
  const key = randomBytes(32).toString('base64');
  writeFileSync(filename, 'DEMO_MODE=local\nDEMO_KEY_BASE64='+key+'\n', {mode:0o600,flag:'wx'});
  console.log('Created local-only .dev.vars with a random AES key. Never commit this file.');
}
