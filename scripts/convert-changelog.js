#!/usr/bin / env node

/* eslint-disable */

const fs = require('fs');
const path = require('path');
const git = require('git-rev-sync');
const CHANGELOG_PATH = path.join(process.cwd(), 'CHANGELOG.md');
const OUTPUT_PATH = path.join(process.cwd(), 'src/lib/changelog.ts');
const VERSION_TXT_PATH = path.join(
  process.cwd(),
  `VERSION_${process.env.GITHUB_BRANCH?.toUpperCase()}.txt`,
);
const VERSION_TS_PATH = path.join(
  process.cwd(),
  `src/lib/version-${process.env.GITHUB_BRANCH}.ts`,
);
function parseChangelog(content) {
  const lines = content.split('\n');
  const versions = [];
  let currentVersion = null;
  let currentSection = null;
  let inVersionContent = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 匹配版本行: ## [X.Y.Z] - YYYY-MM-DD
    const versionMatch = trimmedLine.match(
      /^## \[([\d.]+)\] - (\d{4}-\d{2}-\d{2})$/,
    );
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion);
      }

      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
        added: [],
        changed: [],
        fixed: [],
        content: [], // 用于存储原始内容，当没有分类时使用
      };
      currentSection = null;
      inVersionContent = true;
      continue;
    }

    // 如果遇到下一个版本或到达文件末尾，停止处理当前版本
    if (inVersionContent && currentVersion) {
      // 匹配章节标题
      if (trimmedLine === '### Added') {
        currentSection = 'added';
        continue;
      } else if (trimmedLine === '### Changed') {
        currentSection = 'changed';
        continue;
      } else if (trimmedLine === '### Fixed') {
        currentSection = 'fixed';
        continue;
      }

      // 匹配条目: - 内容
      if (trimmedLine.startsWith('- ') && currentSection) {
        const entry = trimmedLine.substring(2);
        currentVersion[currentSection].push(entry);
      } else if (
        trimmedLine &&
        !trimmedLine.startsWith('#') &&
        !trimmedLine.startsWith('###')
      ) {
        currentVersion.content.push(trimmedLine);
      }
    }
  }

  // 添加最后一个版本
  if (currentVersion) {
    versions.push(currentVersion);
  }

  // 后处理：如果某个版本没有分类内容，但有 content，则将 content 放到 changed 中
  versions.forEach((version) => {
    const hasCategories =
      version.added.length > 0 ||
      version.changed.length > 0 ||
      version.fixed.length > 0;
    if (!hasCategories && version.content.length > 0) {
      version.changed = version.content;
    }
    // 清理 content 字段
    delete version.content;
  });

  return { versions };
}

function generateTypeScript(changelogData) {
  const entries = changelogData.versions
    .map((version) => {
      const addedEntries = version.added
        .map((entry) => `    "${entry}"`)
        .join(',\n');
      const changedEntries = version.changed
        .map((entry) => `    "${entry}"`)
        .join(',\n');
      const fixedEntries = version.fixed
        .map((entry) => `    "${entry}"`)
        .join(',\n');

      return `  {
    version: "${version.version}",
    date: "${version.date}",
    added: [
${addedEntries || '      // 无新增内容'}
    ],
    changed: [
${changedEntries || '      // 无变更内容'}
    ],
    fixed: [
${fixedEntries || '      // 无修复内容'}
    ]
  }`;
    })
    .join(',\n');

  return `// 此文件由 scripts/convert-changelog.js 自动生成
// 请勿手动编辑

export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [
${entries}
];

export default changelog;
`;
}

function updateVersionFile(version) {
  try {
    fs.writeFileSync(VERSION_TXT_PATH, version, 'utf8');
    console.log(`✅ 已更新 VERSION.txt: ${version}`);
  } catch (error) {
    console.error(`❌ 无法更新 VERSION.txt:`, error.message);
    process.exit(1);
  }
}

function updateVersionTs(version) {
  try {
    const updatedContent = `const CURRENT_VERSION = '${version}';
                            export { CURRENT_VERSION };`;
    fs.writeFileSync(VERSION_TS_PATH, updatedContent, 'utf8');
    console.log(`✅ Updated version.ts: ${version}`);
  } catch (error) {
    console.error(`❌ Failed to update version.ts:`, error.message);
    process.exit(1);
  }
}

function main() {
  try {
    //const changelogPath = path.join(process.cwd(), 'CHANGELOG');
    // const outputPath = path.join(process.cwd(), 'src/lib/changelog.ts');

    console.log('正在读取 CHANGELOG 文件...');
    const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf-8');

    console.log('正在解析 CHANGELOG 内容...');
    const changelogData = parseChangelog(changelogContent);

    if (changelogData.versions.length === 0) {
      console.error('❌ 未在 CHANGELOG 中找到任何版本');
      process.exit(1);
    }

    // 获取最新版本号（CHANGELOG中的第一个版本）
    let latestVersion = changelogData.versions[0].version;
    if (git.branch() === 'dev') {
      const hash = git.short();
      latestVersion = `${latestVersion}.` + hash;
    }
    console.log(`🔢 最新版本: ${latestVersion}`);

    console.log('正在生成 TypeScript 文件...');
    const tsContent = generateTypeScript(changelogData);

    // 确保输出目录存在
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, tsContent, 'utf-8');

    // 检查是否在 GitHub Actions 环境中运行
    const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

    if (isGitHubActions) {
      // 在 GitHub Actions 中，更新版本文件
      console.log('正在更新版本文件...');
      updateVersionFile(latestVersion);
      updateVersionTs(latestVersion);
    } else {
      // 在本地运行时，只提示但不更新版本文件
      console.log('🔧 本地运行模式：跳过版本文件更新');
      console.log('💡 版本文件更新将在 git tag 触发的 release 工作流中完成');
    }

    console.log(`✅ 成功生成 ${OUTPUT_PATH}`);
    console.log(`📊 版本统计:`);
    changelogData.versions.forEach((version) => {
      console.log(
        `   ${version.version} (${version.date}): +${version.added.length} ~${version.changed.length} !${version.fixed.length}`,
      );
    });

    console.log('\n🎉 转换完成!');
  } catch (error) {
    console.error('❌ 转换失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
