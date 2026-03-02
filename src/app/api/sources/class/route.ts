import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { getClassWithNoCache } from '@/lib/downstream';
import { CategoryNode } from '@/lib/types';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const sourceCode = searchParams.get('source');
  try {
    const apiSites = await getAvailableApiSites(authInfo.username);
    const apiSite = apiSites.find((site) => site.key === sourceCode);

    if (!apiSite) {
      return NextResponse.json({ error: '无效的API来源' }, { status: 400 });
    }
    let classTree = await getClassWithNoCache(apiSite);
    const config = await getConfig();
    const cacheTime = await getCacheTime();
    if (!config.SiteConfig.DisableYellowFilter) {
      classTree = filterTree(classTree);
    }
    return NextResponse.json(classTree, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Netlify-Vary': 'query',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

const filterTree = (nodes: CategoryNode[]): CategoryNode[] => {
  return nodes
    .filter((node) => {
      // 检查当前节点名称是否包含敏感词
      const typeName = node.name || '';
      return !yellowWords.some((word: string) => typeName.includes(word));
    })
    .map((node) => {
      // 如果当前节点有子节点，递归过滤子节点
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: filterTree(node.children),
        };
      }
      return node;
    });
};
