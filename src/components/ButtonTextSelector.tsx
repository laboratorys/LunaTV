'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface SelectorOption<T> {
  value: T;
  label: string;
  shortLabel?: string;
  children?: SelectorOption<T>[];
}

interface ButtonTextSelectorProps<T> {
  label?: string;
  options: SelectorOption<T>[];
  selectedValue?: T;
  selectedSubValue?: T;
  autoSelectFirstChild?: boolean;
  onChange: (value: T, isChild?: boolean) => void;
  className?: string;
}

const ButtonTextSelector = <T extends string | number>({
  label,
  options,
  selectedValue,
  selectedSubValue,
  autoSelectFirstChild = false,
  onChange,
  className = '',
}: ButtonTextSelectorProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [arrowX, setArrowX] = useState(0);
  const [showSub, setShowSub] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [labelWidth, setLabelWidth] = useState(0);

  const activeParent = useMemo(
    () => options.find((opt) => opt.value === selectedValue),
    [options, selectedValue]
  );

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      setShowLeftArrow(el.scrollLeft > 5);
      setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  }, []);

  const updatePointerPosition = useCallback(() => {
    if (containerRef.current && selectedValue !== undefined) {
      const activeBtn = containerRef.current.querySelector(
        `[data-active="true"]`
      ) as HTMLElement;

      if (labelRef.current) {
        setLabelWidth(labelRef.current.offsetWidth);
      }

      if (activeBtn) {
        const parentRect = containerRef.current.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const centerX = btnRect.left - parentRect.left + btnRect.width / 2;
        setArrowX(centerX);
      }
    }
    checkScroll();
  }, [selectedValue, checkScroll]);

  useEffect(() => {
    updatePointerPosition();
    const scrollArea = scrollRef.current;

    const handleResize = () => {
      checkScroll();
      updatePointerPosition();
    };

    if (scrollArea) {
      scrollArea.addEventListener('scroll', updatePointerPosition);
      window.addEventListener('resize', handleResize);

      const timer = setTimeout(updatePointerPosition, 100);

      return () => {
        scrollArea.removeEventListener('scroll', updatePointerPosition);
        window.removeEventListener('resize', handleResize);
        clearTimeout(timer);
      };
    }
  }, [updatePointerPosition, checkScroll, options, showSub]);

  const handleArrowScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const distance = scrollRef.current.clientWidth * 0.7;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -distance : distance,
        behavior: 'smooth',
      });
    }
  };

  const handleParentClick = (option: SelectorOption<T>) => {
    const isSameParent = selectedValue === option.value;
    const hasChildren = option.children && option.children.length > 0;

    if (!isSameParent) {
      onChange(option.value, false);
      if (hasChildren) {
        setShowSub(true);
        if (autoSelectFirstChild && option.children) {
          onChange(option.children[0].value, true);
        } else {
          onChange('' as T, true);
        }
      } else {
        setShowSub(false);
      }
    } else {
      if (hasChildren) setShowSub(!showSub);
    }
  };

  return (
    <div className={`flex flex-col ${className}`} ref={containerRef}>
      <div className='flex items-center gap-1 sm:gap-2 relative z-[60]'>
        {label && (
          <span
            ref={labelRef}
            className='text-xs sm:text-sm font-semibold text-gray-500 shrink-0 min-w-fit pr-1 sm:pr-0 sm:min-w-[48px]'
          >
            {label}
          </span>
        )}

        <div className='relative flex-1 group overflow-hidden h-10 flex items-center'>
          {showLeftArrow && (
            <div className='absolute left-0 top-0 bottom-0 z-20 hidden sm:flex items-center pointer-events-none'>
              <div className='w-10 h-full bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80' />
              <button
                onClick={() => handleArrowScroll('left')}
                className='absolute left-0 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 text-gray-600 hover:text-green-600 pointer-events-auto transition-transform active:scale-90'
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}

          <div
            ref={scrollRef}
            className='overflow-x-auto scrollbar-hide flex-1 py-1 px-0.5 sm:px-1 scroll-smooth'
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className='inline-flex p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl border border-gray-200/50 dark:border-gray-700/50'>
              {options.map((option) => (
                <button
                  key={option.value}
                  data-active={selectedValue === option.value}
                  onClick={() => handleParentClick(option)}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap relative z-10 ${
                    selectedValue === option.value
                      ? 'bg-white dark:bg-gray-700 text-green-600 shadow-sm ring-1 ring-black/5'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                  }`}
                >
                  {option.shortLabel || option.label}
                </button>
              ))}
            </div>
          </div>

          {showRightArrow && (
            <div className='absolute right-0 top-0 bottom-0 z-20 hidden sm:flex items-center pointer-events-none'>
              <div className='w-10 h-full bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80' />
              <button
                onClick={() => handleArrowScroll('right')}
                className='absolute right-0 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 text-gray-600 hover:text-green-600 pointer-events-auto transition-transform active:scale-90'
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className='relative h-0 z-[100]'>
        {showSub &&
          activeParent?.children &&
          activeParent.children.length > 0 && (
            <div
              className='absolute -top-1 min-w-[180px] animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-200'
              style={{
                left: label
                  ? `${
                      labelWidth +
                      (typeof window !== 'undefined' && window.innerWidth < 640
                        ? 4
                        : 8)
                    }px`
                  : 0,
              }}
            >
              <div
                className='absolute -top-1 h-2.5 w-2.5 rotate-45 border-l border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-[80]'
                style={{
                  left: `${
                    arrowX -
                    (label
                      ? labelWidth +
                        (typeof window !== 'undefined' &&
                        window.innerWidth < 640
                          ? 4
                          : 8)
                      : 0)
                  }px`,
                  transition: 'left 0.3s ease-out',
                }}
              />
              <div className='relative flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl'>
                {activeParent.children.map((child) => (
                  <button
                    key={child.value}
                    onClick={() => onChange(child.value, true)}
                    className={`px-2.5 py-1 text-[11px] sm:text-xs rounded-lg border transition-colors ${
                      selectedSubValue === child.value
                        ? 'bg-green-500 text-white border-green-500 shadow-sm'
                        : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default ButtonTextSelector;
