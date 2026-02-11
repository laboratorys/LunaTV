'use client';

import { Box } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
}

const MobileHeader = ({ showBackButton = false }: MobileHeaderProps) => {
  const { siteName } = useSite();
  return (
    <header className='md:hidden fixed top-0 left-0 right-0 z-[999] w-full bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/70 dark:border-gray-700/50'>
      <div className='h-12 flex items-center justify-between px-4'>
        {/* 左侧：搜索按钮、返回按钮和设置按钮 */}
        <div className='flex items-center gap-2'>
          <Link
            href='/search'
            className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
          >
            <svg
              className='w-full h-full'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          </Link>
          {showBackButton && <BackButton />}
        </div>

        {/* 右侧：下载按钮 + 用户菜单 */}
        <div className='flex items-center gap-1'>
          <Link
            href='/app'
            className='w-10 h-10 p-2.5 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors'
            title='下载 APP'
          >
            <Box className='w-5 h-5' />
          </Link>

          <UserMenu />
        </div>
      </div>

      {/* 中间：Logo（绝对居中） */}
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2'>
        <Link
          href='/'
          className='flex items-center text-2xl font-bold text-green-600 tracking-tight hover:opacity-80 transition-opacity'
        >
          <Image
            src='/logo.png'
            alt='Logo'
            width={16}
            height={16}
            className='h-[1em] w-[1em] mr-2 align-text-bottom'
          />
          {siteName}
        </Link>
      </div>
    </header>
  );
};

export default MobileHeader;
