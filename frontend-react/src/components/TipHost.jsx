import { useEffect } from "react";

/**
 * Global data-tip popovers (parity with vanilla tip-pop).
 * Elements with [data-tip] get hover/click tooltips.
 */
export function TipHost() {
  useEffect(() => {
    let tipEl = null;

    const ensure = () => {
      if (!tipEl) {
        tipEl = document.createElement("div");
        tipEl.className = "tip-pop";
        document.body.appendChild(tipEl);
      }
      return tipEl;
    };

    const showTip = (target) => {
      const text = target.getAttribute("data-tip");
      if (!text) return;
      const el = ensure();
      el.textContent = text;
      el.style.display = "block";
      const r = target.getBoundingClientRect();
      const tw = el.offsetWidth;
      const th = el.offsetHeight;
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
      let top = r.top - th - 10;
      if (top < 8) top = r.bottom + 10;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      requestAnimationFrame(() => tipEl?.classList.add("tip-pop--in"));
    };

    const hideTip = () => {
      if (!tipEl) return;
      tipEl.classList.remove("tip-pop--in");
      tipEl.style.display = "none";
    };

    const onOver = (e) => {
      const t = e.target.closest?.("[data-tip]");
      if (t) showTip(t);
    };
    const onOut = (e) => {
      const t = e.target.closest?.("[data-tip]");
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hideTip();
    };
    const onClick = (e) => {
      const target = e.target.closest?.("[data-tip]");
      if (!target) {
        hideTip();
        return;
      }
      // Не перехватываем клики по кнопкам/ссылкам — у них свой обработчик (модалки и т.п.).
      const tag = target.tagName;
      if (tag === "BUTTON" || tag === "A" || target.getAttribute("role") === "button") {
        hideTip();
        return;
      }
      if (tipEl && tipEl.style.display === "block") hideTip();
      else showTip(target);
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("click", onClick);
      tipEl?.remove();
      tipEl = null;
    };
  }, []);

  return null;
}
