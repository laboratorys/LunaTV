/* eslint-disable no-console */
const version = {
  "main": "5.0.0",
  "dev": "5.0.0.97928cc"
};
const GIT_BRANCH = process.env.GIT_BRANCH || 'main';
const CURRENT_VERSION: string = 
  version[GIT_BRANCH as keyof typeof version] || version.main;
export { CURRENT_VERSION };
