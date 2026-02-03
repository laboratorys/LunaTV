/* eslint-disable no-console */

import { ShortDramaItem } from '@/lib/types';

// 原始 JSON 的接口
interface RawBannerItem {
  series_id: string;
  series_name: string;
  series_cover: string;
  background_cover_pc: string;
  series_intro: string;
  tags: string[];
  episode_right_text?: string;
}

/**
 * 短剧（红果）
 */
export async function fetchHotShortDramaPaged(
  page = 1,
  pageSize = 20
): Promise<{
  list: ShortDramaItem[];
  total: number;
  page: number;
  totalPage: number;
}> {
  const TARGET_URL = 'https://novelquickapp.com/';

  try {
    const response = await fetch(TARGET_URL, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        Referer: 'https://novelquickapp.com/',
      },
      // Next.js ISR: 缓存一小时
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status: ${response.status}`);
    }

    const html = await response.text();

    // 正则匹配 window._ROUTER_DATA
    const regex = /window\._ROUTER_DATA\s*=\s*({[\s\S]*?})(?:;|<\/script>)/;
    const match = html.match(regex);

    if (!match || !match[1]) {
      console.warn('Could not find _ROUTER_DATA in page source');
      return { list: [], total: 0, page, totalPage: 0 };
    }
    const rawData = JSON.parse(match[1]);
    const hotList: RawBannerItem[] = rawData.loaderData?.page?.videoList || [];
    const total = hotList.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const totalPage = Math.ceil(total / pageSize);
    const pagedItems = hotList.slice(startIndex, endIndex);
    const list = pagedItems.map((item) => ({
      vod_id: item.series_id,
      vod_name: item.series_name,
      vod_pic: item.series_cover || item.background_cover_pc,
      vod_tag: item.tags?.join(', ') || '',
      vod_remarks: item.episode_right_text || (item.tags ? item.tags[0] : ''),
    }));

    return {
      list,
      total,
      page,
      totalPage,
    };
  } catch (error) {
    console.error('Short Drama Scraper Error:', error);
    return { list: [], total: 0, page, totalPage: 0 };
  }
}
