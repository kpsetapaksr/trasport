/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    },
    turbopack: {
      root: '.',
    },
  },
}

export default nextConfig
