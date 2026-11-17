BEGIN;
CREATE TABLE "MessageSubmission" (
  "id" UUID NOT NULL PRIMARY KEY,
  "ticketId" UUID NOT NULL,
  "authorId" TEXT NOT NULL,
  "clientId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  "attemptId" UUID,
  "messageId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MessageSubmission_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MessageSubmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MessageSubmission_messageId_ticketId_fkey" FOREIGN KEY ("messageId", "ticketId") REFERENCES "TicketMessage"(id, "ticketId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "MessageSubmission_id_ticketId_key" ON "MessageSubmission"(id, "ticketId");
CREATE UNIQUE INDEX "MessageSubmission_ticketId_authorId_clientId_key" ON "MessageSubmission"("ticketId", "authorId", "clientId");
CREATE UNIQUE INDEX "MessageSubmission_messageId_key" ON "MessageSubmission"("messageId");
CREATE INDEX "MessageSubmission_authorId_idx" ON "MessageSubmission"("authorId");
ALTER TABLE "TicketAttachment" ADD COLUMN "submissionId" UUID;
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_submissionId_ticketId_fkey" FOREIGN KEY ("submissionId", "ticketId") REFERENCES "MessageSubmission"(id, "ticketId") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "TicketAttachment_submissionId_idx" ON "TicketAttachment"("submissionId");
COMMIT;
