/* eslint-disable no-console */

import { revalidateTag, unstable_cache } from 'next/cache';

import { db } from '@/lib/db';
import { DbUser } from '@/lib/types';

import { AdminConfig } from './admin.types';

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
  filter_ads?: boolean; // 该源是否插播广告（缺省按 true，需配合播放器去广告开关才生效）
}

export interface LiveCfg {
  name: string;
  url: string;
  ua?: string;
  epg?: string; // 节目单
}

interface ConfigFileStruct {
  cache_time?: number;
  api_site?: {
    [key: string]: ApiSite;
  };
  custom_category?: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  lives?: {
    [key: string]: LiveCfg;
  };
  danmu_api?: {
    url: string;
    token?: string;
  };
}

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}&h={h}&t={t}&ids={ids}',
    classePath: '?ac=list&ids=abc',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
};

const CACHE_TAG = 'admin-config';

// 从配置文件补充管理员配置
export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch (e) {
    fileConfig = {} as ConfigFileStruct;
  }

  // 合并文件中的源信息
  const apiSitesFromFile = Object.entries(fileConfig.api_site || []);
  const currentApiSites = new Map(
    (adminConfig.SourceConfig || []).map((s) => [s.key, s]),
  );

  apiSitesFromFile.forEach(([key, site]) => {
    const existingSource = currentApiSites.get(key);
    if (existingSource) {
      // 如果已存在，只覆盖 name、api、detail 和 from
      existingSource.name = site.name;
      existingSource.api = site.api;
      existingSource.detail = site.detail;
      existingSource.filter_ads = site.filter_ads !== false;
      existingSource.from = 'config';
    } else {
      // 如果不存在，创建新条目
      currentApiSites.set(key, {
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        filter_ads: site.filter_ads !== false,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有源是否在 fileConfig.api_site 中，如果不在则标记为 custom
  const apiSitesFromFileKey = new Set(apiSitesFromFile.map(([key]) => key));
  currentApiSites.forEach((source) => {
    if (!apiSitesFromFileKey.has(source.key)) {
      source.from = 'custom';
    }
  });

  // 文件为权威来源：按文件顺序重建数组，文件外的手动源按原顺序排在后面
  adminConfig.SourceConfig = [
    ...apiSitesFromFile.map(([key]) => currentApiSites.get(key)!),
    ...Array.from(currentApiSites.values()).filter(
      (source) => !apiSitesFromFileKey.has(source.key),
    ),
  ];

  // 覆盖 CustomCategories
  const customCategoriesFromFile = fileConfig.custom_category || [];
  const currentCustomCategories = new Map(
    (adminConfig.CustomCategories || []).map((c) => [c.query + c.type, c]),
  );

  customCategoriesFromFile.forEach((category) => {
    const key = category.query + category.type;
    const existedCategory = currentCustomCategories.get(key);
    if (existedCategory) {
      existedCategory.name = category.name;
      existedCategory.query = category.query;
      existedCategory.type = category.type;
      existedCategory.from = 'config';
    } else {
      currentCustomCategories.set(key, {
        name: category.name,
        type: category.type,
        query: category.query,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有 CustomCategories 是否在 fileConfig.custom_category 中，如果不在则标记为 custom
  const customCategoriesFromFileKeys = new Set(
    customCategoriesFromFile.map((c) => c.query + c.type),
  );
  currentCustomCategories.forEach((category) => {
    if (!customCategoriesFromFileKeys.has(category.query + category.type)) {
      category.from = 'custom';
    }
  });

  // 文件为权威来源：按文件顺序重建数组，文件外的手动分类按原顺序排在后面
  adminConfig.CustomCategories = [
    ...customCategoriesFromFile.map(
      (c) => currentCustomCategories.get(c.query + c.type)!,
    ),
    ...Array.from(currentCustomCategories.values()).filter(
      (category) =>
        !customCategoriesFromFileKeys.has(category.query + category.type),
    ),
  ];

  const livesFromFile = Object.entries(fileConfig.lives || []);
  const currentLives = new Map(
    (adminConfig.LiveConfig || []).map((l) => [l.key, l]),
  );
  livesFromFile.forEach(([key, site]) => {
    const existingLive = currentLives.get(key);
    if (existingLive) {
      existingLive.name = site.name;
      existingLive.url = site.url;
      existingLive.ua = site.ua;
      existingLive.epg = site.epg;
    } else {
      // 如果不存在，创建新条目
      currentLives.set(key, {
        key,
        name: site.name,
        url: site.url,
        ua: site.ua,
        epg: site.epg,
        channelNumber: 0,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有 LiveConfig 是否在 fileConfig.lives 中，如果不在则标记为 custom
  const livesFromFileKeys = new Set(livesFromFile.map(([key]) => key));
  currentLives.forEach((live) => {
    if (!livesFromFileKeys.has(live.key)) {
      live.from = 'custom';
    }
  });

  // 文件为权威来源：按文件顺序重建数组，文件外的手动源按原顺序排在后面
  adminConfig.LiveConfig = [
    ...livesFromFile.map(([key]) => currentLives.get(key)!),
    ...Array.from(currentLives.values()).filter(
      (live) => !livesFromFileKeys.has(live.key),
    ),
  ];

  // 弹幕 API：订阅文件的 danmu_api 优先，每次拉取保存都同步覆盖到站点配置。
  // 与 api_site/lives/custom_category 一致，文件为权威来源；手动在站点配置里
  // 改的值会被下一次拉取覆盖。文件未提供 danmu_api 时保留现有配置不动。
  const fileDanmuApi = fileConfig.danmu_api;
  if (fileDanmuApi?.url) {
    adminConfig.SiteConfig.DanmuApi = {
      url: fileDanmuApi.url,
      token: fileDanmuApi.token,
    };
  }

  return adminConfig;
}

async function getInitConfig(
  configFile: string,
  subConfig: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  } = {
    URL: '',
    AutoUpdate: false,
    LastCheck: '',
  },
): Promise<AdminConfig> {
  let cfgFile: ConfigFileStruct;
  try {
    cfgFile = JSON.parse(configFile) as ConfigFileStruct;
  } catch (e) {
    cfgFile = {} as ConfigFileStruct;
  }
  const adminConfig: AdminConfig = {
    ConfigFile: configFile,
    ConfigSubscribtion: subConfig,
    SiteConfig: {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'LabTV',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: cfgFile.cache_time || 7200,
      DoubanProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE ||
        'cmliussss-cdn-tencent',
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
      BgmProxyType:
        process.env.NEXT_PUBLIC_BGM_PROXY_TYPE || 'cmliussss-cdn-tencent',
      BgmProxy: process.env.NEXT_PUBLIC_BGM_PROXY || '',
      BgmImageProxyType:
        process.env.NEXT_PUBLIC_BGM_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent',
      BgmImageProxy: process.env.NEXT_PUBLIC_BGM_IMAGE_PROXY || '',
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
      FluidSearch: process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
      OpenRegister: process.env.NEXT_PUBLIC_OPEN_REGISTER === 'true',
      DanmuApi: null,
    },
    UserConfig: {
      Users: [],
    },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
    TvBoxConfig: {
      disabled: true,
      sync: false,
      proxyFilterAds: false,
      expireSeconds: 7200,
    },
    FeaturesConfig: {
      douban: true,
      shortDrama: true,
      source: false,
      live: false,
    },
  };

  // 补充用户信息
  let users: DbUser[] = [];
  try {
    users = await db.getAllUsers();
  } catch (e) {
    console.error('获取用户列表失败:', e);
  }
  const allUsers = users.map((u) => ({
    username: u.user_name,
    role: u.user_name !== process.env.USERNAME ? 'user' : 'owner',
    key: u.key,
    banned: false,
  }));
  adminConfig.UserConfig.Users = allUsers as any;

  // 从配置文件中补充源信息
  Object.entries(cfgFile.api_site || []).forEach(([key, site]) => {
    adminConfig.SourceConfig.push({
      key: key,
      name: site.name,
      api: site.api,
      detail: site.detail,
      filter_ads: site.filter_ads !== false,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充自定义分类信息
  cfgFile.custom_category?.forEach((category) => {
    adminConfig.CustomCategories.push({
      name: category.name || category.query,
      type: category.type,
      query: category.query,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充直播源信息
  Object.entries(cfgFile.lives || []).forEach(([key, live]) => {
    if (!adminConfig.LiveConfig) {
      adminConfig.LiveConfig = [];
    }
    adminConfig.LiveConfig.push({
      key,
      name: live.name,
      url: live.url,
      ua: live.ua,
      epg: live.epg,
      channelNumber: 0,
      from: 'config',
      disabled: false,
    });
  });

  return adminConfig;
}

const getCachedConfig = unstable_cache(
  async () => {
    let config: AdminConfig | null = null;
    try {
      config = await db.getAdminConfig();
    } catch (e) {
      console.error('获取管理员配置失败:', e);
    }

    if (!config) {
      config = await getInitConfig('');
      const key = await db.registerUser(
        process.env.USERNAME!,
        process.env.PASSWORD! || '123456',
      );
      config.UserConfig.Users.unshift({
        username: process.env.USERNAME!,
        key: key as string,
        role: 'owner',
        banned: false,
      });
      await db.saveAdminConfig(config);
    }

    return configSelfCheck(config);
  },
  [CACHE_TAG],
  {
    revalidate: false,
    tags: [CACHE_TAG],
  },
);

export async function getConfig(): Promise<AdminConfig> {
  return getCachedConfig();
}

export function configSelfCheck(adminConfig: AdminConfig): AdminConfig {
  // 确保必要的属性存在和初始化
  if (!adminConfig.UserConfig) {
    adminConfig.UserConfig = { Users: [] };
  }
  if (
    !adminConfig.UserConfig.Users ||
    !Array.isArray(adminConfig.UserConfig.Users)
  ) {
    adminConfig.UserConfig.Users = [];
  }
  if (!adminConfig.SourceConfig || !Array.isArray(adminConfig.SourceConfig)) {
    adminConfig.SourceConfig = [];
  }
  if (
    !adminConfig.CustomCategories ||
    !Array.isArray(adminConfig.CustomCategories)
  ) {
    adminConfig.CustomCategories = [];
  }
  if (!adminConfig.LiveConfig || !Array.isArray(adminConfig.LiveConfig)) {
    adminConfig.LiveConfig = [];
  }
  if (!adminConfig.SiteConfig.BgmImageProxyType) {
    adminConfig.SiteConfig.BgmImageProxyType = 'cmliussss-cdn-tencent';
  }
  if (!adminConfig.SiteConfig.BgmProxyType) {
    adminConfig.SiteConfig.BgmProxyType = 'cmliussss-cdn-tencent';
  }
  if (!adminConfig.SiteConfig.BgmImageProxy) {
    adminConfig.SiteConfig.BgmImageProxy = '';
  }
  if (!adminConfig.SiteConfig.BgmProxy) {
    adminConfig.SiteConfig.BgmProxy = '';
  }
  if (adminConfig.SiteConfig.DanmuApi === undefined) {
    adminConfig.SiteConfig.DanmuApi = null;
  }
  // 站长变更自检
  // const ownerUser = process.env.USERNAME;

  // 去重
  const seenUsernames = new Set<string>();
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter((user) => {
    if (seenUsernames.has(user.username)) {
      return false;
    }
    seenUsernames.add(user.username);
    return true;
  });
  // 过滤站长
  //const originOwnerCfg = adminConfig.UserConfig.Users.find(
  //  (u) => u.username === ownerUser
  //);
  //adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter(
  //  (user) => user.username !== ownerUser
  //);
  // 其他用户不得拥有 owner 权限
  //adminConfig.UserConfig.Users.forEach((user) => {
  //  if (user.role === 'owner') {
  //    user.role = 'user';
  //  }
  //});
  // 重新添加回站长
  // adminConfig.UserConfig.Users.unshift({
  //   username: ownerUser!,
  //   role: 'owner',
  //   banned: false,
  //   enabledApis: originOwnerCfg?.enabledApis || undefined,
  //  tags: originOwnerCfg?.tags || undefined,
  //});

  // 采集源去重
  const seenSourceKeys = new Set<string>();
  adminConfig.SourceConfig = adminConfig.SourceConfig.filter((source) => {
    if (seenSourceKeys.has(source.key)) {
      return false;
    }
    seenSourceKeys.add(source.key);
    return true;
  });

  // 自定义分类去重
  const seenCustomCategoryKeys = new Set<string>();
  adminConfig.CustomCategories = adminConfig.CustomCategories.filter(
    (category) => {
      if (seenCustomCategoryKeys.has(category.query + category.type)) {
        return false;
      }
      seenCustomCategoryKeys.add(category.query + category.type);
      return true;
    },
  );

  // 直播源去重
  const seenLiveKeys = new Set<string>();
  adminConfig.LiveConfig = adminConfig.LiveConfig.filter((live) => {
    if (seenLiveKeys.has(live.key)) {
      return false;
    }
    seenLiveKeys.add(live.key);
    return true;
  });

  // 顺序兜底：库里存的是历史合并顺序（已存在条目原地保留），重新部署后不会自动重排，
  // 所以每次读配置时按配置文件里的 key 顺序再排一次（文件外的条目排在后面）。
  applyFileOrder(adminConfig);

  return adminConfig;
}

/**
 * 按 `ConfigFile` 的 key 顺序重排源/直播源/自定义分类。
 * 只调整顺序，不增删条目；文件里没有的（手动添加）条目保持原相对顺序排在后面。
 */
function applyFileOrder(adminConfig: AdminConfig): void {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile || '{}') as ConfigFileStruct;
  } catch {
    return;
  }

  const reorder = <T>(
    items: T[] | undefined,
    fileKeys: string[],
    keyOf: (item: T) => string,
  ): T[] | undefined => {
    if (!items || items.length === 0 || fileKeys.length === 0) {
      return items;
    }
    const rank = new Map(fileKeys.map((key, index) => [key, index]));
    const fromFile = items
      .filter((item) => rank.has(keyOf(item)))
      .sort((a, b) => rank.get(keyOf(a))! - rank.get(keyOf(b))!);
    const extra = items.filter((item) => !rank.has(keyOf(item)));
    return [...fromFile, ...extra];
  };

  adminConfig.SourceConfig =
    reorder(
      adminConfig.SourceConfig,
      Object.keys(fileConfig.api_site || {}),
      (source) => source.key,
    ) || [];
  adminConfig.LiveConfig =
    reorder(
      adminConfig.LiveConfig,
      Object.keys(fileConfig.lives || {}),
      (live) => live.key,
    ) || [];
  adminConfig.CustomCategories =
    reorder(
      adminConfig.CustomCategories,
      (fileConfig.custom_category || []).map((c) => c.query + c.type),
      (category) => category.query + category.type,
    ) || [];
}

export async function resetConfig() {
  let originConfig: AdminConfig | null = null;
  try {
    originConfig = await db.getAdminConfig();
  } catch (e) {
    console.error('获取管理员配置失败:', e);
  }
  if (!originConfig) {
    originConfig = {} as AdminConfig;
  }
  const adminConfig = await getInitConfig(
    originConfig.ConfigFile,
    originConfig.ConfigSubscribtion,
  );
  setCachedConfig(adminConfig);

  return;
}

export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  const config = await getConfig();
  const allApiSites = config.SourceConfig.filter((s) => !s.disabled);
  if (!user) {
    return allApiSites;
  }

  const userConfig = config.UserConfig.Users.find((u) => u.username === user);
  if (!userConfig) {
    return allApiSites;
  }

  // 优先根据用户自己的 enabledApis 配置查找
  if (userConfig.enabledApis && userConfig.enabledApis.length > 0) {
    const userApiSitesSet = new Set(userConfig.enabledApis);
    return allApiSites
      .filter((s) => userApiSitesSet.has(s.key))
      .map((s) => ({
        key: s.key,
        name: s.name,
        api: s.api,
        detail: s.detail,
        filter_ads: s.filter_ads,
      }));
  }

  // 如果没有 enabledApis 配置，则根据 tags 查找
  if (userConfig.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
    const enabledApisFromTags = new Set<string>();

    // 遍历用户的所有 tags，收集对应的 enabledApis
    userConfig.tags.forEach((tagName) => {
      const tagConfig = config.UserConfig.Tags?.find((t) => t.name === tagName);
      if (tagConfig && tagConfig.enabledApis) {
        tagConfig.enabledApis.forEach((apiKey) =>
          enabledApisFromTags.add(apiKey),
        );
      }
    });

    if (enabledApisFromTags.size > 0) {
      return allApiSites
        .filter((s) => enabledApisFromTags.has(s.key))
        .map((s) => ({
          key: s.key,
          name: s.name,
          api: s.api,
          detail: s.detail,
          filter_ads: s.filter_ads,
        }));
    }
  }

  // 如果都没有配置，返回所有可用的 API 站点
  return allApiSites;
}

export async function setCachedConfig(config: AdminConfig) {
  await db.saveAdminConfig(config);
  revalidateTag(CACHE_TAG, { expire: 0 });
}
