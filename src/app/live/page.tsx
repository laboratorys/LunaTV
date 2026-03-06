'use client';

import dynamic from 'next/dynamic';
import { ComponentType, Suspense } from 'react';

const LivePageClient = dynamic(
  async () => {
    const path: any = './LivePageClient';
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
      <LivePageClient />
    </Suspense>
  );
}
