import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

/* ============================== Toast ============================== */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = 'info', duration = 3500 } = {}) => {
      counterRef.current += 1;
      const id = counterRef.current;
      setToasts((current) => [...current.slice(-4), { id, message, type }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, type: 'success' }),
      error: (message, options) => push(message, { ...options, type: 'error' }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <span>{toast.message}</span>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Đóng">
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

/* ============================ Confirm dialog ============================ */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback(
    ({ title = 'Xác nhận', message = '', okLabel = 'Xác nhận', cancelLabel = 'Hủy', danger = false } = {}) =>
      new Promise((resolve) => {
        setDialog({ title, message, okLabel, cancelLabel, danger, resolve });
      }),
    []
  );

  function close(result) {
    dialog?.resolve(result);
    setDialog(null);
  }

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog ? (
        <div className="modal-backdrop" onClick={() => close(false)}>
          <div
            className="confirm-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{dialog.title}</h3>
            {dialog.message ? <p>{dialog.message}</p> : null}
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`confirm-ok${dialog.danger ? ' danger' : ''}`}
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.okLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context.confirm;
}

/* ============================ States ============================ */

export function EmptyState({ icon = '🗒', title = 'Không có dữ liệu', description }) {
  return (
    <div className="state-block">
      <div className="state-icon">{icon}</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function ErrorState({ title = 'Có lỗi xảy ra', description, onRetry }) {
  return (
    <div className="state-block">
      <div className="state-icon">⚠️</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {onRetry ? (
        <button type="button" className="ghost-btn" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  );
}
