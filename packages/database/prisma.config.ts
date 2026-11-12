import { defineConfig } from 'prisma/config';

// validate/generate do not connect; deployment explicitly supplies its local URL.
export default defineConfig({ schema: 'prisma/schema.prisma', datasource: { url: process.env.DATABASE_URL } });
