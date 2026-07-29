import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GAME } from "@domain/game-data";
import { pick, sportMeta, sportSpriteSrc, assetUrl } from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rollCandidate(heroLevel) {
  const sport = pick(GAME.sports);
  return {
    name: pick(GAME.botNames),
    avatar: pick(GAME.botAvatars),
    sport: sport.id,
    level: clamp(heroLevel + Math.floor(Math.random() * 5) - 2, 1, 99),
  };
}

/**
 * Vanilla playMatchmaking: roulette of candidates, then lock on real opponent and auto-proceed.
 */
export function MatchmakingOverlay({ opp, heroLevel = 1, onDone }) {
  const [title, setTitle] = useState("Поиск соперника…");
  const [shown, setShown] = useState(() => rollCandidate(heroLevel));
  const [found, setFound] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let ticks = 0;
    let delay = 55;
    const total = 18;
    let timer;

    const tick = () => {
      if (cancelled) return;
      if (ticks >= total) {
        setShown({
          name: opp.name,
          sport: opp.sport,
          level: opp.level,
          power: opp.power,
          sprite: opp.sprite,
        });
        setTitle("Соперник найден!");
        setFound(true);
        timer = setTimeout(() => {
          if (!cancelled) onDoneRef.current?.();
        }, 700);
        return;
      }
      setShown(rollCandidate(heroLevel));
      ticks += 1;
      if (ticks > total - 6) delay += 50;
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [opp, heroLevel]);

  const sport = sportMeta(shown.sport);
  const sprite = shown.sprite ? assetUrl(shown.sprite) : sportSpriteSrc(sport);

  return createPortal(
    <div className="modal mm-overlay" id="mmOverlay">
      <div className="modal__backdrop" aria-hidden="true" />
      <div className={`mm-card${found ? " mm-card--found" : ""}`}>
        <div className="mm-title">{title}</div>
        <div className="mm-avatar">
          {sprite ? (
            <img className="sprite-fighter" src={sprite} alt={sport?.name || ""} style={{ height: 72 }} />
          ) : (
            <Icon name="search" size={60} />
          )}
        </div>
        <div className="mm-name">{shown.name || "—"}</div>
        <div className="mm-sub small muted">
          {sport && (
            <span className="row" style={{ justifyContent: "center", gap: 5 }}>
              <Icon name={sport.icon} size={14} /> {sport.name}
            </span>
          )}
          <span style={{ opacity: 0.8 }}>
            LVL {shown.level}{found && shown.power != null ? ` · Сила ${shown.power}` : ""}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
