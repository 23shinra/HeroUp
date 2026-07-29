import { useEffect, useRef, useState } from "react";
import { GAME } from "@domain/game-data";
import { DISCIPLINES, effectiveStats, sportMeta, sportSpriteSrc, assetUrl } from "@domain/game-engine";
import { icon } from "@domain/icons";
import { Icon } from "../../components/Icon.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { escapeHtml } from "../../lib/format.js";
import {
  BATTLE_FRAMES,
  contactFrameOffset,
  durationForAnim,
  pickAttackVariant,
  skillBattleSheet,
  sportAttackSheets,
} from "./battleAnim.js";
import {
  BATTLE_FX,
  SKILL_FX_SET,
  equippedFxMeta,
  resolveOppSportId,
  arenaOutcomeSprite,
  turnHudStatus,
} from "./battleHelpers.js";

function floatDamage(fighterEl, dmg, crit, color, outgoing = false) {
  const ava = fighterEl?.querySelector(".fighter__ava");
  if (!ava) return;
  const el = document.createElement("span");
  el.className = `dmg-float${crit ? " dmg-float--crit" : ""}${outgoing && !crit ? " dmg-float--out" : ""}`;
  if (!crit && color) el.style.setProperty("--dmg-color", color);
  else if (!crit && outgoing) el.style.setProperty("--dmg-color", "#FF9A3C");
  el.textContent = `-${dmg}`;
  ava.appendChild(el);
  setTimeout(() => el.remove(), 980);
}

function floatFx(fighterEl, iconName, label, variant, color, glow) {
  const ava = fighterEl?.querySelector(".fighter__ava");
  if (!ava) return;
  const el = document.createElement("span");
  el.className = `fx-float fx-float--${variant}`;
  if (color) el.style.setProperty("--fx-color", color);
  if (glow) el.style.setProperty("--fx-glow", glow);
  el.innerHTML = `${icon(iconName, 26)}<span class="fx-float__lbl">${label}</span>`;
  ava.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function floatCosmeticHit(targetEl, fxItem) {
  const ava = targetEl?.querySelector(".fighter__ava");
  if (!ava || !fxItem) return;
  const el = document.createElement("span");
  el.className = "cosmetic-hit";
  el.style.setProperty("--hit-color", fxItem.color || "#FFC93C");
  el.innerHTML = icon(fxItem.icon, 18, fxItem.color || "#FFC93C");
  ava.appendChild(el);
  setTimeout(() => el.remove(), 520);
}

function FighterVisual({
  side,
  idleSrc,
  anim,
  outcomeMod = "",
  enemy = false,
  fxStyle,
  fallbackIcon,
  alt,
}) {
  const playing = !!(anim?.sheet && anim?.playing);
  return (
    <div
      className={`fighter__ava${fxStyle ? " fighter__ava--fx" : ""}${playing ? " is-anim" : ""}`}
      style={fxStyle || undefined}
    >
      {playing ? (
        <div
          key={anim.key}
          className={`battle-sheet is-playing${enemy ? " battle-sheet--enemy" : ""}`}
          style={{
            backgroundImage: `url("${anim.sheet}")`,
            animationDuration: `${anim.duration}ms`,
          }}
          role="img"
          aria-label={alt}
        />
      ) : idleSrc ? (
        <img
          className={`sprite-fighter${enemy ? " sprite-fighter--enemy" : ""}${outcomeMod}`}
          src={idleSrc}
          alt={alt}
        />
      ) : (
        <Icon name={fallbackIcon || "skull"} size={64} />
      )}
    </div>
  );
}

/**
 * Full arena with frame-sheet combat playback.
 */
export function BattleArena({ hero, battleState, autoStart = false, onFinished, onContinue }) {
  const r = battleState.result;
  const opp = battleState.opp;
  const disc = battleState.disc;
  const myFx = equippedFxMeta(hero);
  const sport = sportMeta(hero.sport);
  const oppSportId = resolveOppSportId(opp) || opp.sport;
  const oppSport = sportMeta(oppSportId) || sportMeta(opp.sport);

  const arenaRef = useRef(null);
  const pRef = useRef(null);
  const eRef = useRef(null);
  const timersRef = useRef([]);
  const startedRef = useRef(false);
  const lastAtkP = useRef(-1);
  const lastAtkE = useRef(-1);
  const animKeyRef = useRef(0);

  const [engaged, setEngaged] = useState(false);
  const [rouletteOn, setRouletteOn] = useState(-1);
  const [rouletteWin, setRouletteWin] = useState(false);
  const [showRoulette, setShowRoulette] = useState(true);
  const [banner, setBanner] = useState(null);
  const [btnLabel, setBtnLabel] = useState("В бой!");
  const [btnHidden, setBtnHidden] = useState(false);
  const [btnContinue, setBtnContinue] = useState(false);
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [hideStats, setHideStats] = useState(false);
  const [pHP, setPHP] = useState(r.pMax);
  const [eHP, setEHP] = useState(r.eMax);
  const [turnHud, setTurnHud] = useState(null);
  const [arenaMods, setArenaMods] = useState("");
  const [pIdle, setPIdle] = useState(sportSpriteSrc(sport));
  const [eIdle, setEIdle] = useState(assetUrl(opp.sprite) || sportSpriteSrc(oppSport));
  const [pTag, setPTag] = useState(hero.name);
  const [eTag, setETag] = useState(opp.name);
  const [pSpriteMod, setPSpriteMod] = useState("");
  const [eSpriteMod, setESpriteMod] = useState("");
  const [pAnim, setPAnim] = useState(null);
  const [eAnim, setEAnim] = useState(null);
  const [pStriking, setPStriking] = useState(false);
  const [eStriking, setEStriking] = useState(false);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  useEffect(() => () => clearTimers(), []);

  const showDisciplineBanner = () => {
    const d = disc;
    if (!d) return;
    const hv = effectiveStats(hero)[d.stat];
    const ev = (opp.stats || {})[d.stat];
    let edge;
    if (hv > ev) edge = { color: "var(--green)", text: `Твоя ${d.statName.toLowerCase()} выше — преимущество!` };
    else if (hv < ev) edge = { color: "var(--red)", text: `У соперника ${d.statName.toLowerCase()} выше — будь осторожен!` };
    else edge = { color: null, text: "Силы равны — всё решит бой!" };
    setBanner({ disc: d, edge });
  };

  const applyBattleFx = (line) => {
    const cfg = BATTLE_FX[line.fx];
    if (!cfg) return;
    const el = line.side === "p" ? pRef.current : eRef.current;
    if (!el) return;
    floatFx(el, cfg.icon, cfg.label, cfg.variant, cfg.color, cfg.glow);
    if (line.fx === "ko") return;
    el.style.setProperty("--fx-color", cfg.color || "#3DD16F");
    el.style.setProperty("--fx-glow", cfg.glow || "rgba(61,209,111,0.6)");
    el.classList.add("fx-flash");
    schedule(() => el.classList.remove("fx-flash"), 650);
  };

  const resolveSheet = (line, actorSide) => {
    if (line.skillId) {
      const sheet = skillBattleSheet(line.skillId);
      if (sheet) {
        const kind = line.fx === "passive" ? "passive" : (line.anim || "skill");
        return { sheet, kind };
      }
    }
    const sportId = actorSide === "p" ? hero.sport : (oppSportId || opp.sport);
    const variants = sportAttackSheets(sportId);
    const lastRef = actorSide === "p" ? lastAtkP : lastAtkE;
    const pick = pickAttackVariant(variants, lastRef.current);
    lastRef.current = pick.idx;
    return { sheet: pick.sheet, kind: line.anim || "attack" };
  };

  const playSheetOn = (actorSide, sheet, kind) => {
    if (!sheet) return 0;
    const duration = durationForAnim(kind);
    animKeyRef.current += 1;
    const payload = { sheet, duration, playing: true, key: animKeyRef.current };
    const striking = kind !== "passive";
    if (actorSide === "p") {
      setPAnim(payload);
      setPStriking(striking);
    } else {
      setEAnim(payload);
      setEStriking(striking);
    }
    schedule(() => {
      if (actorSide === "p") setPStriking(false);
      else setEStriking(false);
    }, Math.min(duration, 560));
    schedule(() => {
      if (actorSide === "p") setPAnim(null);
      else setEAnim(null);
    }, duration + 20);
    return duration;
  };
  const playBattleAnimation = () => {
    setShowRoulette(false);
    setBanner(null);
    setHideStats(true);
    setBtnHidden(true);

    let i = 0;
    let turnNo = 0;
    const log = r.log || [];

    const step = () => {
      if (i >= log.length) {
        setTurnHud({ step: "Финиш", status: r.win ? "Победа!" : "Поражение", cls: "is-end" });
        setPAnim(null);
        setEAnim(null);
        schedule(() => {
          onFinished?.();
          setPHP(r.pHP);
          setEHP(r.eHP);
          const playerWon = !!r.win;
          setArenaMods(` battle-arena--outcome${playerWon ? " battle-arena--win" : " battle-arena--lose"}`);
          const pSrc = arenaOutcomeSprite(hero.sport, playerWon) || sportSpriteSrc(sport);
          const eSrc = arenaOutcomeSprite(oppSportId || opp.sport, !playerWon)
            || assetUrl(opp.sprite)
            || sportSpriteSrc(oppSport);
          if (pSrc) setPIdle(pSrc);
          if (eSrc) setEIdle(eSrc);
          setPSpriteMod(playerWon ? " sprite-fighter--up" : " sprite-fighter--down");
          setESpriteMod(playerWon ? " sprite-fighter--down" : " sprite-fighter--up");
          setPTag(playerWon ? `${hero.name} · Победа` : `${hero.name} · Поражение`);
          setETag(playerWon ? `${opp.name} · Поражение` : `${opp.name} · Победа`);
          setBtnContinue(true);
          setBtnHidden(false);
          setBtnDisabled(false);
          setBtnLabel("Продолжить");
        }, 420);
        return;
      }

      const line = log[i];
      const isSkillFx = !!(line.fx && SKILL_FX_SET.has(line.fx));
      if (line.dmg !== undefined || line.fx) {
        turnNo += 1;
        const info = turnHudStatus(line);
        setTurnHud({ step: `Ход ${turnNo}`, status: info.text, cls: info.cls, pulse: true });
      }

      const actorSide = line.actor || (line.side === "e" ? "p" : (line.fx === "dodge" || line.fx === "stun" || line.fx === "passive" ? "p" : "e"));
      const { sheet, kind } = resolveSheet(line, actorSide);
      const duration = sheet ? durationForAnim(kind) : (isSkillFx ? 520 : 280);
      const contactAt = sheet
        ? Math.round((contactFrameOffset(BATTLE_FRAMES) / BATTLE_FRAMES) * duration)
        : 40;

      if (sheet) {
        playSheetOn(actorSide, sheet, kind);
      }

      // Contact: HP + hit feedback
      schedule(() => {
        if (line.pHP !== undefined) {
          setPHP(line.pHP);
          setEHP(line.eHP);
        }
        const hit = line.side === "p" ? pRef.current : eRef.current;
        if (hit && line.dmg !== undefined) {
          hit.classList.add("shake");
          schedule(() => hit.classList.remove("shake"), 220);
          const outgoing = line.side === "e";
          const color = (myFx && outgoing) ? myFx.color : null;
          floatDamage(hit, line.dmg, line.crit, color, outgoing);
          if (myFx && outgoing) floatCosmeticHit(hit, myFx);
        }
        if (line.fx) {
          applyBattleFx(line);
          if (isSkillFx && arenaRef.current) {
            const arena = arenaRef.current;
            arena.classList.remove("battle-arena--focus");
            void arena.offsetWidth;
            arena.classList.add("battle-arena--focus");
            schedule(() => arena.classList.remove("battle-arena--focus"), 620);
          }
        }
      }, contactAt);

      i += 1;
      const gap = Math.max(80, duration - contactAt + (isSkillFx ? 120 : 60));
      schedule(step, contactAt + gap);
    };
    step();
  };

  const spinRoulette = (done) => {
    if (!disc) { done(); return; }
    const chosenIdx = DISCIPLINES.findIndex((d) => d.id === disc.id);
    if (chosenIdx < 0) { done(); return; }
    const total = 16 + chosenIdx;
    let i = 0;
    let delay = 60;
    const tick = () => {
      if (i >= total) {
        setRouletteOn(chosenIdx);
        setRouletteWin(true);
        showDisciplineBanner();
        schedule(done, 850);
        return;
      }
      setRouletteOn(i % DISCIPLINES.length);
      i += 1;
      if (i > total - 6) delay += 55;
      schedule(tick, delay);
    };
    tick();
  };

  const begin = () => {
    if (startedRef.current || battleState.rewards) return;
    startedRef.current = true;
    setEngaged(true);
    setBtnDisabled(true);
    setBtnLabel("Рулетка...");
    spinRoulette(() => {
      setBtnLabel("Сражение...");
      playBattleAnimation();
    });
  };

  useEffect(() => {
    if (autoStart && !startedRef.current) {
      schedule(begin, 280);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const pPct = r.pMax ? Math.round((Math.max(0, pHP) / r.pMax) * 100) : 100;
  const ePct = r.eMax ? Math.round((Math.max(0, eHP) / r.eMax) * 100) : 100;
  const ps = effectiveStats(hero);
  const es = opp.stats || {};
  const pFxStyle = myFx ? { "--myfx": myFx.color || "#FFC93C" } : undefined;

  return (
    <div className="battle-scene battle-scene--fight">
      <div className="battle-scene__bg" aria-hidden="true" />
      <div className="topbar battle-scene__top">
        <div className="topbar__title">
          <h1>Бой!</h1>
          <small>Рулетка решит дисциплину</small>
        </div>
        <div className="topbar__actions"><SyncBadge /></div>
      </div>

      {showRoulette && (
        <div className="disc-roulette">
          {DISCIPLINES.map((d, idx) => (
            <div
              key={d.id}
              className={`disc-opt${rouletteOn === idx ? " disc-opt--on" : ""}${rouletteWin && rouletteOn === idx ? " disc-opt--win" : ""}`}
            >
              <div className="disc-opt__ico"><Icon name={d.icon} size={24} /></div>
              <div className="disc-opt__name">{d.name}</div>
              <div className="disc-opt__tag">{d.tagline}</div>
            </div>
          ))}
        </div>
      )}

      {banner && (
        <div className="disc-banner disc-banner--in">
          <div className="disc-banner__top">
            <Icon name={banner.disc.icon} size={16} color="var(--orange)" /> Дисциплина: <b>{banner.disc.name}</b> — {banner.disc.tagline}
          </div>
          <div className="disc-banner__edge">
            <b style={banner.edge.color ? { color: banner.edge.color } : undefined}>{banner.edge.text}</b>
          </div>
        </div>
      )}

      <div
        ref={arenaRef}
        className={`battle-ring${engaged ? " battle-arena--engaged" : ""}${arenaMods}`}
      >
        <div className="battle-ring__hud">
          <div className="battle-hp battle-hp--p">
            <div className="battle-hp__name">{escapeHtml(hero.name)} · LVL {hero.level}</div>
            <div className="battle-hp__row">
              <div className="battle-hp__bar"><div className="fill" style={{ width: `${pPct}%` }} /></div>
              <div className="battle-hp__val">{Math.max(0, Math.round(pHP))} HP</div>
            </div>
          </div>
          {turnHud && (
            <div className={`battle-turn-hud${turnHud.cls ? ` ${turnHud.cls}` : ""}${turnHud.pulse ? " battle-turn-hud--pulse" : ""}`}>
              <span className="battle-turn-hud__step">{turnHud.step}</span>
              <span className="battle-turn-hud__sep">·</span>
              <span className="battle-turn-hud__status">{turnHud.status}</span>
            </div>
          )}
          <div className="battle-hp battle-hp--e">
            <div className="battle-hp__name">{escapeHtml(opp.name)} · LVL {opp.level}</div>
            <div className="battle-hp__row">
              <div className="battle-hp__bar battle-hp__bar--e"><div className="fill" style={{ width: `${ePct}%` }} /></div>
              <div className="battle-hp__val">{Math.max(0, Math.round(eHP))} HP</div>
            </div>
          </div>
        </div>

        <div className="battle-ring__floor">
          <div className={`fighter fighter--p${pStriking ? " is-striking" : ""}`} ref={pRef}>
            <FighterVisual
              side="p"
              idleSrc={pIdle}
              anim={pAnim}
              outcomeMod={pSpriteMod}
              fxStyle={pFxStyle}
              alt={hero.name}
            />
            <div className="fighter__shadow" aria-hidden="true" />
            <div className="fighter__tag">{escapeHtml(pTag)}</div>
          </div>
          <div className="vs" aria-hidden="true">VS</div>
          <div className={`fighter fighter--e${eStriking ? " is-striking" : ""}`} ref={eRef}>
            <FighterVisual
              side="e"
              idleSrc={eIdle}
              anim={eAnim}
              outcomeMod={eSpriteMod}
              enemy
              fallbackIcon={opp.avatar || "skull"}
              alt={opp.name}
            />
            <div className="fighter__shadow" aria-hidden="true" />
            <div className="fighter__tag">{escapeHtml(eTag)}</div>
          </div>
        </div>
      </div>

      {!btnHidden && (
        <button
          type="button"
          className={`btn btn--icon${btnContinue ? " btn--gold" : " btn--accent"}`}
          disabled={btnDisabled}
          onClick={() => (btnContinue ? onContinue?.() : begin())}
        >
          <Icon name={btnContinue ? "arrowR" : "swords"} size={18} /> {btnLabel}
        </button>
      )}

      {!hideStats && (
        <div className="battle-stats">
          <div className="battle-stats__head">
            <span className="battle-stats__name">{escapeHtml(hero.name)}</span>
            <span className="battle-stats__vs">характеристики</span>
            <span className="battle-stats__name battle-stats__name--e">{escapeHtml(opp.name)}</span>
          </div>
          {GAME.stats.map((s) => {
            const p = ps[s.id] || 0;
            const e = es[s.id] || 0;
            return (
              <div key={s.id} className="bstat">
                <span className={`bstat__val${p > e ? " bstat__val--win" : ""}`}>{p}</span>
                <span className="bstat__label"><Icon name={s.icon} size={13} color={s.color} /> {s.name}</span>
                <span className={`bstat__val bstat__val--e${e > p ? " bstat__val--win" : ""}`}>{e}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
