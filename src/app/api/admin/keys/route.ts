/* eslint-disable no-console,@typescript-eslint/no-explicit-any,@typescript-eslint/no-non-null-assertion*/
import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { usernames } = await req.json();
    try {
      usernames.forEach(async (username: any) => {
        console.log(username);
        await db.generateNewKey(username);
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('数据库验证失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('生成Key接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
