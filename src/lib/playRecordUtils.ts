/**
 * 播放记录判重涉及的字段（服务端与客户端的 PlayRecord 定义略有差异，这里只取公共部分）。
 */
interface VideoRecordLike {
  title?: string;
  year?: string;
  total_episodes?: number;
  save_time?: number;
}

/**
 * 归一化影片标题：全角转半角、去掉空白与常见标点、转小写。
 */
const normalizeVideoTitle = (title?: string): string =>
  (title || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[·・:：\-—_、,，.。!！?？'"“”‘’()[\]【】]/g, '')
    .toLowerCase();

/**
 * 判断两条播放记录是否指向同一部影片（同一部剧的不同播放源）。
 * 以「归一化标题 + 年份」判定，年份任一缺失时只比标题；
 * 集数相差一倍以上（如电影 1 集 vs 剧集 40 集）视为不同影片。
 */
export const isSameVideoRecord = (
  a: VideoRecordLike,
  b: VideoRecordLike,
): boolean => {
  const titleA = normalizeVideoTitle(a.title);
  if (!titleA || titleA !== normalizeVideoTitle(b.title)) return false;

  const yearA = (a.year || '').trim();
  const yearB = (b.year || '').trim();
  if (yearA && yearB && yearA !== yearB) return false;

  const episodesA = a.total_episodes || 0;
  const episodesB = b.total_episodes || 0;
  if (episodesA > 0 && episodesB > 0) {
    const min = Math.min(episodesA, episodesB);
    const max = Math.max(episodesA, episodesB);
    if (min * 2 < max) return false;
  }

  return true;
};

/**
 * 从全量播放记录中挑出需要删除的重复项：同一影片不同源只保留 save_time 最新的一条。
 * 返回待删除的 storage key 列表。
 */
export const pickDuplicatePlayRecordKeys = (
  records: Record<string, VideoRecordLike>,
): string[] => {
  const kept: VideoRecordLike[] = [];
  const removedKeys: string[] = [];

  Object.entries(records)
    .sort((a, b) => (b[1].save_time ?? 0) - (a[1].save_time ?? 0))
    .forEach(([key, record]) => {
      if (kept.some((item) => isSameVideoRecord(item, record))) {
        removedKeys.push(key);
      } else {
        kept.push(record);
      }
    });

  return removedKeys;
};
