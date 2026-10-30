/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db, parseStorageKey } from '@/lib/db';
import { pickDuplicatePlayRecordKeys } from '@/lib/playRecordUtils';

export const runtime = 'nodejs';

/**
 * 合并同一影片不同源产生的重复播放记录，只保留 save_time 最新的一条。
 * 供记录页打开时调用，用于清理历史遗留的重复数据。
 */
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const username = authInfo.username;
    const allRecords = await db.getAllPlayRecords(username);
    const removedKeys = pickDuplicatePlayRecordKeys(allRecords);

    if (removedKeys.length > 0) {
      await Promise.all(
        removedKeys.map((recordKey) => {
          const parsed = parseStorageKey(recordKey);
          return db.deletePlayRecord(username, parsed.source, parsed.id);
        }),
      );
    }

    return NextResponse.json({ success: true, removedKeys }, { status: 200 });
  } catch (err) {
    console.error('合并播放记录失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
