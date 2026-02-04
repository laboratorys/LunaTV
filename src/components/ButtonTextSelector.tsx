'use client';

import { ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const [mounted, setMounted] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [arrowX, setArrowX] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeParent = useMemo(
    () => options.find((opt) => opt.value === selectedValue),
    [options, selectedValue]
  );

  const centerActiveItem = useCallback(() => {
    const activeBtn = scrollRef.current?.querySelector(
      `[data-active="true"]`
    ) as HTMLElement;
    if (activeBtn && scrollRef.current) {
      const container = scrollRef.current;
      const scrollLeft =
        activeBtn.offsetLeft -
        container.offsetWidth / 2 +
        activeBtn.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, []);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      setShowLeftArrow(el.scrollLeft > 5);
      setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  }, []);

  const updateUI = useCallback(() => {
    checkScroll();
    if (containerRef.current && selectedValue !== undefined) {
      const activeBtn = containerRef.current.querySelector(
        `[data-active="true"]`
      ) as HTMLElement;
      if (activeBtn) {
        const parentRect = containerRef.current.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        setArrowX(btnRect.left - parentRect.left + btnRect.width / 2);
      }
    }
  }, [selectedValue, checkScroll]);

  useEffect(() => {
    updateUI();
    const timer = setTimeout(centerActiveItem, 150);
    return () => clearTimeout(timer);
  }, [selectedValue, centerActiveItem, updateUI]);

  const handleParentClick = (option: SelectorOption<T>) => {
    const isSameParent = selectedValue === option.value;
    if (!isSameParent) {
      onChange(option.value, false);
      if (option.children?.length) {
        setShowSub(true);
        if (autoSelectFirstChild) onChange(option.children[0].value, true);
      } else {
        setShowSub(false);
      }
    } else if (option.children?.length) {
      setShowSub(!showSub);
    }
    setShowAllOptions(false);
  };

  const renderOverlay = () => {
    if (!showAllOptions || !mounted) return null;

    return createPortal(
      <div className='fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4'>
        <div
          className='absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200'
          onClick={() => setShowAllOptions(false)}
        />

        <div className='relative w-full sm:max-w-2xl bg-white dark:bg-gray-900 shadow-xl rounded-t-2xl sm:rounded-xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200'>
          <div className='w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto my-2 sm:hidden' />

          <div className='flex justify-between items-center px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-gray-800'>
            <span className='text-sm sm:text-base font-bold text-gray-700 dark:text-gray-200'>
              {label || '分类'}
            </span>
            <button
              onClick={() => setShowAllOptions(false)}
              className='p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
            >
              <X size={20} className='text-gray-400' />
            </button>
          </div>

          <div className='p-4 sm:p-6 overflow-y-auto'>
            {/* 网格布局：按钮大小与一级菜单完全一致 */}
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3'>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleParentClick(opt)}
                  className={`
                    px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-sm font-medium rounded-lg border transition-all whitespace-nowrap overflow-hidden text-ellipsis
                    active:scale-95
                    ${
                      selectedValue === opt.value
                        ? 'bg-green-500 border-green-500 text-white font-semibold shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-500 hover:border-gray-200 dark:hover:border-gray-700'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className={`flex flex-col ${className} relative`} ref={containerRef}>
      <div className='flex items-center gap-1.5 sm:gap-2 relative z-[60]'>
        {label && (
          <button
            onClick={() => setShowAllOptions(true)}
            className='flex items-center gap-1 px-1 py-1 text-[12px] sm:text-sm font-bold text-gray-400 hover:text-green-600 transition-colors shrink-0'
          >
            {label}
            <LayoutGrid size={14} className='sm:size-4' />
          </button>
        )}

        <div className='relative flex-1 group overflow-hidden h-9 sm:h-10 flex items-center'>
          {showLeftArrow && (
            <div className='absolute left-0 z-20 hidden sm:flex items-center h-full pointer-events-none'>
              <div className='w-10 h-full bg-gradient-to-r from-white dark:from-gray-900 to-transparent' />
              <button
                onClick={() =>
                  scrollRef.current?.scrollBy({
                    left: -200,
                    behavior: 'smooth',
                  })
                }
                className='absolute left-0 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 pointer-events-auto active:scale-90 transition-transform'
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}

          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className='overflow-x-auto scrollbar-hide flex-1 snap-x scroll-smooth'
          >
            <div className='inline-flex p-0.5 sm:p-1 bg-gray-100/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50'>
              {options.map((option) => (
                <button
                  key={option.value}
                  data-active={selectedValue === option.value}
                  onClick={() => handleParentClick(option)}
                  className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap snap-center ${
                    selectedValue === option.value
                      ? 'bg-white dark:bg-gray-700 text-green-600 shadow-sm ring-1 ring-black/5'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {option.shortLabel || option.label}
                </button>
              ))}
            </div>
          </div>

          {showRightArrow && (
            <div className='absolute right-0 z-20 hidden sm:flex items-center h-full pointer-events-none'>
              <div className='w-10 h-full bg-gradient-to-l from-white dark:from-gray-900 to-transparent' />
              <button
                onClick={() =>
                  scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
                }
                className='absolute right-0 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 pointer-events-auto active:scale-90 transition-transform'
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className='relative'>
        {showSub && activeParent?.children?.length && (
          <div className='absolute top-1 left-0 w-full sm:w-auto min-w-[200px] animate-in fade-in slide-in-from-top-1 z-[100]'>
            <div
              className='absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 hidden sm:block'
              style={{
                left: `${arrowX}px`,
                transform: 'translateX(-50%) rotate(45deg)',
              }}
            />
            <div className='flex flex-wrap gap-1.5 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-lg mx-2 sm:mx-0'>
              {activeParent.children.map((child) => (
                <button
                  key={child.value}
                  onClick={() => {
                    onChange(child.value, true);
                    setShowSub(false);
                  }}
                  className={`px-2.5 py-1 text-[10px] sm:text-xs rounded-md border transition-colors ${
                    selectedSubValue === child.value
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {child.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {renderOverlay()}
    </div>
  );
};

export default ButtonTextSelector;
