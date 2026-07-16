/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] ,
 unoptimized: true, 
},
  
  // Add this for serialport support
  experimental: {
    serverComponentsExternalPackages: ['serialport', '@serialport/parser-readline'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'serialport', '@serialport/parser-readline'];
    }
    return config;
  },
};
module.exports = nextConfig;









// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//   images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
// };
// module.exports = nextConfig;
