import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';

export type M3SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type M3SelectProps = {
  disabled?: boolean;
  icon?: LucideIcon;
  onChange: (value: string) => void;
  options: M3SelectOption[];
  value: string;
};

type MenuPosition = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

const selectMenuExitDurationMs = 180;

function getSelectedLabel(options: M3SelectOption[], value: string): ReactNode {
  return options.find((option) => option.value === value)?.label ?? '未选择';
}

export default function M3Select({ disabled = false, icon: Icon, onChange, options, value }: M3SelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const rootElement = rootRef.current;

    if (!rootElement) {
      return;
    }

    const rect = rootElement.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredMaxHeight = 288;
    const minimumMaxHeight = 144;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const shouldOpenBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
    const availableHeight = shouldOpenBelow ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(minimumMaxHeight, Math.min(preferredMaxHeight, availableHeight));
    const width = Math.max(160, Math.min(rect.width, window.innerWidth - viewportPadding * 2));
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    const top = shouldOpenBelow
      ? rect.bottom + 8
      : Math.max(viewportPadding, rect.top - maxHeight - 8);

    setMenuPosition({
      left,
      maxHeight,
      top,
      width,
    });
  }, []);

  useEffect(() => {
    if (!mounted) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [mounted]);

  useEffect(() => {
    if (!disabled) {
      return;
    }

    setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }

    const closeTimer = window.setTimeout(() => {
      setMounted(false);
      setMenuPosition(null);
    }, selectMenuExitDurationMs);

    return () => window.clearTimeout(closeTimer);
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return undefined;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [mounted, updateMenuPosition]);

  const commitValue = (nextValue: string) => {
    if (nextValue !== value) {
      onChange(nextValue);
    }

    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const availableOptions = options.filter((option) => !option.disabled);
    const currentAvailableIndex = availableOptions.findIndex((option) => option.value === value);
    const nextIndex =
      currentAvailableIndex < 0
        ? 0
        : Math.min(Math.max(currentAvailableIndex + direction, 0), availableOptions.length - 1);
    const nextOption = availableOptions[nextIndex];

    if (nextOption) {
      onChange(nextOption.value);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        className="flex h-12 w-full items-center rounded-[16px] border border-neutral-400/70 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/50 px-4 text-left text-sm text-neutral-900 dark:text-neutral-100 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        {Icon && (
          <Icon
            aria-hidden="true"
            className="mr-3 size-4 shrink-0 text-primary"
            strokeWidth={2}
          />
        )}
        <span className="min-w-0 flex-1 truncate">{getSelectedLabel(options, value)}</span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-3 size-4 shrink-0 text-neutral-500 dark:text-neutral-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>

      {mounted && menuPosition && createPortal(
        <div
          className="m3-select-menu fixed z-[10000] overflow-y-auto rounded-2xl border border-neutral-200/40 p-2 text-neutral-900 shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:text-neutral-100"
          data-state={open ? 'open' : 'closed'}
          ref={menuRef}
          style={{
            backgroundColor: 'rgb(var(--m3-surface) / 0.94)',
            left: menuPosition.left,
            maxHeight: menuPosition.maxHeight,
            top: menuPosition.top,
            width: menuPosition.width,
          }}
        >
          {options.map((option, index) => {
            const selected = option.value === value;

            return (
              <button
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-900 dark:text-neutral-100 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/70 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={option.disabled}
                key={`${option.value}-${index}`}
                onClick={() => commitValue(option.value)}
                style={
                  selected
                    ? {
                        backgroundColor: 'rgb(var(--m3-primary-container))',
                        color: 'rgb(var(--m3-primary))',
                      }
                    : undefined
                }
                type="button"
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {selected && <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <div className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">暂无可选项</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
