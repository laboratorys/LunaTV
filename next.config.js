/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-var-requires */
const git = require('git-rev-sync');
const remoteUrl = git.remoteUrl();
const { user, repo } = parseRepoInfo(remoteUrl);
const nextConfig = {
  output: 'standalone',
  eslint: {
    dirs: ['src'],
  },

  reactStrictMode: false,
  swcMinify: false,

  experimental: {
    instrumentationHook: process.env.NODE_ENV === 'production',
  },

  // Uncoment to add domain whitelist
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: { not: /\.(css|scss|sass)$/ },
        resourceQuery: { not: /url/ }, // exclude if *.svg?url
        loader: '@svgr/webpack',
        options: {
          dimensions: false,
          titleProp: true,
        },
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },
  env: {
    GIT_COMMIT_HASH: git.short(),
    GIT_BRANCH: git.branch(),
    GIT_USER: user,
    GIT_REPO: repo,
    GIT_DATE_TIME: git.date().toLocaleString(),
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

function parseRepoInfo(url) {
  const matches = url.match(
    /(?:https?:\/\/[^/]+\/|git@[^:]+:)([^/]+)\/([^/]+?)(?:\.git)?$/i
  );

  if (!matches || matches.length < 3) {
    return { user: null, repo: null };
  }

  return {
    user: matches[1],
    repo: matches[2].replace(/\.git$/, ''),
  };
}
module.exports = withPWA(nextConfig);
