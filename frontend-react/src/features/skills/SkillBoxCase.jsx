import { useEffect, useMemo, useRef, useState } from "react";
import { rarityMeta, skillRarityId } from "@domain/loot";
import { Icon } from "../../components/Icon.jsx";

const LOOPS = 12;
const SPIN_MS = 4800;
const SETTLE_MS = 700;

function buildStrip(pool, winSkill) {
  const base = pool.length ? pool : [winSkill].filter(Boolean);
  if (!base.length) return [];
  const items = [];
  for (let loop = 0; loop < LOOPS; loop += 1) {
    for (const sk of base) {
      const win = loop === LOOPS - 3 && winSkill && sk.id === winSkill.id;
      items.push({
        key: `${loop}-${sk.id}-${items.length}`,
        skill: sk,
        win,
      });
    }
  }
  // Гарантируем выигрышный слот, даже если winSkill не в pool.
  if (winSkill) {
    const targetLoop = LOOPS - 3;
    const start = targetLoop * base.length;
    const idx = items.findIndex((it, i) => i >= start && it.skill.id === winSkill.id);
    if (idx < 0) {
      const slot = start + Math.floor(base.length / 2);
      items[slot] = { key: `win-${winSkill.id}`, skill: winSkill, win: true };
    } else {
      items.forEach((it, i) => { it.win = i === idx; });
    }
  }
  return items;
}

/**
 * CS-style горизонтальный спиннер кейса скиллов.
 * Результат уже известен с сервера — анимация только раскрывает его.
 */
export function SkillBoxCase({
  result,
  skills = [],
  onDone,
  reducedMotion = false,
  skipRequest = 0,
}) {
  const winSkill = useMemo(() => {
    if (!result) return null;
    const fromPool = skills.find((sk) => sk.id === result.skillId);
    if (fromPool) return fromPool;
    return {
      id: result.skillId || "drop",
      name: result.skillName || "Скилл",
      icon: "gift",
      rarity: result.rarity || "common",
      desc: result.duplicate ? "Дубликат" : "Новый скилл",
    };
  }, [result, skills]);

  const strip = useMemo(
    () => buildStrip(skills.length ? skills : [winSkill].filter(Boolean), winSkill),
    [skills, winSkill],
  );
  const targetIdx = useMemo(() => strip.findIndex((item) => item.win), [strip]);

  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const doneRef = useRef(onDone);
  const finishedRef = useRef(false);
  const timersRef = useRef([]);
  doneRef.current = onDone;

  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [phase, setPhase] = useState("ready"); // ready | spinning | reveal

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const measureTargetOffset = () => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return 0;
    const item = track.children[targetIdx];
    if (!item) return 0;
    const itemCenter = item.offsetLeft + item.offsetWidth / 2;
    return Math.round(itemCenter - viewport.clientWidth / 2);
  };

  const finish = (delay = SETTLE_MS) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    const id = setTimeout(() => doneRef.current?.(), delay);
    timersRef.current.push(id);
  };

  const landNow = (settleMs = SETTLE_MS) => {
    const finalOffset = measureTargetOffset();
    setSpinning(false);
    setOffset(finalOffset);
    setLanded(true);
    setPhase("reveal");
    finish(settleMs);
  };

  const skip = () => {
    clearTimers();
    if (landed || finishedRef.current) {
      finishedRef.current = true;
      doneRef.current?.();
      return;
    }
    landNow(0);
  };

  const spin = () => {
    if (finishedRef.current || phase !== "ready") return;
    if (reducedMotion || targetIdx < 0) {
      landNow(280);
      return;
    }
    setPhase("spinning");
    setOffset(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinning(true);
        setOffset(measureTargetOffset());
      });
    });
    const id = setTimeout(() => landNow(SETTLE_MS), SPIN_MS);
    timersRef.current.push(id);
  };

  useEffect(() => {
    const id = setTimeout(spin, 320);
    timersRef.current.push(id);
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipRequest > 0) skip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipRequest]);

  const rar = rarityMeta(result?.rarity || skillRarityId(winSkill));

  return (
    <div className="skill-case" style={{ "--rar-color": rar.color }}>
      <div className="skill-case__top">
        <div className="skill-case__label">
          {phase === "reveal" ? "Выпало!" : "Открываем кейс…"}
        </div>
        {phase !== "reveal" ? (
          <button type="button" className="skill-case__skip" onClick={skip}>
            Пропустить
          </button>
        ) : null}
      </div>

      <div className={`skill-case__shell${phase === "ready" ? " is-shake" : ""}${landed ? " is-open" : ""}`}>
        <div className="skill-case__glow" aria-hidden="true" />
        <div className="skill-case__lid" aria-hidden="true" />
        <div className="skill-case__marker" aria-hidden="true">
          <span />
        </div>
        <div className="skill-case__fade skill-case__fade--left" aria-hidden="true" />
        <div className="skill-case__fade skill-case__fade--right" aria-hidden="true" />

        <div ref={viewportRef} className="skill-case__viewport">
          <div
            ref={trackRef}
            className={`skill-case__track${spinning ? " is-spinning" : ""}${landed ? " is-landed" : ""}`}
            style={{
              transform: `translate3d(${-offset}px, 0, 0)`,
              transitionDuration: spinning ? `${SPIN_MS}ms` : "0ms",
            }}
          >
            {strip.map((item, idx) => {
              const itemRar = rarityMeta(skillRarityId(item.skill));
              const active = landed && idx === targetIdx;
              const dim = landed && idx !== targetIdx;
              return (
                <div
                  key={item.key}
                  className={`skill-case__item${active ? " is-win" : ""}${dim ? " is-dim" : ""}`}
                  style={{ "--item-color": itemRar.color }}
                >
                  <span className="skill-case__item-ico">
                    <Icon name={item.skill.icon || "gift"} size={20} color={itemRar.color} />
                  </span>
                  <strong>{item.skill.name}</strong>
                  <small style={{ color: itemRar.color }}>{itemRar.name}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {landed && winSkill ? (
        <div className="skill-case__result" role="status" aria-live="polite">
          <span className="skill-case__result-ico">
            <Icon name={winSkill.icon || "gift"} size={26} color={rar.color} />
          </span>
          <div className="skill-case__result-body">
            <small style={{ color: rar.color }}>{rar.name}</small>
            <b>{winSkill.name}</b>
            <span className="muted">
              {result?.duplicate
                ? `Дубликат · +${result.tokensRefund || 0} ток.`
                : (winSkill.desc || "Новый скилл в инвентаре")}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
