import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'better-sqlite3',
    'sharp',
    'tesseract.js',
    'pdf-parse',
    '@anthropic-ai/sdk',
    'openai',
    'natural',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias['@backend'] = path.join(__dirname, 'src');
      config.resolve.alias['@data'] = path.join(__dirname, 'data');
      const NATIVE = ['sharp', 'tesseract.js', 'better-sqlite3', 'pdf-parse', 'canvas', '@img'];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        function ({ request }, callback) {
          if (request && NATIVE.some((n) => request.startsWith(n))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
    return config;
  },
};

export default nextConfig;
