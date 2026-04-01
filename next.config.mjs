import bundleAnalyzer from '@next/bundle-analyzer';

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE || '100', 10);
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});


/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.11.11'],
};

export default withBundleAnalyzer(nextConfig);