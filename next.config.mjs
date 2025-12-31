/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // React Compiler is experimental in Next.js 14 if available, 
    // but usually it requires babel plugin. 
    // I'll leave it out for stability unless I know it's setup.
    // The previous file had reactCompiler: true, but that might be for Next 15.
  },
};

export default nextConfig;
