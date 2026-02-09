/* eslint-disable no-console */

import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function HEAD() {
  return NextResponse.json({ OK: true });
}
