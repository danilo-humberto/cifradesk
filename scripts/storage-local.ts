import { cleanupAttachments } from '../packages/infrastructure/src/ticket-attachments';
import { initializeLocalStorage } from '../packages/infrastructure/src/storage';
import { database } from '../packages/database/src';

try {
  const endpoint = new URL(process.env.S3_ENDPOINT ?? '');
  if (endpoint.origin !== 'http://seaweedfs:8333' || process.env.S3_BUCKET !== 'cifradesk-local') throw new Error('Destino local obrigatório.');
  if (process.argv[2] === 'init') {
    await initializeLocalStorage();
    console.log('Bucket local disponível; acesso anônimo negado.');
  } else if (process.argv[2] === 'cleanup') {
    const target = new URL(process.env.DATABASE_URL ?? '');
    if (target.hostname !== 'postgres' || target.pathname !== '/cifradesk') throw new Error('Banco local obrigatório.');
    try { console.log(await cleanupAttachments()); }
    finally { await database().$disconnect(); }
  } else throw new Error('Uso: storage-local.ts init|cleanup');
} catch { console.error('Operação não concluída. Confira destino, configuração e disponibilidade locais.'); process.exitCode = 1; }
