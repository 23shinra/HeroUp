import { useEffect, useState } from "react";
import { xpToNext } from "@domain/game-data";
import { Icon } from "./Icon.jsx";
import { Modal } from "./Modal.jsx";

export function xpTipText(hero) {
  const need = xpToNext(hero.level);
  const left = Math.max(0, need - (hero.xp || 0));
  return `До ${hero.level + 1} уровня: ${left} XP (сейчас ${hero.xp || 0} / ${need})`;
}

export function XpModal({ hero, open, onClose }) {
  const [barW, setBarW] = useState(0);
  const need = xpToNext(hero.level);
  const xp = hero.xp || 0;
  const pct = Math.round((xp / need) * 100);
  const left = Math.max(0, need - xp);

  useEffect(() => {
    if (!open) {
      setBarW(0);
      return undefined;
    }
    const id = requestAnimationFrame(() => setBarW(pct));
    return () => cancelAnimationFrame(id);
  }, [open, pct]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<><Icon name="star" size={18} color="var(--gold)" /> Уровень {hero.level}</>}
    >
      <div className="row between small" style={{ marginBottom: 6 }}>
        <span>Опыт</span>
        <span>{xp} / {need} XP</span>
      </div>
      <div className="bar bar--xp">
        <div className="bar__fill" style={{ width: `${barW}%` }} />
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        До {hero.level + 1} уровня осталось <b>{left} XP</b>. Опыт даётся за тренировки и победы в боях.
      </p>
    </Modal>
  );
}

export function LevelRingButton({
  hero,
  className = "",
  "aria-label": ariaLabel = "Опыт",
  onOpen,
  as = "button",
}) {
  const [open, setOpen] = useState(false);
  const need = Math.max(1, xpToNext(hero?.level || 1));
  const xp = Math.max(0, Number(hero?.xp) || 0);
  const pct = Math.max(0, Math.min(100, Math.round((xp / need) * 100)));
  const tip = xpTipText(hero || { level: 1, xp: 0 });
  const showModal = onOpen ? false : open;
  const Tag = as === "span" ? "span" : "button";

  const openXp = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (onOpen) onOpen();
    else setOpen(true);
  };

  return (
    <>
      <Tag
        {...(Tag === "button" ? { type: "button" } : { role: "img", "aria-hidden": true })}
        className={`level-ring level-ring--btn ${className}`.trim()}
        style={{ "--pct": pct }}
        {...(Tag === "button"
          ? {
              "data-tip": tip,
              "aria-label": ariaLabel,
              onClick: openXp,
              onPointerUp: (e) => e.stopPropagation(),
            }
          : {})}
      >
        <div className="level-ring__inner">
          <span className="level-ring__lvl">{hero?.level ?? 1}</span>
          <span className="level-ring__lbl">LVL</span>
        </div>
      </Tag>

      <XpModal hero={hero || { level: 1, xp: 0 }} open={showModal} onClose={() => setOpen(false)} />
    </>
  );
}
