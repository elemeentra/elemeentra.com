/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    // lucide-react ships hundreds of icons behind one barrel file. Without this,
    // every route compile in `next dev` (and every client bundle) drags the whole
    // barrel in, which is a big part of the "click and wait" delay in development.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
