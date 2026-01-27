/* eslint-disable no-console */
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
  onOpenChange?: (isOpen: boolean) => void; // 新增：通知父组件下拉打开/关闭
}

const CustomDropdown = ({
  options,
  value,
  onChange,
  className = '',
  disabled = false,
  maxHeight,
  onOpenChange,
}: CustomDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedLabel =
    options.find((option) => option.value === value)?.label || '请选择';
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    // 监听 click 和 touchstart 事件（兼容移动端）
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    // 清理事件监听器
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);
  // 动态计算下拉列表高度（每个选项约 2.5rem + 边距）
  const calculatedHeight = options.length * 2.75; // 每个选项约 2.5rem + 0.25rem 边距
  const heightClass = maxHeight
    ? `max-h-${maxHeight}`
    : `h-[${calculatedHeight}rem]`;
  return (
    <div className={`relative z-50 ${className}`} data-dropdown>
      {' '}
      {/* z-50 确保在最上层 */}
      <button
        type='button'
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        {selectedLabel}
      </button>
      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-auto ${
            maxHeight ? heightClass : 'h-auto'
          } transition-all duration-200`} // 动态高度或 h-auto
        >
          {options.map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                value === option.value
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              <span className='truncate'>{option.label}</span>
              {value === option.value && (
                <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
