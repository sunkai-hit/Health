import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const filename=resolve('.dev.vars');
const newKey=()=>randomBytes(32).toString('base64');
if (!existsSync(filename)) {
  writeFileSync(filename,
    'DEMO_MODE=local\nDEMO_KEY_BASE64='+newKey()+'\nDEMO_AUTH_SECRET_BASE64='+newKey()+'\n',
    {mode:0o600,flag:'wx'});
  console.log('Created local synthetic-demo secrets; never commit .dev.vars.');
}else{
  const current=readFileSync(filename,'utf8');
  if(!/^DEMO_MODE=local$/m.test(current) || !/^DEMO_KEY_BASE64=.{20,}$/m.test(current)) {
    throw new Error('Existing .dev.vars is incomplete. Review it manually; secrets not overwritten.');
  }
  if(!/^DEMO_AUTH_SECRET_BASE64=.{20,}$/m.test(current)) {
    appendFileSync(filename,(current.endsWith('\n')?'':'\n')+'DEMO_AUTH_SECRET_BASE64='+newKey()+'\n');
    console.log('Added new S2 local demo token signing key; data encryption key preserved.');
  }else {
    console.log('.dev.vars exists with both keys; no secrets overwritten.');
  }
  chmodSync(filename,0o600);
}
