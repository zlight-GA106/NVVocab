import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  BookOpenText,
  Check,
  Eye,
  FileText,
  GripVertical,
  ListOrdered,
  Printer,
  ReceiptText,
  Tags,
  Trash2,
  Type,
} from 'lucide-react';
import M3Dialog from '../components/M3Dialog';
import M3Select, { type M3SelectOption } from '../components/M3Select';
import { usePrintQueue } from '../hooks/usePrintQueue';
import { printAllBookTagValue, usePrintWords, type PrintWordItem } from '../hooks/usePrintWords';
import { printQueueSelectionValue } from '../lib/printQueue';

type PaperType = 'thermal58' | 'a4';
type EditorViewMode = 'preview' | 'manager';

type PrintPreviewStyle = CSSProperties & {
  '--print-font-size': string;
};

type ToggleControlProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

const surfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.5)',
} satisfies CSSProperties;

function getBlankText(source: string, minimumLength: number): string {
  const length = Math.max(minimumLength, Math.min(source.trim().length + 2, 18));
  return '_'.repeat(length);
}

function ToggleControl({ checked, label, onChange }: ToggleControlProps) {
  return (
    <button
      aria-pressed={checked}
      className="flex h-12 items-center justify-between gap-4 rounded-full border border-neutral-400/70 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/50 px-4 text-sm font-medium text-neutral-900 dark:text-neutral-100 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span>{label}</span>
      <span
        className="flex h-6 w-11 items-center rounded-full p-0.5 transition-colors"
        style={{
          backgroundColor: checked ? 'rgb(var(--m3-primary))' : 'rgb(var(--m3-surface-variant))',
        }}
      >
        <span
          className="flex size-5 items-center justify-center rounded-full bg-white text-[10px] transition-transform"
          style={{
            color: checked ? 'rgb(var(--m3-primary))' : 'rgb(var(--m3-on-surface-variant))',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        >
          {checked ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
        </span>
      </span>
    </button>
  );
}

function PaperSegment({
  currentPaper,
  onChange,
}: {
  currentPaper: PaperType;
  onChange: (paper: PaperType) => void;
}) {
  const options: Array<{ icon: typeof ReceiptText; label: string; value: PaperType }> = [
    { icon: ReceiptText, label: '58mm 热敏纸', value: 'thermal58' },
    { icon: FileText, label: 'A4 打印纸', value: 'a4' },
  ];

  return (
    <div className="inline-flex h-12 rounded-full border border-neutral-400/70 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/50 p-1 text-neutral-900 dark:text-neutral-100">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = currentPaper === option.value;

        return (
          <button
            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
            key={option.value}
            onClick={() => onChange(option.value)}
            style={
              isActive
                ? {
                    backgroundColor: 'rgb(var(--m3-primary-container))',
                    color: 'rgb(var(--m3-primary))',
                  }
                : undefined
            }
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.value === 'thermal58' ? '58mm' : 'A4'}</span>
          </button>
        );
      })}
    </div>
  );
}

function ViewModeSegment({
  mode,
  onChange,
}: {
  mode: EditorViewMode;
  onChange: (mode: EditorViewMode) => void;
}) {
  const options: Array<{ icon: typeof Eye; label: string; value: EditorViewMode }> = [
    { icon: Eye, label: '排版预览模式', value: 'preview' },
    { icon: ListOrdered, label: '列表管理排序', value: 'manager' },
  ];

  return (
    <div className="inline-flex h-12 rounded-full border border-neutral-400/70 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/50 p-1 text-neutral-900 dark:text-neutral-100">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.value;

        return (
          <button
            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
            key={option.value}
            onClick={() => onChange(option.value)}
            style={
              isActive
                ? {
                    backgroundColor: 'rgb(var(--m3-primary-container))',
                    color: 'rgb(var(--m3-primary))',
                  }
                : undefined
            }
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.value === 'preview' ? '预览' : '排序'}</span>
          </button>
        );
      })}
    </div>
  );
}

function PrintWordRow({
  keepTranslate,
  keepWords,
  paperType,
  word,
}: {
  keepTranslate: boolean;
  keepWords: boolean;
  paperType: PaperType;
  word: PrintWordItem;
}) {
  const wordText = keepWords ? word.words : getBlankText(word.words, 8);
  const translateText = keepTranslate ? word.translate : getBlankText(word.translate, 10);
  const isThermal = paperType === 'thermal58';

  return (
    <article
      className={[
        'print-editor-word-item break-inside-avoid border-black/15 text-black',
        isThermal
          ? 'grid grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-2 border-b py-1.5'
          : 'rounded-xl border p-3',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div
          className={[
            'print-editor-word-text break-words font-semibold leading-tight',
            keepWords ? '' : 'print-editor-placeholder tracking-wide',
          ].join(' ')}
        >
          {wordText}
        </div>
        {keepWords && word.phonetic && (
          <div className="mt-0.5 break-words text-[0.78em] leading-snug text-black/70">[{word.phonetic}]</div>
        )}
      </div>
      <div
        className={[
          'print-editor-translation min-w-0 break-words text-[0.86em] leading-snug',
          keepTranslate ? '' : 'print-editor-placeholder tracking-wide',
          isThermal ? 'text-right' : 'mt-2 text-left',
        ].join(' ')}
      >
        {translateText}
      </div>
    </article>
  );
}

function PrintSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="h-24 animate-pulse rounded-2xl bg-white/70 dark:bg-neutral-900/50" key={index} />
      ))}
    </div>
  );
}

function QueueManagerPanel({
  draggedIndex,
  errorMessage,
  hoveredIndex,
  loading,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onRegisterRow,
  onRemove,
  words,
}: {
  draggedIndex: number | null;
  errorMessage: string;
  hoveredIndex: number | null;
  loading: boolean;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onRegisterRow: (id: string, element: HTMLDivElement | null) => void;
  onRemove: (word: PrintWordItem) => void;
  words: PrintWordItem[];
}) {
  return (
    <section
      className="no-print rounded-[28px] border border-neutral-200/40 dark:border-neutral-800 p-5 shadow-sm backdrop-blur-md  sm:p-6"
      style={surfaceStyle}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-medium text-neutral-900 dark:text-neutral-100">候选篮管理</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            拖动左侧抓取手柄调整打印顺序，右侧按钮可剔除不需要打印的词。
          </p>
        </div>
        <span
          className="inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium"
          style={{
            backgroundColor: 'rgb(var(--m3-primary-container))',
            color: 'rgb(var(--m3-primary))',
          }}
        >
          {words.length} 词
        </span>
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-3 rounded-[18px] border border-error/55 bg-error/12 p-4 text-sm leading-6 text-neutral-900 dark:text-neutral-100">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="h-20 animate-pulse rounded-xl bg-white/70 dark:bg-neutral-900/50" key={index} />
          ))}
        </div>
      ) : words.length > 0 ? (
        <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
          {words.map((word, index) => {
            const isDragTarget = hoveredIndex === index && draggedIndex !== null && draggedIndex !== index;
            const isDragging = draggedIndex === index;

            return (
              <div
                className="flex transform-gpu cursor-grab items-center gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow,opacity] duration-200 will-change-transform active:cursor-grabbing"
                draggable
                key={word.id}
                onDragEnd={onDragEnd}
                onDragOver={(event) => onDragOver(event, index)}
                onDragStart={(event) => onDragStart(event, index)}
                onDrop={(event) => onDrop(event, index)}
                ref={(element) => onRegisterRow(word.id, element)}
                style={{
                  backgroundColor: isDragTarget
                    ? 'rgb(var(--m3-primary) / 0.1)'
                    : 'rgb(var(--m3-surface) / 0.5)',
                  borderColor: isDragTarget ? 'rgb(var(--m3-primary) / 0.3)' : 'rgb(255 255 255 / 0.34)',
                  opacity: isDragging ? 0.58 : 1,
                }}
              >
                <GripVertical
                  aria-hidden="true"
                  className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400"
                  strokeWidth={2}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="break-words text-base font-medium text-neutral-900 dark:text-neutral-100">
                      {word.words}
                    </h3>
                    {word.phonetic && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">[{word.phonetic}]</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                    {word.translate}
                  </p>
                </div>
                <button
                  aria-label={`从候选篮移除 ${word.words}`}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-error transition-colors hover:bg-error/12"
                  onClick={() => onRemove(word)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-neutral-200/40 dark:border-neutral-800 text-center ">
          <ListOrdered aria-hidden="true" className="mb-3 size-8 text-neutral-500 dark:text-neutral-400" strokeWidth={2} />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">候选篮暂无词条</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            请先在词库一览页将单词加入打印候选，再回来调整排序。
          </p>
        </div>
      )}
    </section>
  );
}

export default function PrintEditor() {
  const [selectedSource, setSelectedSource] = useState(printAllBookTagValue);
  const [viewMode, setViewMode] = useState<EditorViewMode>('preview');
  const [paperType, setPaperType] = useState<PaperType>('thermal58');
  const [keepWords, setKeepWords] = useState(true);
  const [keepTranslate, setKeepTranslate] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedWordId, setDraggedWordId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [managerWords, setManagerWords] = useState<PrintWordItem[]>([]);
  const rowElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const pendingQueueOrderRef = useRef<string[] | null>(null);
  const printQueue = usePrintQueue();
  const isUsingPrintQueue = selectedSource === printQueueSelectionValue;
  const { bookTags, errorMessage, filteredCount, loading, totalCount, words } = usePrintWords({
    bookTag: isUsingPrintQueue ? printAllBookTagValue : selectedSource,
    wordIds: isUsingPrintQueue ? printQueue.ids : undefined,
  });
  const {
    errorMessage: queueErrorMessage,
    loading: queueLoading,
    words: queueWords,
  } = usePrintWords({
    bookTag: printAllBookTagValue,
    wordIds: printQueue.ids,
  });

  const previewStyle = useMemo<PrintPreviewStyle>(
    () => ({
      '--print-font-size': `${fontSize}px`,
    }),
    [fontSize],
  );
  const sourceOptions = useMemo<M3SelectOption[]>(
    () => [
      { label: `当前选中的打印候选篮（${printQueue.count} 词）`, value: printQueueSelectionValue },
      { label: '全部清单', value: printAllBookTagValue },
      ...bookTags.map((tag) => ({ label: tag, value: tag })),
    ],
    [bookTags, printQueue.count],
  );

  const paperLabel = paperType === 'thermal58' ? '58mm 热敏纸' : 'A4 打印纸';
  const sourceLabel = isUsingPrintQueue
    ? `打印候选篮（${printQueue.count} 词）`
    : selectedSource === printAllBookTagValue
      ? '全部清单'
      : selectedSource;

  useEffect(() => {
    const pendingOrder = pendingQueueOrderRef.current;

    if (pendingOrder) {
      const queueWordIds = queueWords.map((word) => word.id);
      const queueMatchesPendingOrder =
        queueWordIds.length === pendingOrder.length &&
        queueWordIds.every((id, index) => id === pendingOrder[index]);

      if (queueMatchesPendingOrder) {
        pendingQueueOrderRef.current = null;
        setManagerWords(queueWords);
      }

      return;
    }

    if (draggedWordId === null) {
      setManagerWords(queueWords);
    }
  }, [draggedWordId, queueWords]);

  useLayoutEffect(() => {
    previousRectsRef.current.forEach((previousRect, id) => {
      const element = rowElementsRef.current.get(id);

      if (!element) {
        return;
      }

      const nextRect = element.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 210,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
        },
      );
    });

    previousRectsRef.current.clear();
  }, [managerWords]);

  const handleFontSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFontSize(Number(event.target.value));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearPrintQueue = () => {
    printQueue.clear();
    setClearDialogOpen(false);
  };

  const captureRowPositions = () => {
    previousRectsRef.current = new Map(
      Array.from(rowElementsRef.current.entries()).map(([id, element]) => [id, element.getBoundingClientRect()]),
    );
  };

  const handleRegisterRow = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      rowElementsRef.current.set(id, element);
      return;
    }

    rowElementsRef.current.delete(id);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    const draggedWord = managerWords[index];

    if (!draggedWord) {
      return;
    }

    setDraggedIndex(index);
    setDraggedWordId(draggedWord.id);
    setHoveredIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedWord.id);

    const transparentDragImage = document.createElement('canvas');
    transparentDragImage.width = 1;
    transparentDragImage.height = 1;
    event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setHoveredIndex((currentIndex) => (currentIndex === index ? currentIndex : index));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, hoveredTargetIndex: number) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === hoveredTargetIndex) {
      setDraggedIndex(null);
      setDraggedWordId(null);
      setHoveredIndex(null);
      return;
    }

    captureRowPositions();
    const updatedWords = [...managerWords];
    const [removedWord] = updatedWords.splice(draggedIndex, 1);

    if (!removedWord) {
      setDraggedIndex(null);
      setDraggedWordId(null);
      setHoveredIndex(null);
      return;
    }

    updatedWords.splice(hoveredTargetIndex, 0, removedWord);
    const updatedVisibleIds = updatedWords.map((word) => word.id);
    const visibleIdSet = new Set(updatedVisibleIds);
    const hiddenIds = printQueue.ids.filter((id) => !visibleIdSet.has(id));
    const updatedQueueIds = [...updatedVisibleIds, ...hiddenIds];

    pendingQueueOrderRef.current = updatedVisibleIds;
    setManagerWords(updatedWords);
    printQueue.replace(updatedQueueIds);
    setDraggedIndex(null);
    setDraggedWordId(null);
    setHoveredIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggedWordId(null);
    setHoveredIndex(null);
  };

  const handleRemoveQueueWord = (word: PrintWordItem) => {
    printQueue.remove(word.id);
  };

  return (
    <div className="print-editor-root space-y-6">
      <header className="no-print space-y-2">
        <p className="text-sm font-medium text-primary">打印编辑器 Print Editor</p>
        <h1 className="text-3xl font-normal text-neutral-900 dark:text-neutral-100">印刷排版</h1>
        <p className="max-w-3xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          从词库筛选单词，调整纸张和字号，打印前可直接点选纸面内容进行删改。
        </p>
      </header>

      <section
        className="no-print rounded-[28px] border border-neutral-200/40 dark:border-neutral-800 p-5 shadow-sm backdrop-blur-md  sm:p-6"
        style={surfaceStyle}
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
            >
              <BookOpenText aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-neutral-900 dark:text-neutral-100">打印控制指挥部</h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                当前词库 {totalCount} 词，本次排版 {filteredCount} 词。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewModeSegment mode={viewMode} onChange={setViewMode} />
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              disabled={viewMode !== 'preview' || loading || words.length === 0}
              onClick={handlePrint}
              style={{
                backgroundColor: 'rgb(var(--m3-primary))',
                color: 'rgb(var(--m3-on-primary))',
              }}
              type="button"
            >
              <Printer aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>执行打印</span>
            </button>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-neutral-400/70 dark:border-neutral-700 px-5 text-sm font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/70 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={printQueue.count === 0}
              onClick={() => setClearDialogOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>清空候选篮</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_auto_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">词库范围</span>
            <M3Select icon={Tags} onChange={setSelectedSource} options={sourceOptions} value={selectedSource} />
          </label>

          <div>
            <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">纸张规格</span>
            <PaperSegment currentPaper={paperType} onChange={setPaperType} />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">字号微调</span>
            <div className="flex h-12 items-center gap-3 rounded-[16px] border border-neutral-400/70 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/50 px-4 text-neutral-900 dark:text-neutral-100">
              <Type aria-hidden="true" className="size-4 text-primary" strokeWidth={2} />
              <input
                className="min-w-28 flex-1 accent-[rgb(var(--m3-primary))]"
                max={32}
                min={12}
                onChange={handleFontSizeChange}
                type="range"
                value={fontSize}
              />
              <span className="w-12 text-right text-sm text-neutral-500 dark:text-neutral-400">{fontSize}px</span>
            </div>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleControl checked={keepWords} label="保留单词" onChange={setKeepWords} />
          <ToggleControl checked={keepTranslate} label="保留翻译" onChange={setKeepTranslate} />
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-error/55 bg-error/12 p-4 text-sm leading-6 text-neutral-900 dark:text-neutral-100">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
            <span>{errorMessage}</span>
          </div>
        )}
      </section>

      {viewMode === 'preview' ? (
        <section className="print-editor-preview flex justify-center overflow-x-auto rounded-[28px] border border-neutral-200/40 dark:border-neutral-800 p-4 shadow-sm backdrop-blur-md  sm:p-6 print:block print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div
            aria-label={`${paperLabel} 可编辑打印预览`}
            className={[
              'print-editor-paper bg-white text-black shadow-xl outline-none transition-all',
              paperType === 'thermal58'
                ? 'w-[58mm] min-h-[220mm] rounded-[12px] p-[3mm]'
                : 'min-h-[297mm] w-full max-w-[210mm] rounded-[18px] p-[14mm]',
            ].join(' ')}
            contentEditable
            data-paper={paperType}
            role="document"
            style={previewStyle}
            suppressContentEditableWarning
          >
            <div className="print-editor-paper-title mb-3 border-b border-black/20 pb-2 text-center">
              <div className="text-[0.95em] font-semibold">{sourceLabel}</div>
              <div className="mt-1 text-[0.72em] text-black/60">{paperLabel} · {filteredCount} 词</div>
            </div>

            {loading ? (
              <PrintSkeleton />
            ) : words.length > 0 ? (
              <div
                className={[
                  paperType === 'thermal58'
                    ? 'print-editor-list-thermal space-y-0'
                    : 'print-editor-list-a4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3',
                ].join(' ')}
              >
                {words.map((word) => (
                  <PrintWordRow
                    keepTranslate={keepTranslate}
                    keepWords={keepWords}
                    key={word.id}
                    paperType={paperType}
                    word={word}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center text-center text-[0.92em] leading-6 text-black">
                暂无可打印词条
              </div>
            )}
          </div>
        </section>
      ) : (
        <QueueManagerPanel
          draggedIndex={draggedIndex}
          errorMessage={queueErrorMessage}
          hoveredIndex={hoveredIndex}
          loading={queueLoading && managerWords.length === 0}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onRegisterRow={handleRegisterRow}
          onRemove={handleRemoveQueueWord}
          words={managerWords}
        />
      )}

      <style>{`
        .print-editor-preview {
          background-color: rgb(var(--m3-surface) / 0.28);
        }

        .print-editor-paper {
          font-size: var(--print-font-size);
        }

        .print-editor-placeholder {
          color: transparent;
          text-decoration-line: underline;
          text-decoration-style: dashed;
          text-decoration-color: black;
          text-underline-offset: 0.18em;
          -webkit-text-decoration-color: black;
        }

        .print-editor-paper:focus {
          box-shadow: 0 0 0 3px rgb(var(--m3-primary) / 0.25), 0 24px 80px rgb(0 0 0 / 0.18);
        }

        @media print {
          @page {
            size: ${paperType === 'thermal58' ? '58mm auto' : 'A4 portrait'};
            margin: ${paperType === 'thermal58' ? '0mm' : '15mm'};
          }

          html,
          body,
          #root {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            background: white !important;
            color: black !important;
          }

          body {
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print,
          aside,
          header,
          nav {
            display: none !important;
          }

          main,
          main > div,
          .route-transition-page,
          .print-editor-root,
          .print-editor-preview {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .print-editor-paper {
            background: white !important;
            color: black !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            outline: none !important;
          }

          .print-editor-paper,
          .print-editor-paper * {
            color: black !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          .print-editor-paper[data-paper='thermal58'] {
            width: 58mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 2mm 2.5mm !important;
          }

          .print-editor-paper[data-paper='a4'] {
            width: 180mm !important;
            min-height: 267mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .print-editor-paper-title {
            border-color: black !important;
          }

          .print-editor-list-a4 {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 4mm 5mm !important;
          }

          .print-editor-list-thermal {
            display: block !important;
          }

          .print-editor-word-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border-color: black !important;
          }

          .print-editor-paper[data-paper='thermal58'] .print-editor-word-item {
            border-width: 0 0 0.2mm 0 !important;
            padding: 1.3mm 0 !important;
          }

          .print-editor-paper[data-paper='a4'] .print-editor-word-item {
            border-width: 0.2mm !important;
            border-radius: 0 !important;
            padding: 2.5mm !important;
          }

          .print-editor-placeholder {
            color: transparent !important;
            -webkit-text-decoration-color: black !important;
            text-decoration-color: black !important;
          }
        }
      `}</style>

      <M3Dialog
        confirmLabel="确定清空"
        description={`将清空当前本机暂存的 ${printQueue.count} 个打印候选词。词库数据不会被删除。`}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={handleClearPrintQueue}
        open={clearDialogOpen}
        title="清空打印候选篮"
        tone="danger"
      />
    </div>
  );
}
