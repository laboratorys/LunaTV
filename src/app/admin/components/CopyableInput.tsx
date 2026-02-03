/* eslint-disable no-console */
'use client';
import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';

import { styles } from '@/app/admin/components/UIComponents';

interface CopyableInputProps {
  label?: string;
  value: string;
  onChange?: (val: string) => void;
  description?: string;
  readOnly?: boolean;
  placeholder?: string;
}

export default function CopyableInput({
  label,
  value,
  onChange,
  description,
  readOnly = true,
  placeholder = '',
}: CopyableInputProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = async () => {
    if (!inputRef.current) return;

    const textToCopy = value;

    try {
      // 1. 优先尝试现代 API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      // 2. 备选方案：兼容移动端和非 HTTPS 环境
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('复制失败:', err);
      inputRef.current.select(); // 失败时选中文字让用户手动复制
    }
  };

  return (
    <div className='space-y-2'>
      {label && (
        <label className='block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1'>
          {label}
        </label>
      )}
      <div className='relative group'>
        <input
          ref={inputRef}
          type='text'
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onClick={() => readOnly && inputRef.current?.select()}
          className={`pr-12 ${styles.input} ${
            readOnly
              ? 'bg-gray-50/50 dark:bg-gray-800/50 cursor-default'
              : 'bg-white dark:bg-gray-800'
          }`}
        />
        <button
          type='button'
          onClick={copyToClipboard}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
            copied
              ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={copied ? '已复制' : '复制到剪贴板'}
        >
          {copied ? (
            <Check className='w-4.5 h-4.5 animate-in zoom-in duration-300' />
          ) : (
            <Copy className='w-4.5 h-4.5' />
          )}
        </button>
      </div>
      {description && (
        <p className='text-[11px] text-gray-400 dark:text-gray-500 italic px-1'>
          {description}
        </p>
      )}
    </div>
  );
}
