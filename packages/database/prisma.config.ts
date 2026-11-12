import { defineConfig } from 'prisma/config';

// Validação/geração não abre conexão. Não definir credenciais fictícias de produção.
export default defineConfig({ schema: 'prisma/schema.prisma' });
