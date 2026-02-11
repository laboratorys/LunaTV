/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function HEAD() {
  return check();
}

export async function GET() {
  return check();
}

const check = async () => {
  const config = await getConfig();
  return NextResponse.json({ OK: config?.TvBoxConfig?.sync ?? false });
};
