BEGIN;

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'IN_PROGRESS', 'DONE', 'REVIEW', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RequestedFor" AS ENUM ('SELF', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityVisibility" AS ENUM ('SHARED', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'FAILED', 'PENDING_DELETION');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestedFor" "RequestedFor" NOT NULL,
    "requesterName" VARCHAR(150) NOT NULL,
    "originDepartmentId" TEXT NOT NULL,
    "originDepartmentName" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignee" (
    "ticketId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignee_pkey" PRIMARY KEY ("ticketId","userId")
);

-- CreateTable
CREATE TABLE "TicketActivity" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "ticketVersion" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "visibility" "ActivityVisibility" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" VARCHAR(150) NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE INDEX "Ticket_createdById_createdAt_id_idx" ON "Ticket"("createdById", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_departmentId_status_createdAt_id_idx" ON "Ticket"("departmentId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_departmentId_dueDate_id_idx" ON "Ticket"("departmentId", "dueDate", "id");

-- CreateIndex
CREATE INDEX "Ticket_originDepartmentId_idx" ON "Ticket"("originDepartmentId");

-- CreateIndex
CREATE INDEX "TicketAssignee_userId_ticketId_idx" ON "TicketAssignee"("userId", "ticketId");

-- CreateIndex
CREATE INDEX "TicketAssignee_assignedById_idx" ON "TicketAssignee"("assignedById");

-- CreateIndex
CREATE INDEX "TicketActivity_ticketId_createdAt_id_idx" ON "TicketActivity"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "TicketActivity_ticketId_visibility_createdAt_id_idx" ON "TicketActivity"("ticketId", "visibility", "createdAt", "id");

-- CreateIndex
CREATE INDEX "TicketActivity_authorId_idx" ON "TicketActivity"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAttachment_objectKey_key" ON "TicketAttachment"("objectKey");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_status_createdAt_id_idx" ON "TicketAttachment"("ticketId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "TicketAttachment_uploadedById_idx" ON "TicketAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "OutboxEvent_ticketId_createdAt_id_idx" ON "OutboxEvent"("ticketId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_originDepartmentId_fkey" FOREIGN KEY ("originDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Write-time business checks (eligibility, permissions and future due dates)
-- belong to services. These persistent invariants also protect direct SQL writes.
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_title_length" CHECK (char_length(btrim(title)) BETWEEN 5 AND 150),
  ADD CONSTRAINT "Ticket_description_length" CHECK (char_length(btrim(description)) BETWEEN 10 AND 10000),
  ADD CONSTRAINT "Ticket_requester_name_length" CHECK (char_length(btrim("requesterName")) BETWEEN 1 AND 150 AND ("requestedFor" <> 'OTHER' OR char_length(btrim("requesterName")) >= 3)),
  ADD CONSTRAINT "Ticket_origin_name_required" CHECK (char_length(btrim("originDepartmentName")) > 0),
  ADD CONSTRAINT "Ticket_version_positive" CHECK (version >= 1),
  ADD CONSTRAINT "Ticket_number_positive" CHECK (number >= 1);
ALTER TABLE "TicketActivity"
  ADD CONSTRAINT "TicketActivity_version_positive" CHECK ("ticketVersion" >= 1),
  ADD CONSTRAINT "TicketActivity_action_required" CHECK (char_length(btrim(action)) > 0),
  ADD CONSTRAINT "TicketActivity_changes_object" CHECK (jsonb_typeof(changes) = 'object');
ALTER TABLE "TicketAttachment"
  ADD CONSTRAINT "TicketAttachment_size_limit" CHECK (size BETWEEN 1 AND 20971520),
  ADD CONSTRAINT "TicketAttachment_name_required" CHECK (char_length(btrim("originalName")) > 0),
  ADD CONSTRAINT "TicketAttachment_key_required" CHECK (char_length(btrim("objectKey")) > 0),
  ADD CONSTRAINT "TicketAttachment_mime_allowed" CHECK ("mimeType" IN ('application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
ALTER TABLE "OutboxEvent"
  ADD CONSTRAINT "OutboxEvent_version_positive" CHECK ("contractVersion" >= 1),
  ADD CONSTRAINT "OutboxEvent_type_required" CHECK (char_length(btrim(type)) > 0),
  ADD CONSTRAINT "OutboxEvent_payload_object" CHECK (jsonb_typeof(payload) = 'object');

COMMIT;
