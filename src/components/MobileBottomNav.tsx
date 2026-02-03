/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Cat,
  Clapperboard,
  Clover,
  Film,
  Home,
  MonitorPlay,
  Radio,
  Star,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  const scrollContainerRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const activeElement = container.querySelector(
        '[data-active="true"]'
      ) as HTMLElement;

      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentActive]);
  useEffect(() => {
    setMounted(true);
  }, []);
  const visibleMenuItems = useMemo(() => {
    if (!mounted || typeof window === 'undefined') return [];
    const cfg = (window as any).RUNTIME_CONFIG;
    const items = [
      {
        icon: Home,
        label: '首页',
        href: '/',
        show: true,
      },
      {
        icon: Film,
        label: '电影',
        href: '/douban?type=movie',
        show: cfg?.SHOW_DOUBAN,
      },
      {
        icon: Tv,
        label: '剧集',
        href: '/douban?type=tv',
        show: cfg?.SHOW_DOUBAN,
      },
      {
        icon: Cat,
        label: '动漫',
        href: '/douban?type=anime',
        show: cfg?.SHOW_DOUBAN,
      },
      {
        icon: Clover,
        label: '综艺',
        href: '/douban?type=show',
        show: cfg?.SHOW_DOUBAN,
      },
      {
        icon: Clapperboard,
        label: '短剧',
        href: '/short-drama',
        show: cfg?.SHOW_SHORT_DRAMA,
      },
      {
        icon: MonitorPlay,
        label: '播放源',
        href: '/sources',
        show: cfg?.SHOW_SOURCE,
      },
      {
        icon: Radio,
        label: '直播',
        href: '/live',
        show: cfg?.SHOW_LIVE,
      },
    ];
    const filtered = items.filter((item) => item.show !== false);
    if (cfg?.CUSTOM_CATEGORIES?.length > 0 && cfg?.SHOW_DOUBAN) {
      filtered.push({
        icon: Star,
        label: '自定义',
        href: '/douban?type=custom',
        show: true,
      });
    }
    return filtered;
  }, [mounted]);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <nav
      className='md:hidden fixed left-0 right-0 z-[600] bg-white/90 backdrop-blur-xl border-t border-gray-200/50 overflow-hidden dark:bg-gray-900/80 dark:border-gray-700/50'
      style={{
        /* 紧贴视口底部，同时在内部留出安全区高度 */
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 'calc(3.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <ul
        ref={scrollContainerRef}
        className='flex items-center overflow-x-auto scrollbar-hide'
      >
        {visibleMenuItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li
              key={item.href}
              className='flex-shrink-0'
              style={{ width: '20vw', minWidth: '20vw' }}
              data-active={active}
            >
              <Link
                href={item.href}
                className='flex flex-col items-center justify-center w-full h-14 gap-1 text-xs'
              >
                <item.icon
                  className={`h-6 w-6 ${
                    active
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span
                  className={
                    active
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-300'
                  }
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
