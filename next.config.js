/** @type {import('next').NextConfig} */

const fs = require('fs');
const path = require('path');
const os = require('os');
function parseRepoInfo(url) {
  if (!url) return { user: null, repo: null };
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
function getGitRepositoryInfo() {
  const getBJTString = (dateObj = new Date()) => {
    return dateObj.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  let commitHash = 'unknown';
  let branch = 'main';
  let user = 'unknown';
  let repo = 'unknown';
  let dateTime = getBJTString();

  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    commitHash = process.env.VERCEL_GIT_COMMIT_SHA;
    branch = process.env.VERCEL_GIT_COMMIT_REF || 'main';
    user = process.env.VERCEL_GIT_REPO_OWNER || 'unknown';
    repo = process.env.VERCEL_GIT_REPO_SLUG || 'unknown';
  } else {
    try {
      const git = require('git-rev-sync');
      commitHash = git.short();
      branch = git.branch();
      dateTime = getBJTString(new Date(git.date()));

      const remoteUrl = git.remoteUrl();
      const parsed = parseRepoInfo(remoteUrl);
      if (parsed.user) user = parsed.user;
      if (parsed.repo) repo = parsed.repo;
    } catch (e) {
      try {
        const configPath = path.join(__dirname, '.git/config');
        if (fs.existsSync(configPath)) {
          const gitConfig = fs.readFileSync(configPath, 'utf8');
          const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);
          if (urlMatch && urlMatch[1]) {
            const parsed = parseRepoInfo(urlMatch[1].trim());
            if (parsed.user) user = parsed.user;
            if (parsed.repo) repo = parsed.repo;
          }
        }
      } catch (fileErr) {
        // eslint-disable-next-line no-console
        console.warn(
          '⚠️ [Git-Sync] 彻底无法自动获取本地 Git 信息:',
          fileErr.message,
        );
      }
    }
  }

  return {
    commitHash: commitHash.substring(0, 7),
    branch,
    user,
    repo,
    dateTime,
  };
}
const gitInfo = getGitRepositoryInfo();

const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(',')
    : [],
  turbopack: {},

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
    GIT_COMMIT_HASH: gitInfo.commitHash,
    GIT_BRANCH: gitInfo.branch,
    GIT_USER: gitInfo.user,
    GIT_REPO: gitInfo.repo,
    GIT_DATE_TIME: gitInfo.dateTime,
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(nextConfig);
