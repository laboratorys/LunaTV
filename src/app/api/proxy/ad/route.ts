/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { getBaseUrl, resolveUrl } from '@/lib/live';
import { filterAdsFromM3U8Common, getFormattedRuleJson } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  const decodedUrl = decodeURIComponent(url);
  const urlLower = decodedUrl.toLowerCase();

  // --- 🛡️ 解决“连接重置”的关键：对 Key 进行强制伪造 Referer 代理 ---
  if (urlLower.includes('.key')) {
    try {
      const keyRes = await fetch(decodedUrl, {
        headers: {
          Referer: 'https://www.360zy.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
        },
        next: { revalidate: 3600 }, // 缓存 Key，防止频繁请求导致重置
      });

      if (!keyRes.ok) return new Response(null, { status: keyRes.status });

      const keyBody = await keyRes.arrayBuffer(); // 使用 arrayBuffer 处理二进制
      return new Response(keyBody, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (e) {
      return new Response(null, { status: 502 });
    }
  }

  // --- M3U8 处理逻辑 ---
  const source = searchParams.get('source') || '';
  const allowCORS = searchParams.get('allowCORS') === 'true';

  try {
    const response = await fetch(decodedUrl, {
      next: { revalidate: 10 },
      headers: {
        Referer: 'https://www.360zy.com/',
        'User-Agent': 'Mozilla/5.0...',
      },
    });

    if (!response.ok)
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('mpegurl') || urlLower.includes('.m3u8')) {
      const config = await getConfig();
      const m3u8Content = await response.text();
      const modifiedContent = await processM3U8(
        source,
        m3u8Content,
        response.url,
        request,
        allowCORS,
        config.AdRules || ''
      );

      return new Response(modifiedContent, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

async function processM3U8(
  source: string,
  content: string,
  fullUrl: string,
  req: Request,
  allowCORS: boolean,
  adRules: string
) {
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const proxyBase = `${protocol}://${host}/api/proxy/ad`; // 确保指向自己
  const baseUrl = getBaseUrl(fullUrl);

  // 修改 Key 的指向，让它经过我们的代理
  const modifiedContent = content.replace(
    /#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/g,
    (match, p1) => {
      const absoluteKeyUrl = resolveUrl(baseUrl, p1);
      return `#EXT-X-KEY:METHOD=AES-128,URI="${proxyBase}?url=${encodeURIComponent(
        absoluteKeyUrl
      )}&source=${source}"`;
    }
  );

  if (modifiedContent.includes('#EXT-X-STREAM-INF')) {
    return modifiedContent
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          return `${proxyBase}?source=${source}&url=${encodeURIComponent(
            resolveUrl(baseUrl, trimmed)
          )}&allowCORS=${allowCORS}`;
        }
        return line;
      })
      .join('\n');
  }

  const ruleJson = await getFormattedRuleJson(adRules);
  if (!ruleJson || !ruleJson[source]) return modifiedContent;
  const ruleString = (ruleJson && ruleJson[source]) || '';
  const remoteFilterFn = ruleString
    ? (new Function('blocks', 'baseUrl', ruleString) as (
        blocks: string[][],
        baseUrl: string
      ) => any)
    : null;

  const { main, adCount, adDuration } = filterAdsFromM3U8Common(
    modifiedContent,
    fullUrl,
    remoteFilterFn,
    true
  );
  console.log(
    `✅ 广告过滤完成，源: ${source}, 广告数量: ${adCount}, 广告总时长: ${adDuration}秒`
  );
  return main;
}
