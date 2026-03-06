'use client';

import dynamic from 'next/dynamic';
import { ComponentType, Suspense } from 'react';

const PlayPageClient = dynamic(
  async () => {
    const path: any = './PlayPageClient';
    const mod = await import(`${path}`);
    return mod.default as unknown as ComponentType<any>;
  },
  {
    ssr: false,
  }
);

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center h-screen'>
          加载中...
        </div>
      }
    >
      <PlayPageClient />
    </Suspense>
  );
}
