'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Dialog from './Dialog';
import Button from './Button';
import { Input } from './Input';

// ─── UI Kit: Confirm Dialog ──────────────────────────────────────────────────
// Промісна заміна нативних confirm()/prompt().
//
// const confirm = useConfirm();
//
// if (!(await confirm({ title: 'Видалити спринт?', danger: true }))) return;
//
// const typed = await confirm({
//   title: 'Видалення організації',
//   message: 'Введіть DELETE для повного видалення',
//   input: { placeholder: 'DELETE' },
// });                      // → рядок або null (скасовано)

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const resolverRef = useRef(null);

  const confirm = useCallback(opts => {
    return new Promise(resolve => {
      resolverRef.current = resolve;
      setInputValue('');
      setRequest(typeof opts === 'string' ? { title: opts } : opts);
    });
  }, []);

  const settle = result => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(result);
  };

  const {
    title = 'Підтвердіть дію',
    message,
    confirmText = 'Підтвердити',
    cancelText = 'Скасувати',
    danger = false,
    input = null,
  } = request || {};

  const handleCancel = () => settle(input ? null : false);
  const handleConfirm = () => settle(input ? inputValue : true);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog isOpen={!!request} onClose={handleCancel} title={title} size="sm">
        <form
          onSubmit={e => { e.preventDefault(); handleConfirm(); }}
          className="flex flex-col gap-[16px]"
        >
          {message && (
            <p className="text-[13px] text-[#6b6b6b] leading-relaxed whitespace-pre-line">{message}</p>
          )}
          {input && (
            <Input
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={input.placeholder || ''}
            />
          )}
          <div className="flex justify-end gap-[8px]">
            <Button style="secondary" size="md" onClick={handleCancel}>{cancelText}</Button>
            <Button
              type="submit"
              style="primary"
              color={danger ? 'red' : 'dark'}
              size="md"
              autoFocus={!input}
            >
              {confirmText}
            </Button>
          </div>
        </form>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return confirm;
}

export default ConfirmProvider;
