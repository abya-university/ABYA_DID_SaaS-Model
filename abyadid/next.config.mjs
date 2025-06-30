/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config, { isServer }) => {
        // Add a rule for Web Workers
        config.module.rules.push({
            test: /\.worker\.js$/,
            loader: 'worker-loader',
            options: {
                filename: 'static/[hash].worker.js',
                publicPath: '/_next/',
                inline: 'no-fallback',
            },
        });

        // Fix for WebWorker compatibility with Next.js
        if (!isServer) {
            config.output.globalObject = 'self';
        }

        return config;
    },
}

// Use export default instead of module.exports for .mjs files
export default nextConfig;