/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  // The dev-only badge would otherwise show up in screenshots.
  devIndicators: false,
};
export default nextConfig;
