import { useEffect, useMemo, useRef, useState } from "react";
import { DISCIPLINES } from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";

const ITEM_COLORS = {
  wrestling: "#E64A19",
  boxing: "#1565C0",
  robotics: "#6A1B9A",
};

const LOOPS = 14;
const SPIN_MS = 4200;
const SETTLE_MS = 900;

function buildStrip(chosenId) {
  const items = [];
  for (let loop = 0; loop < LOOPS; loop += 1) {
    for (const disc of DISCIPLINES) {
      items.push({
        key: `${loop}-${disc.id}`,
        disc,
        win: loop === LOOPS - 3 && disc.id === chosenId,
      });
    }
  }
  return items;
}

/**
 * CS-style horizontal case spinner that lands on the pre-chosen discipline.
 * @param {{ disc: object, onDone: () => void, reducedMotion?: boolean, autoSpin?: boolean }} props
 */
export function DisciplineWheel({ disc, onDone, reducedMotion = false, autoSpin = true }) {
  const strip = useMemo(() => buildStrip(disc.id), [disc.id]);
  const targetIdx = useMemo(
    () => strip.findIndex((item) => item.win),
    [strip],
  );

  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const doneRef = useRef(onDone);
  const startedRef = useRef(false);
  doneRef.current = onDone;

  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const measureTargetOffset = () => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return 0;
    const item = track.children[targetIdx];
    if (!item) return 0;
    const itemCenter = item.offsetLeft + item.offsetWidth / 2;
    return Math.round(itemCenter - viewport.clientWidth / 2);
  };

  const spin = () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const finalOffset = measureTargetOffset();
    if (reducedMotion) {
      setOffset(finalOffset);
      setLanded(true);
      setTimeout(() => doneRef.current?.(), 400);
      return;
    }

    setOffset(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinning(true);
        setOffset(finalOffset);
      });
    });
  };

  useEffect(() => {
    if (!autoSpin) return undefined;
    const id = setTimeout(spin, 280);
    return () => clearTimeout(id);
  }, [autoSpin]);

  useEffect(() => {
    if (!spinning) return undefined;
    const id = setTimeout(() => {
      setSpinning(false);
      setLanded(true);
      setTimeout(() => doneRef.current?.(), SETTLE_MS);
    }, SPIN_MS);
    return () => clearTimeout(id);
  }, [spinning]);

  return (
    <div className="disc-case">
      <div className="disc-case__label">Открываем кейс дисциплины…</div>

      <div className="disc-case__shell">
        <div className="disc-case__glow" aria-hidden="true" />
        <div className="disc-case__marker" aria-hidden="true">
          <span />
        </div>
        <div className="disc-case__fade disc-case__fade--left" aria-hidden="true" />
        <div className="disc-case__fade disc-case__fade--right" aria-hidden="true" />

        <div ref={viewportRef} className="disc-case__viewport">
          <div
            ref={trackRef}
            className={`disc-case__track${spinning ? " is-spinning" : ""}${landed ? " is-landed" : ""}`}
            style={{
              transform: `translate3d(${-offset}px, 0, 0)`,
              transitionDuration: spinning ? `${SPIN_MS}ms` : "0ms",
            }}
          >
            {strip.map((item, idx) => {
              const active = landed && idx === targetIdx;
              const dim = landed && idx !== targetIdx;
              return (
                <div
                  key={item.key}
                  className={`disc-case__item${active ? " is-win" : ""}${dim ? " is-dim" : ""}`}
                  style={{ "--item-color": ITEM_COLORS[item.disc.id] || "#2E5EFF" }}
                >
                  <span className="disc-case__item-ico">
                    <Icon name={item.disc.icon} size={22} />
                  </span>
                  <strong>{item.disc.name}</strong>
                  <small>{item.disc.statName}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {landed && (
        <div className="disc-case__result" role="status" aria-live="polite">
          <Icon name={disc.icon} size={20} color="var(--gold)" />
          <div className="disc-case__result-body">
            <b>{disc.name}</b>
            <span className="muted">{disc.tagline}</span>
          </div>
        </div>
      )}
    </div>
  );
}
