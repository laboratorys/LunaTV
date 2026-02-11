/* eslint-disable no-console,@typescript-eslint/no-non-null-assertion */

import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';

import { validateRequest } from '../common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    const history = await db.getSearchHistory(auth.user.username);
    return NextResponse.json(history);
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

    const { keyword } = await request.json();
    if (!keyword)
      return NextResponse.json(
        { error: 'Missing record key' },
        { status: 400 }
      );
    await db.addSearchHistory(auth.user.username, keyword);
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
    await db.deleteSearchHistory(auth.user.username, key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};
