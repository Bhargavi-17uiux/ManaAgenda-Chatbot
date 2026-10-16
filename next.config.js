/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./.documind_store.json'],
    },
  },
};

module.exports = nextConfig;
