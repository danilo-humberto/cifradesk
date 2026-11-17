import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';

// Local Docker only. No application credentials, existing data or S3 access.
// Keep the synthetic databases for diagnosis, just like the stage 3 runners.
const root = new URL('../packages/database/prisma/migrations/', import.meta.url);
const migrations = readdirSync(root).filter(name => /^\d/.test(name)).sort();
const baseline = '202611130001_tickets';
const container = 'cifradesk-local-postgres-1';
const fixture = `
INSERT INTO "User" (id,name,email,status,"updatedAt") VALUES ('message-test-author','Autor sintético','message-author@example.test','ACTIVE',now());
INSERT INTO "Department" (id,name,"updatedAt") VALUES ('message-test-department','Setor sintético',now());
INSERT INTO "Ticket" (id,title,description,"createdById","requestedFor","requesterName","originDepartmentId","originDepartmentName","departmentId","updatedAt")
VALUES ('00000000-0000-4000-8000-000000000041','Chamado sintético','Descrição sintética','message-test-author','SELF','Autor sintético','message-test-department','Setor sintético','message-test-department',now()),
('00000000-0000-4000-8000-000000000042','Outro chamado','Descrição sintética','message-test-author','SELF','Autor sintético','message-test-department','Setor sintético','message-test-department',now());
INSERT INTO "TicketAttachment" (id,"ticketId","uploadedById","originalName","objectKey","mimeType",size,status,"updatedAt")
VALUES ('00000000-0000-4000-8000-000000000043','00000000-0000-4000-8000-000000000041','message-test-author','antigo.txt','synthetic/old','text/plain',3,'AVAILABLE',now());`;

for (const mode of process.argv.includes('--upgrade-only') ? ['upgrade'] : ['fresh', 'upgrade']) {
  const name = `messages41_test_${randomBytes(10).toString('hex')}`;
  const password = randomBytes(32).toString('hex');
  const admin = (db, input) => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'cifradesk', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  admin('postgres', `CREATE ROLE ${name} LOGIN PASSWORD '${password}'; CREATE DATABASE ${name} OWNER ${name};`);
  const sql = input => admin(name, `SET ROLE ${name};\n${input}`).replace(/^SET\r?\n/, '');
  const reject = (statement, code) => assert.throws(() => sql(statement), error => String(error.stderr).includes(code));
  assert.equal(sql('SELECT current_database() = current_user;'), 't');
  assert.equal(sql('SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user;'), 'f');
  console.log(`${mode}: ${name} (dedicated non-superuser role)`);
  for (const migration of migrations.filter(value => value <= baseline)) sql(readFileSync(new URL(`${migration}/migration.sql`, root), 'utf8'));
  if (mode === 'upgrade') sql(fixture);
  const previous = mode === 'upgrade' ? sql('SELECT to_jsonb(a) FROM "TicketAttachment" a;') : null;
  for (const migration of migrations.filter(value => value > baseline)) sql(readFileSync(new URL(`${migration}/migration.sql`, root), 'utf8'));
  if (mode === 'fresh') sql(fixture);
  // RED fails here because the new persistence model does not exist yet.
  assert.equal(sql(`SELECT to_regclass('public."TicketMessage"') IS NOT NULL;`), 't', 'TicketMessage migration is missing');
  if (previous) assert.deepEqual(JSON.parse(sql(`SELECT to_jsonb(a) - 'messageId' - 'removedAt' FROM "TicketAttachment" a;`)), JSON.parse(previous));
  assert.equal(sql('SELECT "messageId" IS NULL AND "removedAt" IS NULL FROM "TicketAttachment";'), 't');
  assert.equal(sql('SELECT count(*) FROM "User";'), '1');
  assert.equal(sql('SELECT count(*) FROM "Ticket";'), '2');

  const ticket = '00000000-0000-4000-8000-000000000041';
  const otherTicket = '00000000-0000-4000-8000-000000000042';
  const message = randomUUID();
  const otherMessage = randomUUID();
  const attachment = randomUUID();
  const revision = randomUUID();
  const insertMessage = (id, ticketId, markdown = 'Mensagem original') => `INSERT INTO "TicketMessage" (id,"ticketId","authorId",markdown,visibility,"updatedAt") VALUES ('${id}','${ticketId}','message-test-author','${markdown}','SHARED',now());`;
  sql(insertMessage(message, ticket));
  sql(insertMessage(otherMessage, otherTicket));
  assert.equal(sql(`SELECT version || ':' || ("deletedAt" IS NULL) FROM "TicketMessage" WHERE id='${message}';`), '1:true');
  reject(`UPDATE "TicketMessage" SET version=0 WHERE id='${message}';`, '23514');
  reject(insertMessage(randomUUID(), ticket, 'a'.repeat(10001)), '23514');
  sql(insertMessage(randomUUID(), ticket, 'a'.repeat(10000)));
  reject(`UPDATE "TicketMessage" SET "authorId"='missing' WHERE id='${message}';`, '23503');
  reject(insertMessage(randomUUID(), randomUUID()), '23503');
  reject(`UPDATE "TicketMessage" SET visibility='PUBLIC' WHERE id='${message}';`, '22P02');
  sql(`INSERT INTO "TicketAttachment" (id,"ticketId","messageId","uploadedById","originalName","objectKey","mimeType",size,status,"updatedAt") VALUES ('${attachment}','${ticket}','${message}','message-test-author','conversa.txt','synthetic/message','text/plain',3,'AVAILABLE',now());`);
  reject(`UPDATE "TicketAttachment" SET "messageId"='${otherMessage}' WHERE id='${attachment}';`, '23503');
  reject(`UPDATE "TicketMessage" SET "ticketId"='${otherTicket}' WHERE id='${message}';`, '23503');
  const snapshot = JSON.stringify([{ id: attachment, originalName: 'conversa.txt' }]);
  const insertRevision = (id, version, attachments = snapshot, markdown = 'Mensagem original') => `INSERT INTO "TicketMessageRevision" (id,"messageId",version,markdown,attachments) VALUES ('${id}','${message}',${version},'${markdown}','${attachments}');`;
  sql(insertRevision(revision, 1));
  reject(insertRevision(randomUUID(), 1), '23505');
  reject(insertRevision(randomUUID(), 0), '23514');
  reject(insertRevision(randomUUID(), 2, '{}'), '23514');
  reject(insertRevision(randomUUID(), 2, '[{}]'), '23514');
  reject(insertRevision(randomUUID(), 2, '[null]'), '23514');
  reject(insertRevision(randomUUID(), 2, JSON.stringify(Array(6).fill({ id: attachment, originalName: 'conversa.txt' }))), '23514');
  reject(insertRevision(randomUUID(), 2, snapshot, 'a'.repeat(10001)), '23514');
  reject(insertRevision(randomUUID(), 2, JSON.stringify([{ id: '00000000-0000-4000-8000-000000000043', originalName: 'antigo.txt' }])), '23514');
  reject(insertRevision(randomUUID(), 2, JSON.stringify([{ id: attachment, originalName: 'nome forjado' }])), '23514');
  reject(insertRevision(randomUUID(), 2, JSON.stringify(Array(2).fill({ id: attachment, originalName: 'conversa.txt' }))), '23514');
  reject(`UPDATE "TicketMessageRevision" SET markdown='Alterado' WHERE id='${revision}';`, '23514');
  reject(`UPDATE "TicketMessageRevision" SET attachments='[]' WHERE id='${revision}';`, '23514');
  reject(`DELETE FROM "TicketMessageRevision" WHERE id='${revision}';`, '23514');
  sql(`UPDATE "TicketAttachment" SET "removedAt"=now() WHERE id='${attachment}'; UPDATE "TicketMessage" SET markdown='Corrigida', version=2, "updatedAt"=now() WHERE id='${message}';`);
  reject(insertRevision(randomUUID(), 2), '23514');
  sql(insertRevision(randomUUID(), 2, '[]', 'Corrigida'));
  assert.equal(sql(`SELECT markdown FROM "TicketMessageRevision" WHERE id='${revision}';`), 'Mensagem original');
  assert.deepEqual(JSON.parse(sql(`SELECT attachments FROM "TicketMessageRevision" WHERE id='${revision}';`)), JSON.parse(snapshot));
  sql(`UPDATE "TicketMessage" SET "deletedAt"=now(),version=3 WHERE id='${message}';`);
  assert.equal(sql(`SELECT count(*) FROM "TicketMessageRevision" WHERE "messageId"='${message}';`), '2');
  assert.equal(sql(`SELECT sum(size) FROM "TicketAttachment" WHERE "ticketId"='${ticket}' AND status <> 'FAILED';`), '6');
  reject(`DELETE FROM "TicketMessage" WHERE id='${message}';`, '23503');
  assert.equal(sql(`SELECT count(*) FROM pg_indexes WHERE tablename='TicketMessage' AND indexdef LIKE '%("ticketId", visibility, "createdAt", id)%';`), '1');
  assert.equal(sql(`SELECT count(*) FROM pg_indexes WHERE tablename='TicketMessage' AND indexdef LIKE '%("ticketId", "createdAt", id)%';`), '1');
  console.log(`${mode}: preservation, references, snapshots, immutability, limits, soft deletion and pagination indexes passed`);

  const runner = `
    import {spawnSync} from 'node:child_process';
    let input=''; for await(const chunk of process.stdin) input+=chunk;
    const env={...process.env,...JSON.parse(input)};
    for (const args of [
      ['--filter','@cifradesk/database','exec','prisma','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'],
      ['exec','vitest','run','packages/infrastructure/src/message-persistence.integration.test.ts']
    ]) {
      const result=spawnSync('pnpm',args,{env,stdio:'inherit'});
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  `;
  const result = spawnSync('docker', ['exec', '-i', 'cifradesk-etapa34-tools', 'node', '--input-type=module', '-e', runner], {
    input: JSON.stringify({ DATABASE_URL: `postgresql://${name}:${password}@postgres:5432/${name}`, MESSAGE_PERSISTENCE_TEST_DATABASE: '1' }),
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
