/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // ✅ Tambahkan ini
  },
};

module.exports = nextConfig;
