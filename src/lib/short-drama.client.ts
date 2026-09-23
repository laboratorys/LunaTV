/* eslint-disable no-console */

import { ShortDramaItem } from '@/lib/types';

export interface ShortDramaPageResult {
  list: ShortDramaItem[];
  snapshotId?: string;
  nextOffset?: number;
  hasMore: boolean;
}

/**
 * 红果真人短剧
 * @param page 页码，从 1 开始
 */
export const fetchHotShortDramaPaged = async (
  page = 1,
): Promise<ShortDramaPageResult> => {
  const url = `https://hongguoduanju.com/category/real-drama?page=${page}`;
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

  try {
    console.log(`[short-drama] fetch start page=${page} url=${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Referer: 'https://hongguoduanju.com/category/real-drama',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        `Category page fetch failed with status: ${response.status}`,
      );
    }

    const html = await response.text();
    console.log(`[short-drama] fetch ok page=${page} htmlLen=${html.length}`);

    const data = extractCategoryData(html);

    if (!data) {
      const idx = html.indexOf('_ROUTER_DATA');
      console.error(
        `[short-drama] _ROUTER_DATA not found/parse failed at page ${page}. html snippet:`,
        idx >= 0 ? html.slice(idx, idx + 200) : '(marker missing)',
      );
      throw new Error(
        `Category parse failed at page ${page} — 页面结构可能已变更`,
      );
    }

    const list: ShortDramaItem[] = data.recommendList.map((it) => ({
      vod_id: it.series_id,
      vod_name: it.series_name,
      vod_pic: it.series_cover,
      vod_tag: '//' + (Array.isArray(it.tags) ? it.tags.join(' ') : ''),
      vod_remarks: it.episode_right_text || `全${it.episode_cnt}集`,
    }));

    const totalPages = data.pagination?.totalPages ?? page;
    const hasMore = page < totalPages;
    const nextOffset = hasMore ? page + 1 : undefined;

    console.log(
      `[short-drama] page=${page} items=${list.length} pageNum=${data.pagination?.pageNum} totalPages=${totalPages} hasMore=${hasMore}`,
    );

    if (list.length === 0) {
      console.warn(
        `[short-drama] empty list at page ${page} (total=${data.pagination?.total})`,
      );
    }

    return { list, hasMore, nextOffset };
  } catch (error) {
    console.error('[short-drama] Short Drama Category Error:', error);
    return { list: [], hasMore: false };
  }
};

interface RawCategoryItem {
  series_id: string;
  series_name: string;
  series_cover: string;
  episode_cnt?: number;
  episode_right_text?: string;
  tags?: string[];
  series_intro?: string;
  pay_type?: number;
}

interface CategoryApiData {
  isSuccess?: boolean;
  recommendList: RawCategoryItem[];
  pagination?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

const extractCategoryData = (html: string): CategoryApiData | null => {
  const marker = '_ROUTER_DATA = ';
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  let depth = 0;
  let inStr = false;
  let strCh = '';
  let escaped = false;
  let end = -1;
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true;
      strCh = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;

  try {
    const router = JSON.parse(html.slice(jsonStart, end)) as {
      loaderData?: Record<string, CategoryApiData | null>;
    };
    const ld = router.loaderData ?? {};
    const cat =
      ld['category_$'] ??
      (Object.values(ld).find((v) => v && Array.isArray(v.recommendList)) as
        | CategoryApiData
        | undefined);
    if (!cat || !Array.isArray(cat.recommendList)) return null;
    return cat;
  } catch {
    return null;
  }
};
