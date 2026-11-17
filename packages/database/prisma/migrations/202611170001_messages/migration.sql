BEGIN;

CREATE TABLE "TicketMessage" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "authorId" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "visibility" "ActivityVisibility" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketMessage_markdown_length" CHECK (char_length(markdown) <= 10000),
  CONSTRAINT "TicketMessage_version_positive" CHECK (version >= 1)
);

CREATE TABLE "TicketMessageRevision" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "markdown" TEXT NOT NULL,
  "attachments" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessageRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketMessageRevision_markdown_length" CHECK (char_length(markdown) <= 10000),
  CONSTRAINT "TicketMessageRevision_version_positive" CHECK (version >= 1)
);

-- NULL preserves opening attachments and their existing download behavior.
ALTER TABLE "TicketAttachment" ADD COLUMN "messageId" UUID, ADD COLUMN "removedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "TicketMessage_id_ticketId_key" ON "TicketMessage"("id", "ticketId");
CREATE INDEX "TicketMessage_ticketId_createdAt_id_idx" ON "TicketMessage"("ticketId", "createdAt", "id");
CREATE INDEX "TicketMessage_ticketId_visibility_createdAt_id_idx" ON "TicketMessage"("ticketId", "visibility", "createdAt", "id");
CREATE INDEX "TicketMessage_authorId_idx" ON "TicketMessage"("authorId");
CREATE UNIQUE INDEX "TicketMessageRevision_messageId_version_key" ON "TicketMessageRevision"("messageId", "version");
CREATE INDEX "TicketAttachment_messageId_removedAt_createdAt_id_idx" ON "TicketAttachment"("messageId", "removedAt", "createdAt", "id");

ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketMessageRevision" ADD CONSTRAINT "TicketMessageRevision_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Do not cascade a message's ticket change into an attachment from another ticket.
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_messageId_ticketId_fkey" FOREIGN KEY ("messageId", "ticketId") REFERENCES "TicketMessage"("id", "ticketId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Store the complete composition in one immutable row, including historical names.
-- This avoids mutable child rows and does not grant download access to snapshots.
CREATE FUNCTION "validateMessageRevision"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item JSONB;
  seen UUID[] := ARRAY[]::UUID[];
  attachment_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Message revisions are immutable' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(NEW.attachments) <> 'array' THEN
    RAISE EXCEPTION 'Revision attachments must be an array' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(NEW.attachments) > 5 THEN
    RAISE EXCEPTION 'At most five attachments per revision' USING ERRCODE = '23514';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.attachments) LOOP
    IF jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'originalName') IS DISTINCT FROM 'string'
       OR item - 'id' - 'originalName' <> '{}'::JSONB
       OR (item->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Invalid attachment snapshot' USING ERRCODE = '23514';
    END IF;
    attachment_id := (item->>'id')::UUID;
    IF attachment_id = ANY(seen) THEN
      RAISE EXCEPTION 'Duplicate attachment in revision' USING ERRCODE = '23514';
    END IF;
    -- Lock while capturing metadata so a concurrent change cannot alter the snapshot.
    PERFORM 1 FROM "TicketAttachment"
      WHERE id = attachment_id AND "messageId" = NEW."messageId"
        AND "originalName" = item->>'originalName'
        AND status = 'AVAILABLE' AND "removedAt" IS NULL
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Snapshot attachment must be available on the same message' USING ERRCODE = '23514';
    END IF;
    seen := array_append(seen, attachment_id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "TicketMessageRevision_immutable_snapshot"
BEFORE INSERT OR UPDATE OR DELETE ON "TicketMessageRevision"
FOR EACH ROW EXECUTE FUNCTION "validateMessageRevision"();

COMMIT;
