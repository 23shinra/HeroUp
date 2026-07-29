import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CAMPAIGN_LEVELS } from "@domain/game-data";
import {
  currentStage,
  isMilestoneStage,
  stageNodePos,
  stageOpponent,
  STAGE_ROAD,
} from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { escapeHtml } from "../../lib/format.js";
import { useGameStore } from "../../stores/useGameStore.js";

function roadPoints(list) {
  return list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

export default function MapPage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const setBattleState = useGameStore((s) => s.setBattleState);
  const setBattlePhase = useGameStore((s) => s.setBattlePhase);
  const h = S.hero;
  const guild = S.guild;
  const cleared = h.stagesCleared || [];
  const cur = currentStage(cleared);
  const clearedCount = Math.min(cleared.length, CAMPAIGN_LEVELS);
  const scrollRef = useRef(null);
  const currentPinRef = useRef(null);

  const progEnd = Math.min(Math.max(cur > CAMPAIGN_LEVELS ? CAMPAIGN_LEVELS : cur, 1), CAMPAIGN_LEVELS);
  const trackPts = roadPoints(STAGE_ROAD);
  const progPts = roadPoints(STAGE_ROAD.slice(0, progEnd));

  const progressText = cur > CAMPAIGN_LEVELS
    ? "Все этапы пройдены!"
    : `Пройдено ${clearedCount} из ${CAMPAIGN_LEVELS}`;

  const startStage = (n) => {
    if (cleared.includes(n) || n !== cur) return;
    const opp = stageOpponent(n);
    setBattleState({ opp, stage: n, mapMode: true });
    setBattlePhase("intro");
    navigate("/battle");
  };

  useEffect(() => {
    const pin = currentPinRef.current;
    const scroller = scrollRef.current;
    if (!pin || !scroller) return undefined;
    const frame = requestAnimationFrame(() => {
      const pinRect = pin.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const pinCenter = pinRect.top + pinRect.height / 2 - scrollerRect.top + scroller.scrollTop;
      const target = Math.max(0, pinCenter - scrollerRect.height * 0.58);
      scroller.scrollTo({ top: target, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [cur]);

  return (
    <div className="map-scene">
      <div className="topbar map-scene__top">
        <div className="topbar__title">
          <h1>Карта боёв</h1>
          <small className="row" style={{ gap: 5 }}>
            <Icon name="swords" size={14} color="var(--orange)" /> {progressText}
          </small>
        </div>
        <div className="topbar__actions">
          <SyncBadge />
          <span className="chip" style={{ cursor: "pointer" }} onClick={() => navigate("/clan")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate("/clan")}>
            {guild ? (
              <><Icon name="flag" size={15} color="var(--gold)" /> {escapeHtml(guild.name)}</>
            ) : (
              <><Icon name="flag" size={15} /> Гильдия</>
            )}
          </span>
        </div>
      </div>

      <div className="map-scroll" ref={scrollRef}>
        <div className="map">
          <div className="map__stack" aria-hidden="true">
            <div className="map__art map__art--upper" />
            <div className="map__art map__art--lower" />
            <div className="map__seam" />
            <div className="map__shade" />
          </div>
          <svg className="map__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="mapgrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#FF7A00" />
                <stop offset="1" stopColor="#FFC93C" />
              </linearGradient>
              <linearGradient id="maptrack" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
              </linearGradient>
            </defs>
            <polyline className="map__track" points={trackPts} fill="none" stroke="url(#maptrack)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {progEnd > 1 && (
              <polyline className="map__progress" points={progPts} fill="none" stroke="url(#mapgrad)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
          </svg>

          {Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1).map((n) => {
            const done = cleared.includes(n);
            const status = done ? "done" : n === cur ? "current" : "locked";
            const opp = stageOpponent(n);
            const { x, y } = stageNodePos(n);
            const milestone = isMilestoneStage(n);
            const side = x < 50 ? "right" : "left";
            const isCurrent = status === "current";
            const labelPlacement = y < 14 ? "below" : "above";
            return (
              <div
                key={n}
                ref={isCurrent ? currentPinRef : null}
                className={`map-pin-wrap map-pin-wrap--${status}${milestone ? " map-pin-wrap--boss" : ""}`}
                style={{ left: `${x.toFixed(2)}%`, top: `${y.toFixed(2)}%` }}
              >
                <button
                  type="button"
                  className={`map-pin map-pin--${status}${milestone ? " map-pin--boss" : ""}`}
                  aria-label={`Этап ${n}`}
                  disabled={status === "locked"}
                  onClick={() => startStage(n)}
                >
                  <span className="map-pin__face">
                    {done
                      ? <Icon name="check" size={milestone ? 22 : 18} />
                      : status === "locked"
                        ? (milestone ? <Icon name="crown" size={16} /> : <Icon name="lock" size={14} />)
                        : <span className="map-pin__num">{n}</span>}
                  </span>
                  <span className="map-pin__tip" aria-hidden="true" />
                </button>
                {isCurrent && (
                  <div className={`map-pin__label map-pin__label--${side} map-pin__label--${labelPlacement}`}>
                    <div className="map-pin__label-head">
                      <span className="map-pin__label-title">Этап {n}{milestone ? " · Босс" : ""}</span>
                      <span className="map-pin__label-lvl">ур.{opp.level}</span>
                    </div>
                    <div className="map-pin__label-desc">
                      <Icon name="swords" size={12} /><span>{opp.name}</span>
                    </div>
                    <button type="button" className="map-pin__cta" onClick={() => startStage(n)}>
                      В бой
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
