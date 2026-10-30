/* eslint-disable no-console */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DanmuItem {
  time: number;
  text: string;
  color: string;
  mode: number;
}

export interface DanmuCandidate {
  animeId: number;
  animeTitle: string;
  episodeId?: number;
  episodeTitle?: string;
  source?: string;
}

interface UseDanmuOptions {
  enabled: boolean;
  title: string;
  year?: string;
  episode?: number;
  videoKey: string;
}

const MEMORY_PREFIX = 'luna_danmu_match_';
const NO_MATCH_PREFIX = 'luna_danmu_nomatch_';

/**
 * 从失败响应中提取后端返回的可读错误信息。
 */
const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (data?.error) {
      return data.details ? `${data.error}：${data.details}` : data.error;
    }
  } catch {
    // 响应体非 JSON 时回退到状态码
  }
  return `请求失败 (HTTP ${response.status})`;
};

/**
 * 标记该资源自动匹配无结果，避免重复发起慢请求。
 */
const writeNoMatch = (videoKey: string): void => {
  if (!videoKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NO_MATCH_PREFIX + videoKey, '1');
  } catch {
    // 忽略存储失败
  }
};

const readNoMatch = (videoKey: string): boolean => {
  if (!videoKey || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(NO_MATCH_PREFIX + videoKey) === '1';
  } catch {
    return false;
  }
};

const clearNoMatch = (videoKey: string): void => {
  if (!videoKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(NO_MATCH_PREFIX + videoKey);
  } catch {
    // 忽略存储失败
  }
};

const readMemory = (videoKey: string): DanmuCandidate | null => {
  if (!videoKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MEMORY_PREFIX + videoKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DanmuCandidate;
    if (!parsed?.animeId) return null;
    // 只保留作品级信息，episodeId 每集不同，需按当前集重新解析
    return {
      animeId: parsed.animeId,
      animeTitle: parsed.animeTitle,
      source: parsed.source,
    };
  } catch {
    return null;
  }
};

const writeMemory = (videoKey: string, candidate: DanmuCandidate): void => {
  if (!videoKey || typeof window === 'undefined') return;
  try {
    // 只记忆作品级信息，episodeId 随集变化不记忆
    window.localStorage.setItem(
      MEMORY_PREFIX + videoKey,
      JSON.stringify({
        animeId: candidate.animeId,
        animeTitle: candidate.animeTitle,
        source: candidate.source,
      }),
    );
  } catch {
    // 忽略存储失败
  }
};

const clearMemory = (videoKey: string): void => {
  if (!videoKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MEMORY_PREFIX + videoKey);
  } catch {
    // 忽略存储失败
  }
};

/**
 * 弹幕数据加载与管理。
 */
export const useDanmu = ({
  enabled,
  title,
  year,
  episode,
  videoKey,
}: UseDanmuOptions) => {
  const [danmuList, setDanmuList] = useState<DanmuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DanmuCandidate[]>([]);
  const [selected, setSelected] = useState<DanmuCandidate | null>(null);
  const [matchedInfo, setMatchedInfo] = useState<{
    animeTitle: string;
    episodeTitle?: string;
    source?: string;
  } | null>(null);

  const requestIdRef = useRef(0);
  const scopeKeyRef = useRef('');

  const fetchComments = useCallback(
    async (
      candidate: DanmuCandidate,
      preferEpisode: boolean,
    ): Promise<DanmuItem[]> => {
      const params = new URLSearchParams({
        action: 'comment',
        animeId: String(candidate.animeId),
      });
      if (candidate.episodeId) {
        params.set('episodeId', String(candidate.episodeId));
      }
      if (preferEpisode && episode && !candidate.episodeId) {
        // 无 episodeId 时按集序号由服务端定位
        params.set('episode', String(episode));
        if (title) params.set('title', title);
      }

      const response = await fetch(`/api/danmu-external?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = await response.json();
      const comments: DanmuItem[] = Array.isArray(data?.comments)
        ? data.comments
        : [];
      return comments;
    },
    [episode, title],
  );

  const loadByCandidate = useCallback(
    async (
      candidate: DanmuCandidate,
      scopeKey: string,
      remember: boolean,
      preferEpisode = false,
    ): Promise<boolean> => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const comments = await fetchComments(candidate, preferEpisode);
        if (requestId !== requestIdRef.current) return false;
        setDanmuList(comments);
        setSelected(candidate);
        setMatchedInfo({
          animeTitle: candidate.animeTitle,
          episodeTitle: candidate.episodeTitle,
          source: candidate.source,
        });
        if (remember) {
          writeMemory(scopeKey, candidate);
        }
        return true;
      } catch (err) {
        if (requestId !== requestIdRef.current) return false;
        console.error('[Danmu] 加载失败:', err);
        setDanmuList([]);
        setError((err as Error).message || '弹幕加载失败');
        return false;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [fetchComments],
  );

  // 自动匹配并加载
  const runAutoMatch = useCallback(
    async (scopeKey: string): Promise<void> => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        if (!title.trim()) {
          setDanmuList([]);
          setError('缺少视频标题，无法匹配弹幕');
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({ action: 'search', title });
        if (year) params.set('year', year);
        if (episode) params.set('episode', String(episode));

        const response = await fetch(
          `/api/danmu-external?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }
        const data = await response.json();
        if (requestId !== requestIdRef.current) return;

        const list: DanmuCandidate[] = Array.isArray(data?.candidates)
          ? data.candidates
          : [];
        setCandidates(list);

        if (list.length === 0) {
          setDanmuList([]);
          setError('未匹配到弹幕');
          writeNoMatch(scopeKey);
          setLoading(false);
          return;
        }

        await loadByCandidate(list[0], scopeKey, false, true);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('[Danmu] 自动匹配失败:', err);
        setDanmuList([]);
        setError((err as Error).message || '弹幕匹配失败');
        setLoading(false);
      }
    },
    [title, year, episode, loadByCandidate],
  );

  // 手动搜索（求索切换）
  const manualSearch = useCallback(
    async (keyword: string): Promise<DanmuCandidate[]> => {
      if (!keyword.trim()) return [];
      try {
        const params = new URLSearchParams({
          action: 'search',
          keyword: keyword.trim(),
        });
        if (episode) params.set('episode', String(episode));
        const response = await fetch(
          `/api/danmu-external?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }
        const data = await response.json();
        const list: DanmuCandidate[] = Array.isArray(data?.candidates)
          ? data.candidates
          : [];
        setCandidates(list);
        return list;
      } catch (err) {
        console.error('[Danmu] 手动搜索失败:', err);
        setError((err as Error).message || '搜索失败');
        return [];
      }
    },
    [episode],
  );

  // 应用用户选定的匹配项
  const applyMatch = useCallback(
    async (candidate: DanmuCandidate): Promise<void> => {
      clearNoMatch(scopeKeyRef.current);
      await loadByCandidate(candidate, scopeKeyRef.current, true);
    },
    [loadByCandidate],
  );

  // 重新加载当前弹幕
  const reload = useCallback(async (): Promise<void> => {
    if (!scopeKeyRef.current) return;
    const candidate =
      selected ?? readMemory(scopeKeyRef.current) ?? candidates[0];
    if (candidate) {
      await loadByCandidate(candidate, scopeKeyRef.current, true);
    } else {
      await runAutoMatch(scopeKeyRef.current);
    }
  }, [selected, candidates, loadByCandidate, runAutoMatch]);

  // 清除记忆，恢复自动匹配
  const resetToAuto = useCallback(async (): Promise<void> => {
    clearMemory(scopeKeyRef.current);
    clearNoMatch(scopeKeyRef.current);
    setSelected(null);
    await runAutoMatch(scopeKeyRef.current);
  }, [runAutoMatch]);

  // 视频变化时重新加载
  useEffect(() => {
    // 记忆键按集区分，保证读取与写入使用同一个 key
    const scopeKey = `${videoKey}|${episode ?? 1}`;
    scopeKeyRef.current = scopeKey;

    if (!enabled) {
      setDanmuList([]);
      setCandidates([]);
      setSelected(null);
      setMatchedInfo(null);
      setError(null);
      setLoading(false);
      return;
    }

    const memorized = readMemory(scopeKey);
    if (memorized) {
      // 记忆不含 episodeId，按当前集重新解析
      void loadByCandidate(memorized, scopeKey, false, true);
    } else if (readNoMatch(scopeKey)) {
      // 已确认该资源无弹幕，避免重复发起慢请求
      setDanmuList([]);
      setCandidates([]);
      setError('未匹配到弹幕');
    } else {
      void runAutoMatch(scopeKey);
    }
  }, [enabled, videoKey, episode, loadByCandidate, runAutoMatch]);

  return {
    danmuList,
    loading,
    error,
    candidates,
    selected,
    matchedInfo,
    manualSearch,
    applyMatch,
    reload,
    resetToAuto,
  };
};
