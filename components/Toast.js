'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const STYLES = {
  success: { icon: CheckCircle2, ring: 'border-green-200', bar: 'bg-green-500', tint: 'text-green-600' },
  error: { icon: XCircle, ring: 'border-red-200', bar: 'bg-red-500', tint: 'text-red-600' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', bar: 'bg-amber-500', tint: 'text-amber-600' },
  info: { icon: Info, ring: 'border-blue-200', bar: 'bg-blue-500', tint: 'text-blue-600' },
};

/**
 * Toast state.
 *
 * Replaces the blocking `alert()` calls the app used for every outcome, which
 * froze the page mid-upload and could not show a link.
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, message, options = {}) => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, type, message, ...options }]);
      // Errors stay until dismissed; they usually need reading and acting on.
      if (type !== 'error') {
        timers.current.set(id, setTimeout(() => dismiss(id), options.duration ?? 6000));
      }
      return id;
    },
    [dismiss],
  );

  // Auto-dismiss timers outlive the component otherwise, and keep firing after
  // a sign-out has navigated away from the dashboard.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, dismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const style = STYLES[toast.type] ?? STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className={`flex gap-3 overflow-hidden rounded-xl border bg-white p-4 shadow-lg ${style.ring}`}
          >
            <span aria-hidden="true" className={`mt-0.5 shrink-0 ${style.tint}`}>
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words text-sm text-gray-800">
                {toast.message}
              </p>
              {toast.link && (
                <a
                  href={toast.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                >
                  {toast.linkLabel ?? 'Open'}
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
