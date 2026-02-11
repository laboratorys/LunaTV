'use client';

import { useEffect, useState } from 'react';

interface Props {
  active: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

export function IncognitoToggle({ active, onToggle }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className='w-8 h-[18px]' />;

  return (
    <div
      onClick={(e) => onToggle(e)} // 处理点击并透传事件对象 e 以便阻止冒泡
      className={`
        relative inline-flex h-[18px] w-8 flex-shrink-0 cursor-pointer items-center rounded-full 
        transition-colors duration-200 ease-in-out
        ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-3 w-3 transform rounded-full 
          bg-white shadow ring-0 transition-transform duration-200 ease-in-out
          ${active ? 'translate-x-[16px]' : 'translate-x-[4px]'}
        `}
      />
    </div>
  );
}
