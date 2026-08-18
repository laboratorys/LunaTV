/* eslint-disable no-console */

import { ShortDramaItem } from '@/lib/types';

// 原始 JSON 的接口定义
interface RawBannerItem {
  series_id: string;
  series_name: string;
  series_cover?: string;
  background_cover_pc?: string;
  series_intro?: string;
  tags?: string[];
  episode_right_text?: string;
}

interface ShortDramaApiResponse {
  isSuccess: boolean;
  videoList: RawBannerItem[];
  hasMore: boolean;
  nextOffset?: number;
  snapshotId?: string;
}

/**
 * 短剧（红果）
 * @param page 当前页码 (从 1 开始)
 * @param pageSize 每页条数
 * @param snapshotId 上一次请求返回的快照 ID（用于后续页 API 翻页）
 */
export async function fetchHotShortDramaPaged(
  page = 1,
  pageSize = 20,
  snapshotId?: string,
): Promise<{
  list: ShortDramaItem[];
  total: number;
  page: number;
  totalPage: number;
  snapshotId?: string;
}> {
  const TARGET_URL = 'https://novelquickapp.com/';
  const API_BASE_URL = 'https://hongguoduanju.com/api/home/recommendations';

  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

  try {
    let rawList: RawBannerItem[] = [];
    let currentSnapshotId = snapshotId;

    if (page === 1 || !currentSnapshotId) {
      // 1. 第一页：抓取 HTML 并解析 data-fn-args
      const response = await fetch(TARGET_URL, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Referer: TARGET_URL,
        },
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        throw new Error(`Fetch failed with status: ${response.status}`);
      }

      const html = await response.text();

      // 正则匹配 data-fn-args
      const regex = /data-fn-args=["'](.*?)["']/gs;
      const matches = html.matchAll(regex);

      let found = false;
      for (const match of matches) {
        let content = match[1];
        if (content.includes('&quot;')) {
          content = content.replace(/&quot;/g, '"');
        }

        try {
          const jsonElement = JSON.parse(content);
          if (Array.isArray(jsonElement)) {
            const dataObject = jsonElement.find(
              (item: any) =>
                item && typeof item === 'object' && 'videoList' in item,
            );
            if (dataObject) {
              const parsed = dataObject as ShortDramaApiResponse;
              if (parsed.isSuccess) {
                if (parsed.snapshotId) {
                  currentSnapshotId = parsed.snapshotId;
                }
                rawList = parsed.videoList || [];
                found = true;
                break;
              }
            }
          }
        } catch {
          // 忽略解析失败项，继续匹配下一个
        }
      }

      if (!found) {
        console.warn('Could not find valid videoList in data-fn-args');
      }

      // 截取第一页的 pageSize 大小
      rawList = rawList.slice(0, pageSize);
    } else {
      // 2. 后续页：使用传入的 snapshotId 调用 API 获取
      const offset = (page - 2) * pageSize;
      const url = `${API_BASE_URL}?snapshot_id=${currentSnapshotId}&offset=${offset}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Referer: TARGET_URL,
        },
        cache: 'no-store', // 翻页数据不走静态缓存
      });

      if (!response.ok) {
        throw new Error(`API fetch failed with status: ${response.status}`);
      }

      const apiResponse: ShortDramaApiResponse = await response.json();
      if (apiResponse.snapshotId) {
        currentSnapshotId = apiResponse.snapshotId;
      }
      rawList = apiResponse.videoList || [];
    }

    // 映射成前端统一的 ShortDramaItem 格式
    const list: ShortDramaItem[] = rawList.map((item) => ({
      vod_id: item.series_id,
      vod_name: item.series_name,
      vod_pic: item.series_cover || item.background_cover_pc || '',
      vod_tag: '//' + (item.tags ? item.tags.join(' ') : ''),
      vod_remarks: item.episode_right_text || (item.tags ? item.tags[0] : ''),
    }));

    // 计算总数与总页数估算
    const total =
      page === 1
        ? list.length < pageSize
          ? list.length
          : pageSize * 10
        : page * pageSize;
    const totalPage = Math.ceil(total / pageSize);

    return {
      list,
      total,
      page,
      totalPage,
      snapshotId: currentSnapshotId, // 将更新后的 snapshotId 编码返回给前端
    };
  } catch (error) {
    console.error('Short Drama Scraper Error:', error);
    return { list: [], total: 0, page, totalPage: 0 };
  }
}
