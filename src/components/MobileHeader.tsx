'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
  title?: string;
}

const MobileHeader = ({ showBackButton = false, title }: MobileHeaderProps) => {
  const { siteName } = useSite();
  const displayTitle = title || siteName;
  const titleColorClass = title
    ? 'text-gray-900 dark:text-white'
    : 'text-green-600';

  return (
    <header className='md:hidden fixed top-0 left-0 right-0 z-[999] w-full bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/80 dark:border-gray-800/50 transition-colors duration-300'>
      <div className='h-14 flex items-center justify-between px-3'>
        {/* 左侧：返回按钮 或 站点标识 (导航区) */}
        <div className='flex items-center min-w-0'>
          {showBackButton ? (
            <div className='flex items-center gap-1'>
              <BackButton />
              <span
                className={`text-lg font-bold truncate max-w-[180px] ${titleColorClass}`}
              >
                {displayTitle}
              </span>
            </div>
          ) : (
            <Link
              href='/'
              className='flex items-center ml-1 transition-all duration-200 active:opacity-70'
            >
              <div className='relative w-7 h-7 flex-shrink-0'>
                <Image
                  src='/logo.png'
                  alt='Logo'
                  fill
                  className='object-contain'
                />
              </div>
              <span className='ml-2 text-xl font-bold text-green-600 tracking-tight truncate'>
                {siteName}
              </span>
            </Link>
          )}
        </div>

        {/* 右侧：搜索 + 用户菜单 (操作区) */}
        <div className='flex items-center gap-1'>
          <Link
            href='/search'
            className='w-10 h-10 flex items-center justify-center rounded-full text-gray-600 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800 transition-colors'
            aria-label='Search'
          >
            <Search size={22} strokeWidth={2.5} />
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
