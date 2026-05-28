import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
  onOpenChange?: (isOpen: boolean) => void;
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
  // 新增：用于存储菜单的位置坐标
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label || '请选择';

  // 计算坐标逻辑
  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4, // 按钮下方 4px
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  // 监听打开状态并计算位置
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

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
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onOpenChange]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type='button'
        onClick={() => {
          if (!disabled) {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            onOpenChange?.(nextOpen);
          }
        }}
        disabled={disabled}
        className={`w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-left transition-all text-gray-900 dark:text-gray-100 ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        {selectedLabel}
      </button>

      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen &&
        createPortal(
          <div
            className='fixed z-9999 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl overflow-auto '
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: maxHeight ? maxHeight : '300px',
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type='button'
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setIsOpen(false);
                  onOpenChange?.(false);
                }}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between text-gray-900 dark:text-gray-100 ${
                  option.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${value === option.value ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : ''}`}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className='w-4 h-4 text-green-600' />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default CustomDropdown;
