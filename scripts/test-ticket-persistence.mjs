import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Explicitly authorized local Docker only. Never consumes DATABASE_URL or .env.
// Separate databases, synthetic fixtures, no DROP/TRUNCATE or production access.
const container = 'cifradesk-local-postgres-1';
const user = 'cifradesk';
const red = process.argv.includes('--red');
const exec = promisify(execFile);
const root = new URL('../packages/database/prisma/migrations/', import.meta.url);
const migrations = readdirSync(root).filter(name => /^\d/.test(name)).sort();
function args(db) {
  assert.match(db, /^tickets_test_[a-f0-9_]+$/);
  return ['exec', '-i', container, 'psql', '-X', '-U', user, '-d', db, '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
}
function sql(db, statement) {
  return execFileSync('docker', args(db), { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function reject(db, statement, code) {
  assert.throws(() => sql(db, statement), error => String(error.stderr).includes(code));
}
const identity = `
INSERT INTO "User" (id,name,email,"updatedAt") VALUES ('synthetic-creator','Nome original','creator@example.test',now()),('synthetic-assignee','Responsável','assignee@example.test',now());
INSERT INTO "Department" (id,name,"updatedAt") VALUES ('00000000-0000-4000-8000-000000000001','Origem',now()),('00000000-0000-4000-8000-000000000002','Destino',now());
INSERT INTO "DepartmentMembership" ("userId","departmentId") VALUES ('synthetic-creator','00000000-0000-4000-8000-000000000001');`;
function insert(id = randomUUID(), title = 'Chamado sintético') {
  return `INSERT INTO "Ticket" (id,title,description,"createdById","requestedFor","requesterName","originDepartmentId","originDepartmentName","departmentId","updatedAt") VALUES ('${id}','${title}','Descrição sintética','synthetic-creator','SELF','Nome original','00000000-0000-4000-8000-000000000001','Origem','00000000-0000-4000-8000-000000000002',now()) RETURNING number;`;
}

for (const mode of ['fresh', 'upgrade']) {
  const db = `tickets_test_${randomUUID().replaceAll('-', '')}`;
  // Name is generated above, not user-controlled. Existing databases are untouched.
  execFileSync('docker', ['exec', container, 'createdb', '-U', user, db], { stdio: 'pipe' });
  console.log(`${mode}: ${db}`);
  sql(db, readFileSync(new URL(`${migrations[0]}/migration.sql`, root), 'utf8'));
  if (mode === 'upgrade') sql(db, identity);
  if (!red) {
    assert.ok(migrations.length > 1, 'Ticket migration is missing');
    for (const migration of migrations.slice(1)) sql(db, readFileSync(new URL(`${migration}/migration.sql`, root), 'utf8'));
  }
  if (mode === 'fresh') sql(db, identity);
  assert.equal(sql(db, 'SELECT count(*) FROM "User";'), '2');
  assert.equal(sql(db, 'SELECT count(*) FROM "DepartmentMembership";'), '1');
  const id = randomUUID();
  sql(db, insert(id));
  assert.equal(sql(db, `SELECT status || ':' || priority || ':' || version FROM "Ticket" WHERE id='${id}';`), 'OPEN:NORMAL:1');
  reject(db, insert(randomUUID(), 'curt'), '23514');
  reject(db, `UPDATE "Ticket" SET version=0 WHERE id='${id}';`, '23514');
  reject(db, `UPDATE "Ticket" SET "createdById"='missing' WHERE id='${id}';`, '23503');
  reject(db, `UPDATE "Ticket" SET "departmentId"='00000000-0000-4000-8000-000000000099' WHERE id='${id}';`, '23503');
  const assignee = `INSERT INTO "TicketAssignee" ("ticketId","userId","assignedById") VALUES ('${id}','synthetic-assignee','synthetic-creator');`;
  sql(db, assignee);
  reject(db, assignee, '23505');
  reject(db, `DELETE FROM "User" WHERE id='synthetic-creator';`, '23503');
  reject(db, `DELETE FROM "Department" WHERE id='00000000-0000-4000-8000-000000000002';`, '23503');
  sql(db, `UPDATE "User" SET name='Nome atual' WHERE id='synthetic-creator'; UPDATE "Department" SET name='Nome atual' WHERE id='00000000-0000-4000-8000-000000000001';`);
  assert.equal(sql(db, `SELECT "requesterName" || ':' || "originDepartmentName" FROM "Ticket" WHERE id='${id}';`), 'Nome original:Origem');
  sql(db, `UPDATE "Ticket" SET "dueDate"='2000-01-01' WHERE id='${id}';`);
  assert.equal(sql(db, `SET TIME ZONE 'Pacific/Auckland'; SELECT "dueDate" FROM "Ticket" WHERE id='${id}';`).split('\n').at(-1), '2000-01-01');
  const activity = ticketId => `INSERT INTO "TicketActivity" (id,"ticketId","authorId",action,"ticketVersion",changes,visibility) VALUES ('${randomUUID()}','${ticketId}','synthetic-creator','ticket.created',1,'{}','SHARED');`;
  const event = `INSERT INTO "OutboxEvent" (id,"ticketId",type,"contractVersion",payload) VALUES ('${randomUUID()}','${id}','ticket.created.v1',1,'{}');`;
  sql(db, `BEGIN; ${activity(id)} ${event} COMMIT;`);
  assert.equal(sql(db, 'SELECT count(*) FROM "TicketActivity";'), '1');
  assert.equal(sql(db, 'SELECT count(*) FROM "OutboxEvent";'), '1');
  const rolledBack = randomUUID();
  reject(db, `BEGIN; ${insert(rolledBack)} ${activity(rolledBack)} INSERT INTO "OutboxEvent" (id,"ticketId",type,"contractVersion",payload) VALUES ('${randomUUID()}','${rolledBack}','ticket.created.v1',0,'{}'); COMMIT;`, '23514');
  assert.equal(sql(db, `SELECT count(*) FROM "Ticket" WHERE id='${rolledBack}';`), '0');
  assert.equal(sql(db, 'SELECT count(*) FROM "TicketActivity";'), '1');
  assert.equal(sql(db, 'SELECT count(*) FROM "OutboxEvent";'), '1');
  const attachment = randomUUID();
  sql(db, `INSERT INTO "TicketAttachment" (id,"ticketId","uploadedById","originalName","objectKey","mimeType",size,"updatedAt") VALUES ('${attachment}','${id}','synthetic-creator','arquivo.pdf','private/synthetic','application/pdf',100,now());`);
  assert.equal(sql(db, `SELECT status FROM "TicketAttachment" WHERE id='${attachment}';`), 'PENDING_UPLOAD');
  for (const state of ['AVAILABLE', 'FAILED', 'PENDING_DELETION']) sql(db, `UPDATE "TicketAttachment" SET status='${state}' WHERE id='${attachment}';`);
  reject(db, `UPDATE "TicketAttachment" SET size=20971521 WHERE id='${attachment}';`, '23514');
  reject(db, `UPDATE "TicketAttachment" SET size=0 WHERE id='${attachment}';`, '23514');
  reject(db, `UPDATE "TicketAttachment" SET "mimeType"='application/zip' WHERE id='${attachment}';`, '23514');
  for (const table of ['TicketAssignee', 'TicketActivity', 'TicketAttachment', 'OutboxEvent']) {
    reject(db, `UPDATE "${table}" SET "ticketId"='${randomUUID()}';`, '23503');
  }
  reject(db, `UPDATE "TicketActivity" SET visibility='PUBLIC';`, '22P02');
  reject(db, `DELETE FROM "Ticket" WHERE id='${id}';`, '23503');
  const results = await Promise.all(Array.from({ length: 12 }, () => exec('docker', [...args(db), '-c', insert()])));
  const numbers = results.map(result => result.stdout.trim().split('\n')[0]);
  assert.equal(new Set(numbers).size, 12);
  reject(db, `UPDATE "Ticket" SET number=${numbers[0]} WHERE id='${id}';`, '23505');
  console.log(`${mode}: defaults, constraints, references, snapshots, dates, attachments, transaction rollback and 12 concurrent inserts passed`);
}
