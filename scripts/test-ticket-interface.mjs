import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Same synthetic-only setup as the query runner. No application credentials.
const name = `tickets37_test_${randomBytes(10).toString('hex')}`;
const password = randomBytes(32).toString('hex');
const messages = process.argv.includes('--messages');
const storage = messages || process.argv.includes('--all');
const grepIndex = process.argv.indexOf('--grep');
function sql(db, input) {
  execFileSync('docker', ['exec', '-i', 'cifradesk-local-postgres-1', 'psql', '-X', '-U', 'cifradesk', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input, stdio: ['pipe', 'pipe', 'pipe'] });
}
sql('postgres', `CREATE ROLE ${name} LOGIN PASSWORD '${password}'; CREATE DATABASE ${name} OWNER ${name};`);
const root = new URL('../packages/database/prisma/migrations/', import.meta.url);
for (const migration of readdirSync(root).filter(value => /^\d/.test(value)).sort()) sql(name, `SET ROLE ${name};\n` + readFileSync(new URL(`${migration}/migration.sql`, root), 'utf8'));
const runner = `
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {openSync, closeSync, cpSync, existsSync, readdirSync} from 'node:fs';
let input=''; for await(const chunk of process.stdin) input+=chunk;
const env={...process.env,...JSON.parse(input),HOSTNAME:'127.0.0.1',PORT:'3317'};
if(env.TICKET_UI_STORAGE==='1') {
  if(env.S3_ENDPOINT!=='http://seaweedfs:8333'||!/^messages45-test-[a-f0-9]+$/.test(env.S3_BUCKET)) throw new Error('Local synthetic storage required.');
  const require=createRequire('/workspace/packages/infrastructure/package.json');
  const {S3Client,CreateBucketCommand}=require('@aws-sdk/client-s3');
  const client=new S3Client({endpoint:env.S3_ENDPOINT,region:'us-east-1',forcePathStyle:true,
    credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}});
  try { await client.send(new CreateBucketCommand({Bucket:env.S3_BUCKET,ACL:'private'})); }
  finally { client.destroy(); }
  const anonymous=await fetch(env.S3_ENDPOINT+'/'+env.S3_BUCKET,{signal:AbortSignal.timeout(10000)});
  if(anonymous.status!==403) throw new Error('Synthetic bucket must reject anonymous access.');
}
const standalone='/workspace/apps/web/.next/standalone/apps/web';
if(!existsSync(standalone+'/server.js')) throw new Error('Run pnpm build before the UI suite.');
cpSync('/workspace/apps/web/.next/static',standalone+'/.next/static',{recursive:true});
if(existsSync('/workspace/apps/web/public')) cpSync('/workspace/apps/web/public',standalone+'/public',{recursive:true});
const log=openSync('/workspace/.local/ticket-interface-server.log','w');
const server=spawn('node',[standalone+'/server.js'],{env,stdio:['ignore',log,log],detached:true});
try {
  let ready=false;
  for(let attempt=0;attempt<180;attempt++) {
    if(server.exitCode!==null) throw new Error('Synthetic server exited; inspect local server log.');
    try { const response=await fetch(env.E2E_BASE_URL+'/api/health'); if(response.ok){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready) throw new Error('Synthetic server startup timed out.');
  // Warm the local production build before measuring browser interactions.
  for (const path of ['/api/auth/get-session','/login','/requests/new','/requests','/departments','/requests/00000000-0000-4000-8000-000000000001','/api/tickets/options','/api/tickets/mine','/api/tickets/queue','/api/tickets/00000000-0000-4000-8000-000000000001','/api/tickets/00000000-0000-4000-8000-000000000001/activities','/api/tickets/00000000-0000-4000-8000-000000000001/attachments']) {
    await fetch(env.E2E_BASE_URL+path, {signal: AbortSignal.timeout(180000)});
  }
  for (const path of ['/api/tickets','/api/tickets/00000000-0000-4000-8000-000000000001/operations/status']) {
    await fetch(env.E2E_BASE_URL+path,{method:'POST',signal:AbortSignal.timeout(180000)});
  }
  // Record traces on Linux; copying finished artifacts avoids per-event bind-mount IO.
  const output='/tmp/ticket-ui-results-'+process.pid;
  const report='/tmp/ticket-ui-report-'+process.pid;
  // HMR requires next dev; it is a separate smoke, not a production-build test.
  const selection=env.TICKET_UI_MESSAGES==='1'?['tests/e2e/ticket-messages.spec.ts']:env.TICKET_UI_ALL==='1'
    ?readdirSync('/workspace/tests/e2e').filter(name=>name.endsWith('.spec.ts')&&name!=='dev-hmr.spec.ts').sort().map(name=>'tests/e2e/'+name)
    :['tests/e2e/tickets.spec.ts'];
  const tests=spawn('pnpm',['exec','playwright','test',...selection,...(env.TICKET_UI_GREP?['--grep',env.TICKET_UI_GREP]:[]),'--workers=1','--output',output],{env:{...env,PLAYWRIGHT_HTML_OUTPUT_DIR:report},stdio:'inherit'});
  process.exitCode=await new Promise(resolve=>tests.on('exit',code=>resolve(code??1)));
  if(existsSync(output)) cpSync(output,'/workspace/.local/ticket-ui-results-'+process.pid,{recursive:true});
  if(existsSync(report)) cpSync(report,'/workspace/.local/ticket-ui-report-'+process.pid,{recursive:true});
} finally { try { process.kill(-server.pid,'SIGTERM'); } catch {} closeSync(log); }
`;
console.log(`Synthetic database: ${name}`);
const result = spawnSync('docker', ['exec', '-i', 'cifradesk-etapa34-tools', 'node', '--input-type=module', '-e', runner], {
  input: JSON.stringify({ DATABASE_URL: `postgresql://${name}:${password}@postgres:5432/${name}`, TICKET_UI_TEST_DATABASE: '1', TICKET_UI_ALL: process.argv.includes('--all') ? '1' : '0', TICKET_UI_MESSAGES: messages ? '1' : '0', TICKET_UI_STORAGE: storage ? '1' : '0', TICKET_UI_GREP: grepIndex < 0 ? '' : process.argv[grepIndex + 1], SMTP_HOST: 'identity-mailpit', SMTP_PORT: '1025', SMTP_FROM: 'CifraDesk <noreply@cifradesk.local>', BETTER_AUTH_URL: 'http://127.0.0.1:3317', E2E_BASE_URL: 'http://127.0.0.1:3317', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    ...(storage ? (() => {
      const config = JSON.parse(readFileSync(new URL('../.local/s3.json', import.meta.url), 'utf8'));
      const credential = config.identities.find(identity => identity.name === 'local-development')?.credentials[0];
      if (!credential) throw new Error('Credencial S3 local de teste indisponível.');
      return { S3_ENDPOINT: 'http://seaweedfs:8333', S3_BUCKET: `messages45-test-${name.slice(-20)}`, S3_ACCESS_KEY_ID: credential.accessKey, S3_SECRET_ACCESS_KEY: credential.secretKey };
    })() : {})
  }), stdio: ['pipe', 'inherit', 'inherit']
});
process.exit(result.status ?? 1);
