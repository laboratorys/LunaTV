/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { motion } from 'framer-motion';
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
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const currentActive = activePath ?? pathname;
  const scrollContainerRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. 消除滚动感：只有快超出边界时才滚动
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const activeElement = container.querySelector(
        '[data-active="true"]'
      ) as HTMLElement;

      if (activeElement) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = activeElement.getBoundingClientRect();

        // 增加缓冲区，确保点击中间项时容器绝对不滚动
        const buffer = 80;
        const isSafe =
          elementRect.left >= containerRect.left + buffer &&
          elementRect.right <= containerRect.right - buffer;

        if (!isSafe) {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
          });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentActive, mounted]);

  const visibleMenuItems = useMemo(() => {
    if (!mounted) return [];
    const cfg = (window as any).RUNTIME_CONFIG;
    const items = [
      { icon: Home, label: '首页', href: '/', show: true },
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
      { icon: Radio, label: '直播', href: '/live', show: cfg?.SHOW_LIVE },
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
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);
    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  if (!mounted) return null;

  return (
    <nav
      className='md:hidden fixed left-0 right-0 z-[600] bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800'
      style={{
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 'calc(4rem + env(safe-area-inset-bottom))',
      }}
    >
      <ul
        ref={scrollContainerRef}
        className='flex items-center h-16 overflow-x-auto no-scrollbar px-2'
      >
        {visibleMenuItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li
              key={item.href}
              className='flex-shrink-0'
              style={{ width: '22vw', minWidth: '80px' }}
              data-active={active}
            >
              <Link
                href={item.href}
                scroll={false}
                className='flex flex-col items-center justify-center w-full h-full gap-1'
              >
                {/* 2. 优化：不再使用透明度，而是利用 Tailwind 的过渡让颜色变化更丝滑 */}
                <motion.div
                  initial={false}
                  whileTap={{ scale: 0.9 }}
                  className='flex flex-col items-center gap-1'
                >
                  <item.icon
                    className={`h-6 w-6 transition-all duration-300 ease-in-out ${
                      active
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                    strokeWidth={active ? 2.5 : 2}
                  />

                  <span
                    className={`text-xs transition-all duration-300 ease-in-out ${
                      active
                        ? 'text-green-600 dark:text-green-400 font-bold'
                        : 'text-gray-500 dark:text-gray-400 font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
