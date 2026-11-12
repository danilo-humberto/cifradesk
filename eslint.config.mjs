import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: 'apps/web/' } } },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/lib/server/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['@cifradesk/database', '@cifradesk/infrastructure'],
        message: 'Use um módulo de servidor explícito; infraestrutura não pertence à interface.'
      }] }]
    }
  },
  globalIgnores(['.local/**', '.pnpm-store/**', '**/.next/**', '**/dist/**', '**/generated/**', '**/next-env.d.ts', 'playwright-report/**', 'test-results/**'])
]);
