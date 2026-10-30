/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import {
  getAnimeEpisodes,
  getDanmuComments,
  matchDanmu,
  resolveDanmuApiConfig,
  searchDanmu,
} from '@/lib/danmu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

const notConfigured = () =>
  NextResponse.json({ error: '未配置弹幕 API' }, { status: 404 });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';

    const config = await getConfig();
    const api = resolveDanmuApiConfig(config);
    if (!api.url) {
      return notConfigured();
    }

    if (action === 'search') {
      const keyword = searchParams.get('keyword')?.trim();
      const episodeRaw = searchParams.get('episode');
      const episodeNum = episodeRaw ? Number(episodeRaw) : undefined;
      const episode = Number.isFinite(episodeNum) ? episodeNum : undefined;

      if (keyword) {
        const candidates = await searchDanmu(api, keyword, episode);
        return NextResponse.json(
          { matched: candidates.length > 0, candidates },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const title = searchParams.get('title')?.trim();
      if (!title) {
        return badRequest('缺少 title 或 keyword 参数');
      }
      const year = searchParams.get('year')?.trim() || undefined;

      const result = await matchDanmu(api, {
        title,
        year,
        episode,
      });
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (action === 'comment') {
      const animeId = Number(searchParams.get('animeId'));
      if (!Number.isFinite(animeId) || animeId <= 0) {
        return badRequest('缺少 animeId 参数');
      }
      const episodeRaw = searchParams.get('episodeId');
      const episodeId = episodeRaw ? Number(episodeRaw) : undefined;
      const episodeNumRaw = searchParams.get('episode');
      const episode = episodeNumRaw ? Number(episodeNumRaw) : undefined;
      const title = searchParams.get('title')?.trim() || undefined;

      const result = await getDanmuComments(api, {
        animeId,
        episodeId: Number.isFinite(episodeId) ? episodeId : undefined,
        episode: Number.isFinite(episode) ? episode : undefined,
        title,
      });
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (action === 'episodes') {
      const animeId = Number(searchParams.get('animeId'));
      if (!Number.isFinite(animeId) || animeId <= 0) {
        return badRequest('缺少 animeId 参数');
      }
      const episodes = await getAnimeEpisodes(api, animeId);
      return NextResponse.json(
        { episodes },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return badRequest('不支持的 action');
  } catch (error) {
    console.error('弹幕接口请求失败:', error);
    const message = (error as Error).message || '未知错误';
    const isTimeout = message.includes('超时');
    return NextResponse.json(
      {
        error: isTimeout ? '弹幕服务响应超时' : '弹幕服务请求失败',
        details: message,
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
