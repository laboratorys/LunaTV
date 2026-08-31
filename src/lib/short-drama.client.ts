/* eslint-disable no-console */

import { ShortDramaItem } from '@/lib/types';

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
  isSuccess?: boolean;
  videoList: RawBannerItem[];
  hasMore: boolean;
  nextOffset?: number;
  snapshotId?: string;
}

export interface ShortDramaPageResult {
  list: ShortDramaItem[];
  snapshotId?: string;
  nextOffset?: number;
  hasMore: boolean;
}

/**
 * 短剧（红果）
 * 统一走 hongguoduanju.com 推荐接口，按服务端返回的 snapshotId / nextOffset 游标翻页。
 *
 * @param snapshotId  上一页返回的快照 ID
 * @param nextOffset  上一页返回的 nextOffset
 *
 */
export async function fetchHotShortDramaPaged(
  snapshotId?: string,
  nextOffset?: number,
): Promise<ShortDramaPageResult> {
  const API_BASE_URL = 'https://hongguoduanju.com/api/home/recommendations';

  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

  try {
    const currentSnapshotId = snapshotId || '0';
    const currentOffset = nextOffset ?? 0;

    const url = `${API_BASE_URL}?snapshot_id=${currentSnapshotId}&offset=${currentOffset}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Referer: 'https://hongguoduanju.com/',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API fetch failed with status: ${response.status}`);
    }

    const apiResponse: ShortDramaApiResponse = await response.json();

    const list: ShortDramaItem[] = (apiResponse.videoList || []).map(
      (item) => ({
        vod_id: item.series_id,
        vod_name: item.series_name,
        vod_pic: item.series_cover || item.background_cover_pc || '',
        vod_tag: '//' + (item.tags ? item.tags.join(' ') : ''),
        vod_remarks: item.episode_right_text || (item.tags ? item.tags[0] : ''),
      }),
    );

    const hasMore = !!apiResponse.hasMore;
    const returnedSnapshotId = apiResponse.snapshotId || currentSnapshotId;
    const returnedNextOffset =
      apiResponse.nextOffset ?? currentOffset + list.length;

    return {
      list,
      snapshotId: returnedSnapshotId,
      nextOffset: returnedNextOffset,
      hasMore,
    };
  } catch (error) {
    console.error('Short Drama API Error:', error);
    return {
      list: [],
      hasMore: false,
    };
  }
}
