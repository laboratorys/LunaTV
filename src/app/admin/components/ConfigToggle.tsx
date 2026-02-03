/* eslint-disable no-console */
'use client';

import React from 'react';

// 定义 Props 的接口
interface ConfigToggleProps {
  label: string;
  description?: string; // 问号表示可选
  enabled: boolean;
  onChange: () => void; // 这是一个不带参数且无返回值的函数
}

const ConfigToggle: React.FC<ConfigToggleProps> = ({
  label,
  description,
  enabled,
  onChange,
}) => {
  return (
    <div
      className='flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-white/5 rounded-2xl transition-all hover:border-green-500/30 group cursor-pointer'
      onClick={onChange}
    >
      <div className='flex flex-col gap-0.5 pr-4'>
        <div className='text-sm font-semibold dark:text-white text-gray-800 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors'>
          {label}
        </div>
        {description && (
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            {description}
          </div>
        )}
      </div>

      <button
        type='button'
        className={`flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 relative ${
          enabled
            ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
            : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${
            enabled ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default ConfigToggle;
