import React, { useCallback, useEffect, useRef, useState } from 'react';
import MarkdownViewer from './MarkdownViewer';
import {
  continueMarkdownList,
  formatHeading,
  formatInline,
  formatList,
  indentLines,
  insertBlock as insertMarkdownBlock,
  insertCodeBlock as createCodeBlock,
  insertLink as createLink,
  setTaskChecked,
} from '@/lib/utils/markdownEditor.mjs';
import {
  Bold,
  Braces,
  CheckSquare,
  Code2,
  Columns2,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Paperclip,
  Pencil,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react';

const MAX_HISTORY = 120;

function ToolbarButton({ icon: Icon, label, onClick, disabled = false, active = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-white text-ink' : 'text-muted hover:bg-white hover:text-ink'}`}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden="true" />;
}

function cleanFileName(name = 'file') {
  return name.replace(/[\[\]]/g, '').trim() || 'file';
}

export default function MarkdownEditor({
  value = '',
  onChange,
  placeholder = 'Напишіть опис завдання...',
  minHeight = '150px',
  defaultTab = 'write',
  onUploadFiles,
  uploading = false,
}) {
  const initialMode = defaultTab === 'preview' ? 'preview' : 'write';
  const [mode, setMode] = useState(initialMode);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const valueRef = useRef(value);
  const historyRef = useRef([{ value, selectionStart: 0, selectionEnd: 0 }]);
  const historyIndexRef = useRef(0);
  const lastHistoryAtRef = useRef(0);

  useEffect(() => {
    if (value === valueRef.current) return;
    valueRef.current = value;
    historyRef.current = [{ value, selectionStart: 0, selectionEnd: 0 }];
    historyIndexRef.current = 0;
    selectionRef.current = { start: 0, end: 0 };
    setHistoryState({ canUndo: false, canRedo: false });
  }, [value]);

  const focusSelection = useCallback((start, end = start) => {
    selectionRef.current = { start, end };
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  }, []);

  const commit = useCallback((nextValue, selectionStart, selectionEnd = selectionStart, { coalesce = false, record = true } = {}) => {
    valueRef.current = nextValue;
    onChange(nextValue);

    if (record) {
      const now = Date.now();
      const history = historyRef.current.slice(0, historyIndexRef.current + 1);
      const canCoalesce = coalesce && now - lastHistoryAtRef.current < 700 && history.length > 1;
      const entry = { value: nextValue, selectionStart, selectionEnd };
      if (canCoalesce) history[history.length - 1] = entry;
      else history.push(entry);
      if (history.length > MAX_HISTORY) history.shift();
      historyRef.current = history;
      historyIndexRef.current = history.length - 1;
      lastHistoryAtRef.current = now;
      setHistoryState({ canUndo: historyIndexRef.current > 0, canRedo: false });
    }

    focusSelection(selectionStart, selectionEnd);
  }, [focusSelection, onChange]);

  const currentSelection = useCallback(() => {
    const text = valueRef.current;
    const remembered = selectionRef.current;
    return {
      text,
      start: Math.min(remembered.start, text.length),
      end: Math.min(remembered.end, text.length),
    };
  }, []);

  const rememberSelection = useCallback((event) => {
    selectionRef.current = {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    };
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const entry = historyRef.current[historyIndexRef.current];
    valueRef.current = entry.value;
    onChange(entry.value);
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
    focusSelection(entry.selectionStart, entry.selectionEnd);
  }, [focusSelection, onChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const entry = historyRef.current[historyIndexRef.current];
    valueRef.current = entry.value;
    onChange(entry.value);
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
    focusSelection(entry.selectionStart, entry.selectionEnd);
  }, [focusSelection, onChange]);

  const applyInline = useCallback((before, after = before, fallback = 'текст') => {
    const { text, start, end } = currentSelection();
    const result = formatInline(text, start, end, before, after, fallback);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const applyHeading = useCallback((level) => {
    const { text, start, end } = currentSelection();
    const result = formatHeading(text, start, end, level);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const applyList = useCallback((kind) => {
    const { text, start, end } = currentSelection();
    const result = formatList(text, start, end, kind);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const insertLink = useCallback(() => {
    const { text, start, end } = currentSelection();
    const result = createLink(text, start, end);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const insertBlock = useCallback((markdown, selectionOffset = markdown.length) => {
    const { text, start, end } = currentSelection();
    const result = insertMarkdownBlock(text, start, end, markdown, selectionOffset);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const insertCodeBlock = useCallback(() => {
    const { text, start, end } = currentSelection();
    const result = createCodeBlock(text, start, end);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const uploadAndInsert = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!onUploadFiles || files.length === 0) return;
    const { text, start, end } = currentSelection();
    const uploaded = await onUploadFiles(files);
    if (!uploaded?.length) return;

    const markdown = uploaded.map(file => {
      const url = file.url || file.downloadUrl || file.downloadURL;
      const name = cleanFileName(file.name);
      return file.type?.startsWith('image/') ? `![${name}](${url})` : `[${name}](${url})`;
    }).join('\n\n');
    const prefix = start > 0 && !text.slice(0, start).endsWith('\n') ? '\n\n' : '';
    const suffix = end < text.length && !text.slice(end).startsWith('\n') ? '\n\n' : '';
    const next = text.slice(0, start) + prefix + markdown + suffix + text.slice(end);
    const cursor = start + prefix.length + markdown.length;
    commit(next, cursor, cursor);
  }, [commit, currentSelection, onUploadFiles]);

  const indentSelection = useCallback((outdent = false) => {
    const { text, start, end } = currentSelection();
    const result = indentLines(text, start, end, outdent);
    commit(result.value, result.selectionStart, result.selectionEnd);
  }, [commit, currentSelection]);

  const continueList = useCallback((event) => {
    const { text, start, end } = currentSelection();
    const result = continueMarkdownList(text, start, end);
    if (!result) return false;
    event.preventDefault();
    commit(result.value, result.selectionStart, result.selectionEnd);
    return true;
  }, [commit, currentSelection]);

  const handleKeyDown = useCallback((event) => {
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      applyInline('**', '**', 'жирний текст');
      return;
    }
    if (command && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      applyInline('*', '*', 'курсив');
      return;
    }
    if (command && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      insertLink();
      return;
    }
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (command && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      indentSelection(event.shiftKey);
      return;
    }
    if (event.key === 'Enter') continueList(event);
  }, [applyInline, continueList, indentSelection, insertLink, redo, undo]);

  const handleTextChange = useCallback((event) => {
    const nextValue = event.target.value;
    selectionRef.current = { start: event.target.selectionStart, end: event.target.selectionEnd };
    commit(nextValue, event.target.selectionStart, event.target.selectionEnd, { coalesce: true });
  }, [commit]);

  const toggleTask = useCallback((taskLine, checked) => {
    const next = setTaskChecked(valueRef.current, taskLine, checked);
    if (next === valueRef.current) return;
    const selection = selectionRef.current;
    commit(next, selection.start, selection.end);
  }, [commit]);

  const { canUndo, canRedo } = historyState;
  const editorClassName = fullscreen
    ? 'fixed inset-3 z-[200] flex flex-col overflow-hidden rounded-[16px] border border-line bg-white sm:inset-6'
    : 'flex w-full flex-col overflow-hidden rounded-[16px] border border-line bg-white';

  return (
    <div className={editorClassName}>
      <div className="flex min-w-0 items-center gap-1 border-b border-line bg-canvas p-1.5">
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Undo2} label="Скасувати (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
          <ToolbarButton icon={Redo2} label="Повторити (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
        </div>
        <ToolbarDivider />
        <div className="hide-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
          <ToolbarButton icon={Heading1} label="Заголовок 1" onClick={() => applyHeading(1)} />
          <ToolbarButton icon={Heading2} label="Заголовок 2" onClick={() => applyHeading(2)} />
          <ToolbarButton icon={Heading3} label="Заголовок 3" onClick={() => applyHeading(3)} />
          <ToolbarDivider />
          <ToolbarButton icon={Bold} label="Жирний (Ctrl+B)" onClick={() => applyInline('**', '**', 'жирний текст')} />
          <ToolbarButton icon={Italic} label="Курсив (Ctrl+I)" onClick={() => applyInline('*', '*', 'курсив')} />
          <ToolbarButton icon={Strikethrough} label="Закреслений" onClick={() => applyInline('~~', '~~', 'закреслений текст')} />
          <ToolbarButton icon={Code2} label="Вбудований код" onClick={() => applyInline('`', '`', 'код')} />
          <ToolbarDivider />
          <ToolbarButton icon={List} label="Маркований список" onClick={() => applyList('bullet')} />
          <ToolbarButton icon={ListOrdered} label="Нумерований список" onClick={() => applyList('ordered')} />
          <ToolbarButton icon={CheckSquare} label="Чекліст" onClick={() => applyList('task')} />
          <ToolbarButton icon={Quote} label="Цитата" onClick={() => applyList('quote')} />
          <ToolbarDivider />
          <ToolbarButton icon={LinkIcon} label="Посилання (Ctrl+K)" onClick={insertLink} />
          <ToolbarButton icon={Braces} label="Блок коду" onClick={insertCodeBlock} />
          <ToolbarButton icon={Table2} label="Таблиця" onClick={() => insertBlock('| Колонка 1 | Колонка 2 |\n| --- | --- |\n| Значення | Значення |')} />
          <ToolbarButton icon={Minus} label="Розділювач" onClick={() => insertBlock('---')} />
          {onUploadFiles && (
            <>
              <ToolbarDivider />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => {
                  uploadAndInsert(event.target.files);
                  event.target.value = '';
                }}
              />
              <ToolbarButton
                icon={uploading ? LoaderCircle : Paperclip}
                label="Додати зображення або файл"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              />
            </>
          )}
        </div>
        <ToolbarDivider />
        <div className="flex items-center gap-0.5 rounded-[10px] bg-black/[0.04] p-0.5">
          <ToolbarButton icon={Pencil} label="Редагування" active={mode === 'write'} onClick={() => setMode('write')} />
          <ToolbarButton icon={Columns2} label="Редагування і перегляд" active={mode === 'split'} onClick={() => setMode('split')} />
          <ToolbarButton icon={Eye} label="Попередній перегляд" active={mode === 'preview'} onClick={() => setMode('preview')} />
        </div>
        <ToolbarButton icon={fullscreen ? Minimize2 : Maximize2} label={fullscreen ? 'Вийти з повноекранного режиму' : 'Повноекранний режим'} onClick={() => setFullscreen(current => !current)} />
      </div>

      <div className={`min-h-0 flex-1 ${mode === 'split' ? 'grid md:grid-cols-2' : 'block'}`}>
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            onSelect={rememberSelection}
            onClick={rememberSelection}
            onKeyUp={rememberSelection}
            onKeyDown={handleKeyDown}
            onPaste={event => {
              if (!onUploadFiles || event.clipboardData.files.length === 0) return;
              event.preventDefault();
              uploadAndInsert(event.clipboardData.files);
            }}
            onDrop={event => {
              if (!onUploadFiles || event.dataTransfer.files.length === 0) return;
              event.preventDefault();
              uploadAndInsert(event.dataTransfer.files);
            }}
            onDragOver={event => {
              if (onUploadFiles && event.dataTransfer.types.includes('Files')) event.preventDefault();
            }}
            placeholder={placeholder}
            className={`custom-scrollbar w-full resize-none bg-white p-4 text-[14px] leading-6 text-ink outline-none placeholder:text-faint ${mode === 'split' ? 'border-b border-line md:border-b-0 md:border-r' : ''}`}
            style={{ minHeight: fullscreen ? 'calc(100dvh - 112px)' : minHeight }}
            spellCheck
          />
        )}
        {mode !== 'write' && (
          <div
            className="custom-scrollbar w-full overflow-y-auto bg-white p-4"
            style={{ minHeight: fullscreen ? 'calc(100dvh - 112px)' : minHeight }}
          >
            {value.trim() ? (
              <MarkdownViewer content={value} onTaskToggle={toggleTask} />
            ) : (
              <p className="text-[14px] italic text-muted">Опис ще порожній</p>
            )}
          </div>
        )}
      </div>

      <div className="flex h-7 items-center justify-end gap-3 border-t border-line bg-canvas px-3 text-[10px] font-medium text-muted">
        <span>{value.trim() ? value.trim().split(/\s+/).length : 0} слів</span>
        <span>{value.length} символів</span>
      </div>
    </div>
  );
}
