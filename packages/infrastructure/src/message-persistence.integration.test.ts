import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { downloadAttachment } from './ticket-attachments';
import type { AttachmentStorage } from './storage';

const enabled = process.env.MESSAGE_PERSISTENCE_TEST_DATABASE === '1';
describe.skipIf(!enabled)('message persistence and legacy attachments', () => {
  let db: ReturnType<typeof database>;
  const ticketId = '00000000-0000-4000-8000-000000000041';
  const authorId = 'message-test-author';
  beforeAll(() => {
    const target = new URL(process.env.DATABASE_URL!);
    if (target.hostname !== 'postgres' || !/^\/messages41_test_[a-f0-9]+$/.test(target.pathname) || target.username !== target.pathname.slice(1)) throw new Error('Unsafe test database');
    db = database();
  });
  afterAll(async () => { await db?.$disconnect(); });

  it('downloads an attachment created before the message migration through the existing service', async () => {
    const storage: AttachmentStorage = {
      async put() { throw new Error('Unexpected upload'); },
      async remove() { throw new Error('Unexpected deletion'); },
      async get(key) { expect(key).toBe('synthetic/old'); return Buffer.from('old'); }
    };
    const attachment = await db.ticketAttachment.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000000043' } });
    expect(attachment).toMatchObject({ messageId: null, removedAt: null, status: 'AVAILABLE' });
    const result = await downloadAttachment({ id: authorId, authVersion: 0 }, ticketId, attachment.id, storage);
    expect(Buffer.from(result.bytes).toString()).toBe('old');
  });

  it('writes a message, attachment and immutable revision atomically through Prisma', async () => {
    const id = randomUUID();
    await db.$transaction(async tx => {
      await tx.ticketMessage.create({ data: { id, ticketId, authorId, markdown: '', visibility: 'INTERNAL' } });
      const attachment = await tx.ticketAttachment.create({ data: { ticketId, messageId: id, uploadedById: authorId, originalName: 'only.txt', objectKey: `synthetic/${id}`, mimeType: 'text/plain', size: 1, status: 'AVAILABLE' } });
      await tx.ticketMessageRevision.create({ data: { messageId: id, version: 1, markdown: '', attachments: [{ id: attachment.id, originalName: attachment.originalName }] } });
    });
    const message = await db.ticketMessage.findUniqueOrThrow({ where: { id }, include: { revisions: true, attachments: true } });
    expect(message).toMatchObject({ version: 1, visibility: 'INTERNAL', markdown: '', deletedAt: null });
    expect(message.revisions).toHaveLength(1);
    expect(message.attachments).toHaveLength(1);
    await expect(db.ticketMessageRevision.update({ where: { id: message.revisions[0]!.id }, data: { markdown: 'overwrite' } })).rejects.toThrow();
  });

  it('rolls back the message when an attachment belongs to another ticket', async () => {
    const id = randomUUID();
    await expect(db.$transaction(async tx => {
      await tx.ticketMessage.create({ data: { id, ticketId, authorId, markdown: 'Rollback', visibility: 'SHARED' } });
      await tx.ticketAttachment.create({ data: { ticketId: '00000000-0000-4000-8000-000000000042', messageId: id, uploadedById: authorId, originalName: 'wrong.txt', objectKey: `synthetic/${id}`, mimeType: 'text/plain', size: 1 } });
    })).rejects.toMatchObject({ code: 'P2003' });
    expect(await db.ticketMessage.findUnique({ where: { id } })).toBeNull();
  });
});
