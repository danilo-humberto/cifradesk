import { ticketAttachmentInput } from '@cifradesk/contracts/tickets';
import { DomainError } from '@cifradesk/core';

export type AttachmentFile = { originalName: string; mimeType: string; bytes: Buffer };
const extensions: Record<string, string[]> = {
  'application/pdf': ['pdf'], 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'],
  'text/plain': ['txt'], 'text/csv': ['csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx']
};
// Inspect the ZIP central directory, without inflating untrusted archives.
// Generic ZIPs, encrypted files, macros and embedded executables are not Office documents.
function officeDirectory(bytes: Buffer, root: string) {
  const end = bytes.lastIndexOf(Buffer.from('504b0506', 'hex'));
  if (end < 0 || end + 22 > bytes.length || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) return false;
  if (bytes.readUInt32LE(end + 4) !== 0) return false;
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  if (!count || count > 10000 || cursor + bytes.readUInt32LE(end + 12) !== end) return false;
  const names = new Set<string>();
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) return false;
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const length = bytes.readUInt16LE(cursor + 28);
    const next = cursor + 46 + length + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
    if (next > end || flags & 1 || ![0, 8].includes(method)) return false;
    const name = bytes.subarray(cursor + 46, cursor + 46 + length).toString('utf8');
    if (names.has(name) || name.startsWith('/') || name.includes('..') || name.includes('\\') || /(?:vbaProject|embeddings\/|\.(?:exe|dll|com|bat|js|vbs|ps1)$)/i.test(name)) return false;
    const local = bytes.readUInt32LE(cursor + 42);
    if (local + 30 > cursor || bytes.readUInt32LE(local) !== 0x04034b50) return false;
    const dataStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (dataStart + bytes.readUInt32LE(cursor + 20) > bytes.readUInt32LE(end + 16)) return false;
    if (bytes.subarray(local + 30, local + 30 + bytes.readUInt16LE(local + 26)).toString('utf8') !== name) return false;
    expanded += bytes.readUInt32LE(cursor + 24);
    if (expanded > 200 * 1024 * 1024) return false;
    names.add(name); cursor = next;
  }
  return cursor === end && names.has('[Content_Types].xml') && names.has('_rels/.rels') && names.has(root);
}
export function validateAttachment(file: AttachmentFile) {
  const metadata = ticketAttachmentInput.parse({ originalName: file.originalName, mimeType: file.mimeType, size: file.bytes.length });
  const { bytes } = file;
  const extension = metadata.originalName.split('.').at(-1)?.toLowerCase() ?? '';
  if (/[\\/\x00-\x1f\x7f]/.test(metadata.originalName) || !extensions[metadata.mimeType]?.includes(extension))
    throw new DomainError(400, 'Nome ou extensão do arquivo não permitido.');
  let valid = false;
  if (extension === 'pdf') valid = bytes.subarray(0, 5).toString() === '%PDF-' && bytes.subarray(-1024).includes(Buffer.from('%%EOF'));
  if (extension === 'png') valid = bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.subarray(12, 16).toString() === 'IHDR' && bytes.subarray(-8, -4).toString() === 'IEND';
  if (['jpg', 'jpeg'].includes(extension)) valid = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (['txt', 'csv'].includes(extension)) {
    try { valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { valid = false; }
  }
  if (extension === 'docx') valid = officeDirectory(bytes, 'word/document.xml');
  if (extension === 'xlsx') valid = officeDirectory(bytes, 'xl/workbook.xml');
  if (!valid) throw new DomainError(400, 'Conteúdo incompatível com o formato informado.');
  return metadata;
}
