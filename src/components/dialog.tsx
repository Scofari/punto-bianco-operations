'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-header">
        <div>
          <span className="eyebrow">PUNTO BIANCO</span>
          <h2 id="dialog-title">{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Închide">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
