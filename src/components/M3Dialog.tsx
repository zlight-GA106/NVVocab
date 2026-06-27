import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type DialogTone = 'danger' | 'primary';

type M3DialogProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel: string;
  description?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: DialogTone;
};

const dialogAnimationMs = 180;

export default function M3Dialog({
  cancelLabel = '取消',
  children,
  confirmLabel,
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  title,
  tone = 'primary',
}: M3DialogProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    let animationFrameId = 0;
    let timeoutId = 0;

    if (open) {
      setShouldRender(true);
      animationFrameId = window.requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(animationFrameId);
      };
    }

    setVisible(false);
    timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, dialogAnimationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const confirmStyle =
    tone === 'danger'
      ? {
          backgroundColor: 'rgb(var(--m3-error))',
          color: 'white',
        }
      : {
          backgroundColor: 'rgb(var(--m3-primary))',
          color: 'rgb(var(--m3-on-primary))',
        };

  return (
    <div
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      role="dialog"
    >
      <div
        className={`w-full max-w-md rounded-[28px] border border-white/30 p-6 shadow-2xl backdrop-blur-md transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] dark:border-white/10 ${
          visible ? 'translate-y-0 scale-100 opacity-100 blur-0' : 'translate-y-3 scale-[0.96] opacity-0 blur-sm'
        }`}
        style={{ backgroundColor: 'rgb(var(--m3-surface) / 0.92)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  tone === 'danger' ? 'rgb(var(--m3-error) / 0.14)' : 'rgb(var(--m3-primary-container))',
                color: tone === 'danger' ? 'rgb(var(--m3-error))' : 'rgb(var(--m3-primary))',
              }}
            >
              <AlertTriangle aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">{title}</h2>
              {description && (
                <p className="mt-2 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">{description}</p>
              )}
            </div>
          </div>
          <button
            aria-label="关闭对话框"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[#49454f] transition-all duration-200 hover:scale-105 hover:bg-[#f3edf7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#cac4d0] dark:hover:bg-[#2b2930]"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>
        </div>

        {children && <div className="mt-5 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">{children}</div>}

        <div className="mt-7 flex justify-end gap-3">
          <button
            className="h-10 rounded-full border border-[#79747e] px-5 text-sm font-medium text-[#49454f] transition-all duration-200 hover:scale-[1.02] hover:bg-[#f3edf7] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#938f99] dark:text-[#cac4d0] dark:hover:bg-[#2b2930]"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="h-10 rounded-full px-5 text-sm font-medium shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={onConfirm}
            style={confirmStyle}
            type="button"
          >
            {loading ? '处理中' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
