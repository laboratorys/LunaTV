import { AdminConfig } from './admin.types';

/**
 * 弹幕 API（danmu_api）配置解析与客户端。
 * 仅支持兼容弹弹play接口规范的自建/第三方 danmu_api 服务。
 */

export interface ResolvedDanmuApi {
  url: string;
  token?: string;
  source: 'site' | 'file' | 'none';
}

export interface DanmuApiConfigFile {
  url?: string;
  token?: string;
}

export interface DanmuMatchCandidate {
  animeId: number;
  animeTitle: string;
  episodeId?: number;
  episodeTitle?: string;
  source?: string;
}

export interface DanmuEpisode {
  episodeId: number;
  episodeTitle?: string;
}

export interface DanmuComment {
  time: number;
  text: string;
  color: string;
  mode: number;
}

export interface DanmuMatchResult {
  matched: boolean;
  candidates: DanmuMatchCandidate[];
  message?: string;
}

export interface DanmuCommentResult {
  count: number;
  comments: DanmuComment[];
  duration?: number;
}

const MATCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const COMMENT_CACHE_TTL = 6 * 60 * 60 * 1000;
// 剧集列表随上游变动，缓存不宜过久
const EPISODES_CACHE_TTL = 6 * 60 * 60 * 1000;

// danmu_api 上游冷查询常需 20s 以上（命中服务端缓存后 <1s），超时需留足余量
const MATCH_TIMEOUT = 30000;
const COMMENT_TIMEOUT = 30000;

// 边缘节点多 IP 时部分地址不可达，重试可命中正常节点
const MAX_RETRY = 3;
const RETRY_DELAY = 800;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface CacheEntry<T> {
  value: T;
  expireAt: number;
}

const matchCache = new Map<string, CacheEntry<DanmuMatchResult>>();
const commentCache = new Map<string, CacheEntry<DanmuCommentResult>>();

const getCache = <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): T | null => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const setCache = <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttl: number,
): void => {
  cache.set(key, { value, expireAt: Date.now() + ttl });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
};

/**
 * 解析弹幕 API 配置：站点配置优先，配置文件兜底。
 */
export const resolveDanmuApiConfig = (
  adminConfig: AdminConfig,
): ResolvedDanmuApi => {
  const site = adminConfig.SiteConfig?.DanmuApi;
  const siteUrl = site?.url?.trim();
  if (siteUrl) {
    return {
      url: siteUrl.replace(/\/+$/, ''),
      token: site?.token?.trim() || undefined,
      source: 'site',
    };
  }

  try {
    const fileConfig = JSON.parse(adminConfig.ConfigFile || '{}') as {
      danmu_api?: DanmuApiConfigFile;
    };
    const fileUrl = fileConfig.danmu_api?.url?.trim();
    if (fileUrl) {
      return {
        url: fileUrl.replace(/\/+$/, ''),
        token: fileConfig.danmu_api?.token?.trim() || undefined,
        source: 'file',
      };
    }
  } catch (e) {
    // 配置文件解析失败时视为未配置
  }

  return { url: '', token: undefined, source: 'none' };
};

/**
 * 拼接带 TOKEN 的接口地址。TOKEN 非空时作为路径前缀（danmu_api 默认约定）。
 */
const buildApiUrl = (
  baseUrl: string,
  token: string | undefined,
  path: string,
): string => {
  const prefix = token ? `/${encodeURIComponent(token)}` : '';
  return `${baseUrl}${prefix}${path}`;
};

const normalizeColor = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, '0').slice(-6).toUpperCase()}`;
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith('#')) return trimmed.toUpperCase();
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  }
  return '#FFFFFF';
};

const normalizeMode = (value: unknown): number => {
  if (value === 0 || value === 1 || value === 2) return value;
  return 0;
};

// 弹弹play 的 mode 约定：1=滚动 4=底部 5=顶部；artplayer 插件约定：0=滚动 1=顶部 2=底部
const normalizeDandanMode = (value: unknown): number => {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  if (v === 1) return 0;
  if (v === 4) return 2;
  if (v === 5) return 1;
  return 0;
};

/**
 * 从 danmu_api 的 match 响应中提取候选集。
 * 服务端返回扁平结构：{ animeId, animeTitle, episodeId, episodeTitle, ... }
 */
const parseMatchResponse = (payload: unknown): DanmuMatchResult => {
  const root = (payload || {}) as any;
  const matches: any[] = Array.isArray(root.matches)
    ? root.matches
    : Array.isArray(root.animes)
      ? root.animes
      : [];

  const candidates: DanmuMatchCandidate[] = [];
  matches.forEach((item) => {
    const anime = item.anime || item;
    const episode = item.episode || item.episodes?.[0] || item;
    const animeId = Number(anime.animeId ?? item.animeId);
    if (!Number.isFinite(animeId) || animeId <= 0) return;
    const episodeId = Number(episode.episodeId);
    candidates.push({
      animeId,
      animeTitle: String(anime.animeTitle ?? item.animeTitle ?? ''),
      episodeId: Number.isFinite(episodeId) ? episodeId : undefined,
      episodeTitle: episode.episodeTitle
        ? String(episode.episodeTitle)
        : undefined,
      source: item.source ?? anime.source,
    });
  });

  return {
    matched: candidates.length > 0,
    candidates,
    message: root.message ?? root.error,
  };
};

/**
 * 解析 dandanplay 的 p 字段：`时间,模式,颜色,用户hash`
 * 例：'0.00,1,16777215,[dandan]'
 */
const parseDandanP = (
  p: unknown,
): { time: number; mode: number; color: string } | null => {
  if (typeof p !== 'string') return null;
  const parts = p.split(',');
  const time = Number(parts[0]);
  if (!Number.isFinite(time)) return null;
  const mode = Number(parts[1]);
  const color = Number(parts[2]);
  return {
    time,
    mode: Number.isFinite(mode) ? mode : 1,
    color: Number.isFinite(color)
      ? `#${color.toString(16).padStart(6, '0').slice(-6).toUpperCase()}`
      : '#FFFFFF',
  };
};

/**
 * 从 comment 响应中提取弹幕列表，兼容 artplayer.json、dandanplay 原始格式与标准 dandanplay json。
 */
export const parseCommentResponse = (payload: unknown): DanmuCommentResult => {
  const root = (payload || {}) as any;

  // artplayer.json: { danmuku: [{ text, time, mode, color }] }
  const artplayerList: any[] = Array.isArray(root.danmuku)
    ? root.danmuku
    : Array.isArray(root)
      ? root
      : [];

  if (artplayerList.length > 0) {
    const comments: DanmuComment[] = [];
    artplayerList.forEach((item) => {
      const time = Number(item?.time);
      const text = typeof item?.text === 'string' ? item.text : '';
      if (!Number.isFinite(time) || !text) return;
      comments.push({
        time,
        text,
        color: normalizeColor(item?.color),
        mode: normalizeMode(item?.mode),
      });
    });
    return { count: comments.length, comments };
  }

  // dandanplay 原始格式: { comments: [{ cid, p: '时间,模式,颜色,hash', m: '文本', t }] }
  // 标准 dandanplay json: { comments: [{ time, text, color, mode }] }
  const dandanList: any[] = Array.isArray(root.comments) ? root.comments : [];

  const comments: DanmuComment[] = [];
  dandanList.forEach((item) => {
    const text =
      typeof item?.m === 'string'
        ? item.m
        : typeof item?.text === 'string'
          ? item.text
          : '';
    if (!text) return;

    const parsed = parseDandanP(item?.p);
    if (parsed) {
      comments.push({
        time: parsed.time,
        text,
        color: parsed.color,
        mode: normalizeDandanMode(parsed.mode),
      });
      return;
    }

    const time = Number(item?.time ?? item?.t);
    if (!Number.isFinite(time)) return;
    comments.push({
      time,
      text,
      color: normalizeColor(item?.color),
      mode: normalizeDandanMode(item?.mode),
    });
  });

  return {
    count: Number.isFinite(Number(root.count))
      ? Number(root.count)
      : comments.length,
    comments,
    duration: Number.isFinite(Number(root.videoDuration))
      ? Number(root.videoDuration)
      : undefined,
  };
};

/**
 * 单次请求。返回 null 表示可重试的网络故障。
 */
const fetchOnce = async (
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; retryable: boolean; message: string }
> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      // 5xx 与 429 视为可重试
      const retryable = response.status >= 500 || response.status === 429;
      return {
        ok: false,
        retryable,
        message: `danmu_api 请求失败: HTTP ${response.status}`,
      };
    }
    return { ok: true, data: await response.json() };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return {
        ok: false,
        retryable: true,
        message: `danmu_api 请求超时 (${Math.round(timeoutMs / 1000)}s)`,
      };
    }
    // 连接层错误（DNS/TCP/边缘节点不可达）可重试
    return {
      ok: false,
      retryable: true,
      message: `danmu_api 连接失败: ${(err as Error)?.message || 'unknown'}`,
    };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 带重试的 JSON 请求。
 * danmu_api 常部署在 Vercel 等多 IP 边缘节点上，部分 IP 连通性差，
 * 首次连接超时后重试通常可命中正常节点。
 */
const requestJson = async (
  url: string,
  init?: RequestInit,
  timeoutMs = MATCH_TIMEOUT,
): Promise<unknown> => {
  let lastMessage = 'danmu_api 请求失败';
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const result = await fetchOnce(url, init, timeoutMs);
    if (result.ok) return result.data;
    lastMessage = result.message;
    if (!result.retryable) break;
    if (attempt < MAX_RETRY - 1) {
      await sleep(RETRY_DELAY * (attempt + 1));
    }
  }
  throw new Error(lastMessage);
};

// 弹幕评论接口对不存在的集数返回 404（body 仍为合法 JSON），视为无弹幕。
const requestComment = async (
  url: string,
  init?: RequestInit,
  timeoutMs = COMMENT_TIMEOUT,
): Promise<unknown | null> => {
  let lastMessage = 'danmu_api 请求失败';
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init?.headers || {}),
        },
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        lastMessage = `danmu_api 请求失败: HTTP ${response.status}`;
        const retryable = response.status >= 500 || response.status === 429;
        if (!retryable) break;
      } else {
        return await response.json();
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        lastMessage = `danmu_api 请求超时 (${Math.round(timeoutMs / 1000)}s)`;
      } else {
        lastMessage = `danmu_api 连接失败: ${(err as Error)?.message || 'unknown'}`;
      }
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_RETRY - 1) {
      await sleep(RETRY_DELAY * (attempt + 1));
    }
  }
  throw new Error(lastMessage);
};

/**
 * 由视频标题与集数拼出弹幕服务可识别的文件名（服务会从中解析 title/season/episode）。
 */
const buildMatchFileName = (title: string, episode?: number): string => {
  if (!episode || episode < 1) return title;
  const e = String(episode).padStart(2, '0');
  return `${title}.S01E${e}.mkv`;
};

/**
 * 按关键词搜索番剧（求索切换用）。
 * 传入 episode 时会额外调用 match 解析出对应集数的 episodeId。
 */
export const searchDanmu = async (
  api: ResolvedDanmuApi,
  keyword: string,
  episode?: number,
): Promise<DanmuMatchCandidate[]> => {
  if (!api.url) return [];

  const cacheKey = `${api.url}|search|${keyword}|${episode ?? ''}`;
  const cached = getCache(matchCache, cacheKey);
  if (cached) return cached.candidates;

  const payload = await requestJson(
    `${buildApiUrl(api.url, api.token, '/api/v2/search/anime')}?keyword=${encodeURIComponent(keyword)}`,
    undefined,
    MATCH_TIMEOUT,
  );

  const result = parseMatchResponse(payload);

  // search/anime 不返回 episodeId，用 match 精确解析当前集（只对与匹配结果同名的条目生效）
  if (episode && episode > 0 && result.candidates.length > 0) {
    // 关闭兜底，避免 match → search → match 递归
    const matched = await matchDanmu(api, { title: keyword, episode }, false);
    const exact = matched.candidates.find(
      (item) => item.animeId === result.candidates[0].animeId && item.episodeId,
    );
    if (exact?.episodeId) {
      result.candidates = result.candidates.map((item, index) =>
        index === 0 ? { ...item, episodeId: exact.episodeId } : item,
      );
    }
  }

  setCache(matchCache, cacheKey, result, MATCH_CACHE_TTL);
  return result.candidates;
};

/**
 * 标题匹配番剧，返回候选集。
 * danmu_api 兼容弹弹play /api/v2/match，请求体需携带 fileName（可同时带 title/episode）。
 * match 无结果时降级为关键词搜索，兼容影视剧等无番剧编号的条目。
 */
export const matchDanmu = async (
  api: ResolvedDanmuApi,
  params: { title: string; year?: string; episode?: number },
  allowFallback = true,
): Promise<DanmuMatchResult> => {
  if (!api.url) {
    return { matched: false, candidates: [], message: '未配置弹幕 API' };
  }

  const cacheKey = `${api.url}|match|${params.title}|${params.year || ''}|${params.episode ?? ''}`;
  const cached = getCache(matchCache, cacheKey);
  if (cached) return cached;

  const fileName = buildMatchFileName(params.title, params.episode);
  const payload = await requestJson(
    buildApiUrl(api.url, api.token, '/api/v2/match'),
    {
      method: 'POST',
      body: JSON.stringify({
        fileName,
        title: params.title,
        ...(params.year ? { year: params.year } : {}),
        ...(params.episode ? { episode: params.episode } : {}),
      }),
    },
    MATCH_TIMEOUT,
  );

  let result = parseMatchResponse(payload);
  if (!result.matched && allowFallback) {
    // match 未命中时用关键词搜索兜底（影视剧常无番剧条目）
    const candidates = await searchDanmu(api, params.title);
    if (candidates.length > 0) {
      result = { matched: true, candidates };
    }
  }

  setCache(matchCache, cacheKey, result, MATCH_CACHE_TTL);
  return result;
};

/**
 * 拉取弹幕。
 * 优先使用匹配结果中的 episodeId（由服务按文件名解析，精度更高）；
 * 缺省时再按集序号从剧集列表中定位。
 */
export const getDanmuComments = async (
  api: ResolvedDanmuApi,
  params: {
    animeId: number;
    episodeId?: number;
    episode?: number;
    title?: string;
  },
): Promise<DanmuCommentResult> => {
  if (!api.url) {
    return { count: 0, comments: [] };
  }

  let commentId: number | undefined = params.episodeId;
  if (!commentId && params.episode && params.episode > 0) {
    // 优先用 match 精确解析集号（准确），失败再退回剧集列表
    const matched = await matchDanmu(
      api,
      {
        title: params.title || String(params.animeId),
        episode: params.episode,
      },
      false,
    );
    const hit = matched.candidates.find(
      (item) => item.animeId === params.animeId && item.episodeId,
    );
    if (hit?.episodeId) {
      commentId = hit.episodeId;
    } else {
      const episodes = await getAnimeEpisodes(api, params.animeId);
      const byIndex = episodes[params.episode - 1];
      if (byIndex?.episodeId) {
        commentId = byIndex.episodeId;
      }
    }
  }
  if (!commentId) {
    return { count: 0, comments: [] };
  }

  const cacheKey = `${api.url}|comment|${commentId}`;
  const cached = getCache(commentCache, cacheKey);
  if (cached) return cached;

  const payload = await requestComment(
    `${buildApiUrl(api.url, api.token, `/api/v2/comment/${commentId}`)}?format=json`,
    undefined,
    COMMENT_TIMEOUT,
  );
  // 404：该集暂无弹幕，按空结果处理
  if (payload === null) {
    const empty: DanmuCommentResult = { count: 0, comments: [] };
    setCache(commentCache, cacheKey, empty, COMMENT_CACHE_TTL);
    return empty;
  }

  const result = parseCommentResponse(payload);
  setCache(commentCache, cacheKey, result, COMMENT_CACHE_TTL);
  return result;
};

/**
 * 获取番剧的剧集列表（用于把集序号解析为 episodeId）。
 * 上游偶发返回 bangumi: null，此时返回空列表而不抛异常。
 */
export const getAnimeEpisodes = async (
  api: ResolvedDanmuApi,
  animeId: number,
): Promise<DanmuEpisode[]> => {
  if (!api.url || !animeId) return [];

  const cacheKey = `${api.url}|episodes|${animeId}`;
  const cached = getCache(matchCache, cacheKey);
  if (cached) return cached.candidates as unknown as DanmuEpisode[];

  let payload: unknown;
  try {
    payload = await requestJson(
      buildApiUrl(api.url, api.token, `/api/v2/bangumi/${animeId}`),
      undefined,
      MATCH_TIMEOUT,
    );
  } catch {
    return [];
  }

  const root = (payload || {}) as any;
  const bangumi = root.bangumi || root;
  const rawEpisodes: any[] = Array.isArray(bangumi.episodes)
    ? bangumi.episodes
    : [];

  const episodes: DanmuEpisode[] = [];
  rawEpisodes.forEach((item) => {
    const episodeId = Number(item?.episodeId);
    if (!Number.isFinite(episodeId)) return;
    episodes.push({
      episodeId,
      episodeTitle: item?.episodeTitle ? String(item.episodeTitle) : undefined,
    });
  });

  setCache(
    matchCache,
    cacheKey,
    { matched: episodes.length > 0, candidates: episodes as any },
    EPISODES_CACHE_TTL,
  );
  return episodes;
};
