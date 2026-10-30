/// <reference types="jest" />
/* global describe, it, expect */

import { AdminConfig } from '@/lib/admin.types';
import { parseCommentResponse, resolveDanmuApiConfig } from '@/lib/danmu';

const buildConfig = (overrides: Partial<AdminConfig> = {}): AdminConfig =>
  ({
    ConfigSubscribtion: { URL: '', AutoUpdate: false, LastCheck: '' },
    ConfigFile: '{}',
    SiteConfig: {
      SiteName: 'test',
      Announcement: '',
      SearchDownstreamMaxPage: 5,
      SiteInterfaceCacheTime: 7200,
      DoubanProxyType: '',
      DoubanProxy: '',
      DoubanImageProxyType: '',
      DoubanImageProxy: '',
      BgmProxyType: '',
      BgmProxy: '',
      BgmImageProxyType: '',
      BgmImageProxy: '',
      DisableYellowFilter: false,
      FluidSearch: true,
      OpenRegister: false,
      DanmuApi: null,
    },
    UserConfig: { Users: [] },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
    ...overrides,
  }) as AdminConfig;

describe('resolveDanmuApiConfig', () => {
  it('未配置时返回 none', () => {
    const result = resolveDanmuApiConfig(buildConfig());
    expect(result.source).toBe('none');
    expect(result.url).toBe('');
  });

  it('站点配置优先', () => {
    const config = buildConfig();
    config.SiteConfig.DanmuApi = {
      url: 'https://site.example.com/',
      token: 'site-token',
    };
    config.ConfigFile = JSON.stringify({
      danmu_api: { url: 'https://file.example.com', token: 'file-token' },
    });

    const result = resolveDanmuApiConfig(config);
    expect(result.source).toBe('site');
    expect(result.url).toBe('https://site.example.com');
    expect(result.token).toBe('site-token');
  });

  it('站点未配置时回落到配置文件', () => {
    const config = buildConfig();
    config.ConfigFile = JSON.stringify({
      danmu_api: { url: 'https://file.example.com/', token: 'file-token' },
    });

    const result = resolveDanmuApiConfig(config);
    expect(result.source).toBe('file');
    expect(result.url).toBe('https://file.example.com');
    expect(result.token).toBe('file-token');
  });

  it('配置文件无效时视为未配置', () => {
    const config = buildConfig();
    config.ConfigFile = 'not-a-json';
    expect(resolveDanmuApiConfig(config).source).toBe('none');
  });

  it('配置文件中缺少 danmu_api 时视为未配置', () => {
    const config = buildConfig();
    config.ConfigFile = JSON.stringify({ api_site: {} });
    expect(resolveDanmuApiConfig(config).source).toBe('none');
  });
});

describe('parseCommentResponse', () => {
  it('解析 dandanplay 原始格式（p/m 字段）', () => {
    const result = parseCommentResponse({
      count: 2,
      comments: [
        { cid: 1, p: '12.50,1,16777215,[dandan]', m: '滚动弹幕', t: 0 },
        { cid: 2, p: '30.00,5,16711680,[dandan]', m: '顶部弹幕', t: 0 },
      ],
    });

    expect(result.count).toBe(2);
    expect(result.comments[0]).toEqual({
      time: 12.5,
      text: '滚动弹幕',
      color: '#FFFFFF',
      mode: 0,
    });
    // dandanplay mode 5=顶部 → artplayer mode 1
    expect(result.comments[1]).toEqual({
      time: 30,
      text: '顶部弹幕',
      color: '#FF0000',
      mode: 1,
    });
  });

  it('解析 dandanplay mode 4=底部 → artplayer mode 2', () => {
    const result = parseCommentResponse({
      comments: [{ cid: 1, p: '5.00,4,255,255,0', m: '底部' }],
    });
    expect(result.comments[0].mode).toBe(2);
  });

  it('解析 artplayer.json 格式', () => {
    const result = parseCommentResponse({
      danmuku: [{ text: 'hello', time: 8, mode: 1, color: '#00FF00' }],
    });
    expect(result.comments).toEqual([
      { text: 'hello', time: 8, color: '#00FF00', mode: 1 },
    ]);
  });

  it('解析标准 dandanplay json 格式', () => {
    const result = parseCommentResponse({
      comments: [{ time: 3, text: 'std', color: 16777215, mode: 1 }],
    });
    expect(result.comments).toEqual([
      { time: 3, text: 'std', color: '#FFFFFF', mode: 0 },
    ]);
  });

  it('空响应返回空列表', () => {
    expect(parseCommentResponse({ count: 0, comments: [] }).comments).toEqual(
      [],
    );
    expect(parseCommentResponse(null).comments).toEqual([]);
  });
});
