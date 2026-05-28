/** @type {import('next').NextConfig} */

const git = require('git-rev-sync');
const remoteUrl = git.remoteUrl();
const { user, repo } = parseRepoInfo(remoteUrl);

const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.30.113'],
  // 1. Next.js 16 正确的 Turbopack 配置位置（移到顶层）
  turbopack: {
    // 留空即可，Next.js 16 默认会自动完美处理开发环境下的打包冲突
  },

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

  // 2. 彻底移除无效的 experimental 块

  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    );

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: { not: /\.(css|scss|sass)$/ },
        resourceQuery: { not: /url/ },
        loader: '@svgr/webpack',
        options: {
          dimensions: false,
          titleProp: true,
        },
      },
    );

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
    /(?:https?:\/\/[^/]+\/|git@[^:]+:)([^/]+)\/([^/]+?)(?:\.git)?$/i,
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
