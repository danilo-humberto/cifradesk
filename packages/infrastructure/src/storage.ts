import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export interface AttachmentStorage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
export async function initializeLocalStorage() {
  if (process.env.S3_ENDPOINT !== 'http://seaweedfs:8333' || process.env.S3_BUCKET !== 'cifradesk-local') throw new Error('Destino local obrigatório.');
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) throw new Error('Configure as credenciais S3 locais.');
  const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  try { await client.send(new HeadBucketCommand({ Bucket: 'cifradesk-local' })); }
  catch (error) {
    if (!(error && typeof error === 'object' && '$metadata' in error && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404)) throw error;
    await client.send(new CreateBucketCommand({ Bucket: 'cifradesk-local', ACL: 'private' }));
  }
  const anonymous = await fetch('http://seaweedfs:8333/cifradesk-local', { signal: AbortSignal.timeout(10000) });
  if (anonymous.status !== 403) throw new Error('Bucket não confirmou bloqueio de acesso anônimo.');
}
export function attachmentStorage(): AttachmentStorage {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error('Armazenamento privado não configurado.');
  const client = new S3Client({ endpoint: S3_ENDPOINT, region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    maxAttempts: 2, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  return {
    async put(key, bytes, mimeType) {
      await client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: mimeType, ACL: 'private' }), { abortSignal: AbortSignal.timeout(60000) });
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { abortSignal: AbortSignal.timeout(60000) });
      if (!result.Body) throw new Error('Objeto indisponível.');
      return result.Body.transformToByteArray();
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }), { abortSignal: AbortSignal.timeout(60000) });
    }
  };
}
