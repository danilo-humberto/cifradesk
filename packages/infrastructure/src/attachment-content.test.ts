import { describe, expect, it } from 'vitest';
import { crc32 } from 'node:zlib';
import { validateAttachment } from './attachment-content';

function officeFixture(root: string) {
  const entries = [
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
    ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'],
    [root, root.startsWith('word') ? '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>' : '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>']
  ];
  const local: Buffer[] = []; const directory: Buffer[] = []; let offset = 0;
  for (const [filename, content] of entries) {
    const name = Buffer.from(filename!); const data = Buffer.from(content!);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc32(data), 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, name); offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(directory); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, end]);
}
describe('attachment content validation', () => {
  const file = (originalName: string, mimeType: string, text: string) => ({ originalName, mimeType, bytes: Buffer.from(text) });
  it('accepts UTF-8 text and csv', () => {
    expect(validateAttachment(file('ajuda.txt', 'text/plain', 'Descrição em português')).size).toBeGreaterThan(0);
    expect(validateAttachment(file('dados.csv', 'text/csv', 'nome,valor\nJoão,2'))).toMatchObject({ mimeType: 'text/csv' });
  });
  it.each([
    file('arquivo.pdf', 'application/pdf', 'não é pdf'),
    file('programa.exe', 'text/plain', 'texto'),
    file('imagem.png', 'image/png', 'fake'),
    file('../arquivo.txt', 'text/plain', 'texto'),
    file('arquivo.txt', 'text/plain', 'MZ\u0000binary'),
    file('arquivo.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK\u0003\u0004fake'),
    file('empty.txt', 'text/plain', '')
  ])('rejects invalid bytes, extension, path and empty content: $originalName', value => {
    expect(() => validateAttachment(value)).toThrow();
  });
  it('enforces the actual byte limit', () => {
    expect(() => validateAttachment({ originalName: 'a.txt', mimeType: 'text/plain', bytes: Buffer.alloc(20 * 1024 * 1024 + 1, 65) })).toThrow();
  });
  it.each([
    { originalName: 'a.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n') },
    { originalName: 'a.png', mimeType: 'image/png', bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7wAAAABJRU5ErkJggg==', 'base64') },
    { originalName: 'a.jpg', mimeType: 'image/jpeg', bytes: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64') },
    { originalName: 'a.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: officeFixture('word/document.xml') },
    { originalName: 'a.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: officeFixture('xl/workbook.xml') }
  ])('accepts a permitted format fixture: $originalName', file => { expect(validateAttachment(file).size).toBe(file.bytes.length); });
  it('rejects generic archives, truncated Office directories and macros', () => {
    const file = { originalName: 'a.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: officeFixture('word/document.xml') };
    expect(() => validateAttachment({ ...file, bytes: file.bytes.subarray(0, -10) })).toThrow();
    expect(() => validateAttachment({ ...file, bytes: officeFixture('arbitrary.txt') })).toThrow();
    expect(() => validateAttachment({ ...file, bytes: officeFixture('word/vbaProject.bin') })).toThrow();
  });
});
