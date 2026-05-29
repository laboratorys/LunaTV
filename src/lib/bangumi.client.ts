'use client';

export interface BangumiCalendarData {
  weekday: {
    en: string;
    id: number;
  };
  items: {
    id: number;
    name: string;
    name_cn: string;
    rating: {
      score: number;
    };
    air_date: string;
    images: {
      large: string;
      common: string;
      medium: string;
      small: string;
      grid: string;
    };
  }[];
}

function getBgmProxyConfig(): {
  proxyType:
    | 'direct'
    | 'cmliussss-cdn-tencent'
    | 'cmliussss-cdn-ali'
    | 'custom';
  proxyUrl: string;
} {
  const bgmProxyType =
    localStorage.getItem('bgmDataSource') ||
    (window as any).RUNTIME_CONFIG?.BGM_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  const bgmProxy =
    localStorage.getItem('bgmProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.BGM_PROXY ||
    '';
  return {
    proxyType: bgmProxyType,
    proxyUrl: bgmProxy,
  };
}

function getCalendarUrl(): string {
  const config = getBgmProxyConfig();

  switch (config.proxyType) {
    case 'direct':
      return '/api/bangumi/calendar';
    case 'cmliussss-cdn-tencent':
      return 'https://img.doubanio.cmliussss.net/calendar';
    case 'cmliussss-cdn-ali':
      return 'https://img.doubanio.cmliussss.com/calendar';
    case 'custom':
      return `${config.proxyUrl}https://api.bgm.tv/calendar`;
    default:
      return '/api/bangumi/calendar';
  }
}

export async function GetBangumiCalendarData(): Promise<BangumiCalendarData[]> {
  const url = getCalendarUrl();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`获取番剧日历失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  const filteredData = data.map((item: BangumiCalendarData) => ({
    ...item,
    items: item.items.filter((bangumiItem) => bangumiItem.images),
  }));

  return filteredData;
}
