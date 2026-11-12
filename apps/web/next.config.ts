import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['proxy'],
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
  transpilePackages: ['@cifradesk/contracts'],
  poweredByHeader: false
};
export default config;
