/* eslint-disable no-console,@typescript-eslint/no-non-null-assertion */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites } from '@/lib/config';
import { db } from '@/lib/db';
import { TVBoxRecord } from '@/lib/types';
import { createPlayRecordFromTVBox } from '@/lib/utils';

import { getMatchedVodInfo, validateRequest } from '../common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const cid = searchParams.get('cid');
    const records = await db.getAllPlayRecords(auth.user.username);

    const tvboxRecords = Object.values(records)
      .filter((r) => r.tvbox_record)
      .map((r) => {
        const record = { ...r.tvbox_record! };
        record.cid = Number(cid);
        const [prefix, id] = record.key.split('@@@');
        record.key = `${prefix}@@@${id}@@@${cid}`;
        return record;
      });

    return NextResponse.json(tvboxRecords);
  } catch (err) {
    console.error('GET Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const tvboxRecord: TVBoxRecord = await request.json();
    if (!tvboxRecord?.key)
      return NextResponse.json(
        { error: 'Missing record key' },
        { status: 400 }
      );

    // 存在记录则清理
    await findAndDeleteRecord(auth.user.username, tvboxRecord.key);

    // 解析与匹配
    const [_, id] = tvboxRecord.key.split('@@@');
    const apiSites = await getAvailableApiSites(auth.user.username);
    const apiSite = apiSites.find((site) => site.name === tvboxRecord.vodFlag);

    if (apiSite) {
      const result = await getMatchedVodInfo(id, apiSites, auth.config);
      if (result) {
        await db.savePlayRecord(
          auth.user.username,
          apiSite.key,
          result.vodId,
          createPlayRecordFromTVBox(tvboxRecord)
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

export const DELETE = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { key } = await request.json();
    if (key) {
      await findAndDeleteRecord(auth.user.username, key);
    } else {
      const all = await db.getAllPlayRecords(auth.user.username);
      await Promise.all(
        Object.keys(all).map(async (k) => {
          const [s, i] = k.split('+');
          if (s && i) await db.deletePlayRecord(auth.user.username, s, i);
        })
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

// 统一通过 tvbox_record.key 查找并删除记录
const findAndDeleteRecord = async (username: string, tvboxKey: string) => {
  const records = await db.getAllPlayRecords(username);
  const target = Object.entries(records).find(
    ([_, r]) => r.tvbox_record?.key === tvboxKey
  );
  if (target) {
    const [fullKey] = target;
    const [source, id] = fullKey.split('+');

    await db.deletePlayRecord(username, source, id);
    return true;
  }
  return false;
};
