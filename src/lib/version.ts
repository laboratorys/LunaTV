/* eslint-disable no-console */
const version = { main: '5.0.0', dev: '5.0.0.1aaf91a' };

const GIT_BRANCH = process.env.GIT_BRANCH || 'main';

const CURRENT_VERSION: string =
  version[GIT_BRANCH as keyof typeof version] || version.main;

// 导出当前版本号
export { CURRENT_VERSION };
