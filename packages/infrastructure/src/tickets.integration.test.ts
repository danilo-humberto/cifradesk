import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { createTicket } from './tickets';
import { uploadAttachments, downloadAttachment, cleanupAttachments } from './ticket-attachments';
import type { AttachmentStorage } from './storage';
import { attachmentStorage } from './storage';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

const enabled = process.env.TICKETS_TEST_DATABASE === '1';
describe.skipIf(!enabled)('ticket PostgreSQL transactions and attachment lifecycle', () => {
  const db = enabled ? database() : undefined!;
  let actor: { id: string; authVersion: number };
  let origin: string;
  let destination: string;
  const input = () => ({ title: 'Ajuda sintética', description: 'Problema sintético para testes', requestedFor: 'SELF', originDepartmentId: origin, departmentId: destination });
  const file = { originalName: 'ajuda.txt', mimeType: 'text/plain', bytes: Buffer.from('Descrição sintética') };
  const objects = new Map<string, Buffer>();
  const storage: AttachmentStorage = {
    async put(key, bytes) { objects.set(key, bytes); },
    async get(key) { const bytes = objects.get(key); if (!bytes) throw new Error('Missing'); return bytes; },
    async remove(key) { objects.delete(key); }
  };
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL!);
    if (target.hostname !== 'postgres' || !/^\/tickets34_test_[a-f0-9]+$/.test(target.pathname)) throw new Error('Unsafe test database');
    actor = await db.user.create({ data: { id: randomUUID(), name: 'Criador sintético', email: randomUUID() + '@example.test', status: 'ACTIVE' } });
    origin = (await db.department.create({ data: { name: 'Origem sintética' } })).id;
    destination = (await db.department.create({ data: { name: 'Destino sintético' } })).id;
    await db.departmentMembership.create({ data: { userId: actor.id, departmentId: origin } });
  });
  afterAll(async () => { await db.$disconnect(); });
  it('persists one ticket, one shared activity and one outbox event; concurrent numbers are unique', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => createTicket(actor, input())));
    expect(new Set(results.map(t => t.number)).size).toBe(12);
    for (const ticket of results) {
      expect(await db.ticketActivity.count({ where: { ticketId: ticket.id, visibility: 'SHARED' } })).toBe(1);
      expect(await db.outboxEvent.count({ where: { ticketId: ticket.id, type: 'ticket.created.v1' } })).toBe(1);
    }
  });
  it.each(['TicketActivity', 'OutboxEvent'])('rolls back all records when %s insert fails', async table => {
    const counts = async () => Promise.all([db.ticket.count(), db.ticketActivity.count(), db.outboxEvent.count()]);
    const before = await counts();
    // Trigger is confined to the synthetic database and removed in finally.
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_ticket_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_ticket_write BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION fail_ticket_write()`);
    try { await expect(createTicket(actor, input())).rejects.toThrow(); expect(await counts()).toEqual(before); }
    finally {
      await db.$executeRawUnsafe(`DROP TRIGGER fail_ticket_write ON "${table}"`);
      await db.$executeRawUnsafe('DROP FUNCTION fail_ticket_write()');
    }
  });
  it('uploads privately and permits download only to creator or active destination members', async () => {
    const ticket = await createTicket(actor, input());
    const [attachment] = await uploadAttachments(actor, ticket.id, [file], storage);
    expect(attachment).not.toHaveProperty('objectKey');
    expect(Buffer.from((await downloadAttachment(actor, ticket.id, attachment!.id, storage)).bytes)).toEqual(file.bytes);
    const outsider = await db.user.create({ data: { id: randomUUID(), name: 'Outro', email: randomUUID() + '@example.test', status: 'ACTIVE', isAdmin: true } });
    await expect(downloadAttachment(outsider, ticket.id, attachment!.id, storage)).rejects.toMatchObject({ status: 404 });
    await expect(uploadAttachments(outsider, ticket.id, [file], storage)).rejects.toMatchObject({ status: 404 });
    await db.departmentMembership.create({ data: { userId: outsider.id, departmentId: destination } });
    await expect(downloadAttachment(outsider, ticket.id, attachment!.id, storage)).resolves.toBeDefined();
    await db.departmentMembership.delete({ where: { userId_departmentId: { userId: outsider.id, departmentId: destination } } });
    await expect(downloadAttachment(outsider, ticket.id, attachment!.id, storage)).rejects.toMatchObject({ status: 404 });
  });
  it('preserves the ticket and removes partial objects after upload failure', async () => {
    const ticket = await createTicket(actor, input());
    const failing: AttachmentStorage = { ...storage, async put(key, bytes) { objects.set(key, bytes); throw new Error('Synthetic upload failure'); } };
    await expect(uploadAttachments(actor, ticket.id, [file], failing)).rejects.toMatchObject({ status: 503 });
    expect(await db.ticket.count({ where: { id: ticket.id } })).toBe(1);
    const row = await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } });
    expect(row.status).toBe('PENDING_DELETION'); expect(objects.has(row.objectKey)).toBe(false);
    await expect(uploadAttachments(actor, ticket.id, [file], storage)).resolves.toHaveLength(1);
  });
  it('retains failed deletion as reserved capacity, then cleans it idempotently', async () => {
    const ticket = await createTicket(actor, input());
    const failing: AttachmentStorage = { ...storage, async put() { throw new Error('upload'); }, async remove() { throw new Error('delete'); } };
    await expect(uploadAttachments(actor, ticket.id, [file], failing)).rejects.toThrow();
    expect((await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } })).status).toBe('PENDING_DELETION');
    await db.ticketAttachment.updateMany({ where: { ticketId: ticket.id }, data: { updatedAt: new Date(0) } });
    await cleanupAttachments(storage);
    await cleanupAttachments(storage);
    expect((await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } })).status).toBe('FAILED');
  });
  it('reclaims abandoned reservations and blocks downloading incomplete uploads', async () => {
    const ticket = await createTicket(actor, input());
    const row = await db.ticketAttachment.create({ data: { ticketId: ticket.id, uploadedById: actor.id, originalName: 'a.txt', mimeType: 'text/plain', size: 1, objectKey: randomUUID(), updatedAt: new Date(0) } });
    objects.set(row.objectKey, Buffer.from('x'));
    await expect(downloadAttachment(actor, ticket.id, row.id, storage)).rejects.toMatchObject({ status: 404 });
    await cleanupAttachments(storage);
    expect(objects.has(row.objectKey)).toBe(false);
    expect((await db.ticketAttachment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('FAILED');
  });
  it('counts pending reservations and prevents concurrent uploads exceeding 200 MiB', async () => {
    const ticket = await createTicket(actor, input());
    for (let i = 0; i < 9; i++) await db.ticketAttachment.create({ data: { ticketId: ticket.id, uploadedById: actor.id, originalName: 'large.txt', mimeType: 'text/plain', size: 20 * 1024 * 1024, objectKey: randomUUID() } });
    const large = { ...file, bytes: Buffer.alloc(11 * 1024 * 1024, 65) };
    const results = await Promise.allSettled([uploadAttachments(actor, ticket.id, [large], storage), uploadAttachments(actor, ticket.id, [large], storage)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(r => r.status === 'rejected');
    expect(failed).toMatchObject({ reason: { status: 409 } });
    await expect(uploadAttachments(actor, ticket.id, Array.from({ length: 6 }, () => file), storage)).rejects.toThrow();
  });
  it('revalidates revocation after upload before making the object available', async () => {
    const ticket = await createTicket(actor, input());
    const revoking: AttachmentStorage = { ...storage, async put(key, bytes) { await storage.put(key, bytes, file.mimeType); await db.user.update({ where: { id: actor.id }, data: { authVersion: { increment: 1 } } }); } };
    await expect(uploadAttachments(actor, ticket.id, [file], revoking)).rejects.toThrow();
    expect((await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } })).status).toBe('PENDING_DELETION');
    actor = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  });
  it.skipIf(!process.env.S3_BUCKET)('uploads, downloads and removes real private SeaweedFS objects', async () => {
    const bucket = process.env.S3_BUCKET!;
    if (!/^tickets34-test-[a-f0-9]+$/.test(bucket) || process.env.S3_ENDPOINT !== 'http://seaweedfs:8333') throw new Error('Unsafe test storage');
    const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
    await client.send(new CreateBucketCommand({ Bucket: bucket, ACL: 'private' }));
    const real = attachmentStorage();
    const ticket = await createTicket(actor, input());
    const [attachment] = await uploadAttachments(actor, ticket.id, [file], real);
    expect(Buffer.from((await downloadAttachment(actor, ticket.id, attachment!.id, real)).bytes)).toEqual(file.bytes);
    const row = await db.ticketAttachment.findUniqueOrThrow({ where: { id: attachment!.id } });
    expect((await fetch(`${process.env.S3_ENDPOINT}/${bucket}/${row.objectKey}`)).status).toBe(403);
    expect((await fetch(`${process.env.S3_ENDPOINT}/${bucket}`)).status).toBe(403);
    const failure: AttachmentStorage = { ...real, async put(key, bytes, mime) { await real.put(key, bytes, mime); throw new Error('Failure after real PUT'); } };
    await expect(uploadAttachments(actor, ticket.id, [file], failure)).rejects.toThrow();
    const failed = await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id, status: 'PENDING_DELETION' } });
    await expect(real.get(failed.objectKey)).rejects.toMatchObject({ name: 'NoSuchKey' });
  });
  it('repeats deletion after a timed-out PUT finishes remotely following the first DELETE', async () => {
    const ticket = await createTicket(actor, input());
    let latePut = () => {};
    const delayed: AttachmentStorage = { ...storage, async put(key, bytes) { latePut = () => { objects.set(key, bytes); }; throw new Error('PUT timeout'); } };
    await expect(uploadAttachments(actor, ticket.id, [file], delayed)).rejects.toThrow();
    const row = await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } });
    expect(row.status).toBe('PENDING_DELETION');
    await cleanupAttachments(storage);
    expect((await db.ticketAttachment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PENDING_DELETION');
    latePut();
    expect(objects.has(row.objectKey)).toBe(true);
    await db.ticketAttachment.update({ where: { id: row.id }, data: { updatedAt: new Date(0) } });
    await cleanupAttachments(storage);
    expect(objects.has(row.objectKey)).toBe(false);
    expect((await db.ticketAttachment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('FAILED');
  });
  it('compensates a PUT completed after cleanup claimed its expired reservation', async () => {
    const ticket = await createTicket(actor, input());
    const interleaved: AttachmentStorage = { ...storage, async put(key, bytes) {
      await db.ticketAttachment.updateMany({ where: { ticketId: ticket.id }, data: { updatedAt: new Date(0) } });
      await cleanupAttachments(storage);
      objects.set(key, bytes);
    } };
    await expect(uploadAttachments(actor, ticket.id, [file], interleaved)).rejects.toThrow();
    const row = await db.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } });
    expect(row.status).toBe('PENDING_DELETION');
    expect(objects.has(row.objectKey)).toBe(false);
  });
});
