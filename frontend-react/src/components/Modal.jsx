import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";

export function Modal({ open, onClose, title, children, sheetClass = "", modalClass = "" }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => sheetRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={`modal ${modalClass}`.trim()} role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`modal__sheet ${sheetClass}`.trim()} tabIndex={-1} ref={sheetRef}>
        {(title || onClose) && (
          <div className="modal__head">
            {title ? <h2 className="row" style={{ gap: 8, margin: 0, fontSize: 18 }}>{title}</h2> : <span />}
            {onClose && (
              <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
