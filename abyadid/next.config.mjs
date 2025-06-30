/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
        // Exclude the problematic file from processing
        config.module.rules.push({
            test: /HeartbeatWorker/,
            use: 'null-loader',
        });

        return config;
    },
};

export default nextConfig;