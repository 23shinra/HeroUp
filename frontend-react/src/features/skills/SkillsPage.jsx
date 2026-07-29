import { useMemo, useState } from "react";
import { GAME, CLASS_FEATURE_ENABLED } from "@domain/game-data";
import { sportMeta, sportSkills, classMeta, effectiveStats, sportSpriteSrc } from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";
import { LevelRingButton, XpModal, xpTipText } from "../../components/LevelRingButton.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { useGameStore } from "../../stores/useGameStore.js";
import { CameraWorkoutEntry } from "./CameraWorkoutEntry.jsx";

const SKILLS_HUD_OPEN_KEY = "skillsHudOpen";

function writeHudOpen(open) {
  try {
    sessionStorage.setItem(SKILLS_HUD_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export default function SkillsPage() {
  const S = useGameStore((s) => s.S);
  const setS = useGameStore((s) => s.setS);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const h = S.hero;
  const [hudOpen, setHudOpen] = useState(() => {
    try {
      const v = sessionStorage.getItem(SKILLS_HUD_OPEN_KEY);
      if (v === null) return true;
      return v !== "0";
    } catch {
      return true;
    }
  });
  const [statDraft, setStatDraft] = useState({});
  const [xpOpen, setXpOpen] = useState(false);

  const skills = sportSkills(h.sport);
  const unlocked = skills.filter((sk) => h.level >= sk.req);
  const locked = skills.filter((sk) => h.level < sk.req);
  const loadout = h.loadout || [];
  const cls = classMeta(h.class);
  const sport = sportMeta(h.sport);
  const bgMod = h.sport === "robotics" ? " skills-room__bg--robotics" : "";
  const pts = h.statPoints || 0;
  const used = useMemo(
    () => Object.values(statDraft).reduce((a, b) => a + (Number(b) || 0), 0),
    [statDraft],
  );
  const remaining = pts - used;

  const draftedHero = useMemo(() => {
    const stats = { ...h.stats };
    Object.keys(statDraft).forEach((k) => {
      stats[k] = (stats[k] || 0) + (statDraft[k] || 0);
    });
    return { ...h, stats };
  }, [h, statDraft]);

  const es = useMemo(() => effectiveStats(draftedHero), [draftedHero]);
  const baseEs = useMemo(() => effectiveStats(h), [h]);
  const max = Math.max(30, ...Object.values(baseEs), ...Object.values(es));
  const trainingSrc = sportSpriteSrc(sport, { training: true });
  const idleSrc = sportSpriteSrc(sport);

  const setHud = (open) => {
    writeHudOpen(open);
    setHudOpen(open);
  };

  const applyStatDelta = (id, delta) => {
    setStatDraft((prev) => {
      const next = { ...prev };
      if (delta > 0) {
        const usedNow = Object.values(next).reduce((a, b) => a + (Number(b) || 0), 0);
        if (usedNow >= pts) return prev;
        next[id] = (next[id] || 0) + 1;
      } else {
        if ((next[id] || 0) <= 0) return prev;
        next[id] -= 1;
        if (!next[id]) delete next[id];
      }
      return next;
    });
  };

  const confirmDraft = () => {
    if (used <= 0) return;
    setS((prev) => {
      const stats = { ...prev.hero.stats };
      Object.keys(statDraft).forEach((id) => {
        stats[id] = (stats[id] || 0) + (statDraft[id] || 0);
      });
      return {
        ...prev,
        hero: {
          ...prev.hero,
          stats,
          statPoints: Math.max(0, (prev.hero.statPoints || 0) - used),
        },
      };
    });
    setStatDraft({});
    toastMsg(`Характеристики прокачаны (+${used})`);
  };

  const toggleSkill = (id) => {
    const loadoutNow = useGameStore.getState().S?.hero?.loadout || [];
    const idx = loadoutNow.indexOf(id);
    if (idx < 0 && loadoutNow.length >= 3) {
      toastMsg("Максимум 3 скилла");
      return;
    }
    setS((prev) => {
      const nextLoadout = [...(prev.hero.loadout || [])];
      const at = nextLoadout.indexOf(id);
      if (at >= 0) nextLoadout.splice(at, 1);
      else if (nextLoadout.length >= 3) return prev;
      else nextLoadout.push(id);
      return { ...prev, hero: { ...prev.hero, loadout: nextLoadout } };
    });
  };

  return (
    <div className="skills-room">
      <div className={`skills-room__bg${bgMod}`} aria-hidden="true" />
      <div className="skills-room__top">
        <h1 className="skills-room__title">Тренировка</h1>
        <div className="topbar__actions">
          <SyncBadge />
          {CLASS_FEATURE_ENABLED && cls && (
            <button type="button" className="icon-btn skills-room__class" aria-label="Класс">
              <Icon name={cls.icon} size={18} color="var(--gold)" />
            </button>
          )}
        </div>
      </div>

      <div className="skills-room__identity">
        <button
          type="button"
          className="skills-stage__badge skills-stage__badge--btn"
          data-tip={xpTipText(h)}
          aria-label="Опыт"
          onClick={() => setXpOpen(true)}
        >
          <LevelRingButton hero={h} className="skills-stage__lvl" as="span" onOpen={() => setXpOpen(true)} />
          <div className="skills-stage__who">
            <div className="skills-stage__name">{h.name}</div>
            <div className="skills-stage__meta">
              <Icon name={sport?.icon || "user"} size={13} /> {sport?.name || "Секция"}
              {CLASS_FEATURE_ENABLED && cls ? ` · ${cls.name}` : ""}
            </div>
          </div>
        </button>
        <XpModal hero={h} open={xpOpen} onClose={() => setXpOpen(false)} />
      </div>

      <div className="skills-camera-row">
        <CameraWorkoutEntry />
      </div>

      <div className="skills-room__stage" id="statsGrid">
        <div className="skills-stage">
          <div className="skills-stage__hero">
            {trainingSrc && (
              <img
                className="skills-stage__sprite skills-stage__sprite--training"
                src={trainingSrc}
                alt={sport?.name || ""}
                onError={(e) => {
                  const el = e.currentTarget;
                  if (idleSrc && el.src !== idleSrc) {
                    el.src = idleSrc;
                    el.classList.remove("skills-stage__sprite--training");
                  }
                }}
              />
            )}
          </div>

          <aside
            className={`skills-hud-drawer ${hudOpen ? "is-open" : "is-closed"}`}
            id="skillsHudDrawer"
          >
            <button
              type="button"
              className="skills-hud-drawer__handle"
              aria-expanded={hudOpen}
              aria-controls="skillsHud"
              aria-label={hudOpen ? "Скрыть характеристики" : "Показать характеристики"}
              onClick={() => setHud(!hudOpen)}
            >
              <span className="skills-hud-drawer__ico">
                <Icon name={hudOpen ? "arrowR" : "arrowL"} size={12} />
              </span>
            </button>

            <div className="skills-hud-rail" data-hud-rail>
              {GAME.stats.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="skills-hud-rail__btn"
                  aria-label={`${s.name}: ${es[s.id]}`}
                  onClick={() => setHud(true)}
                >
                  <span className="skills-hud-rail__ico" style={{ color: s.color }}>
                    <Icon name={s.icon} size={16} color={s.color} />
                  </span>
                  <span className="skills-hud-rail__val">{es[s.id]}</span>
                </button>
              ))}
            </div>

            <div className="skills-hud" id="skillsHud">
              {GAME.stats.map((s) => {
                const add = statDraft[s.id] || 0;
                const barPct = clamp(Math.round((es[s.id] / max) * 100), 0, 100);
                return (
                  <div key={s.id} className="skills-hud__row">
                    <div className="skills-hud__head">
                      <span className="skills-hud__ico" style={{ color: s.color }}>
                        <Icon name={s.icon} size={14} color={s.color} />
                      </span>
                      <span className="skills-hud__name">{s.name}</span>
                      <span className="skills-hud__val">
                        {es[s.id]}
                        {add ? <i className="stat__add">+{add}</i> : null}
                      </span>
                      {pts > 0 ? (
                        <span className="skills-hud__ctrl">
                          <button
                            type="button"
                            className="stat__step"
                            disabled={add <= 0}
                            aria-label="Убрать очко"
                            onClick={() => applyStatDelta(s.id, -1)}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="stat__step"
                            disabled={remaining <= 0}
                            aria-label="Добавить очко"
                            onClick={() => applyStatDelta(s.id, 1)}
                          >
                            +
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <div className="skills-hud__bar">
                      <i style={{ width: `${barPct}%`, background: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <div className="skills-float-slot" id="allocInfo">
          {pts > 0 ? (
            <div className="skills-float skills-float--alloc">
              <Icon name="sparkles" size={14} color="var(--gold)" /> Очки: <b>{remaining}</b>
              {used ? ` · +${used}` : ""}
            </div>
          ) : null}
        </div>
        <div className="skills-float-slot" id="statActions">
          {used > 0 ? (
            <div className="skills-float skills-float--actions">
              <button type="button" className="btn btn--sm btn--icon" onClick={confirmDraft}>
                <Icon name="check" size={16} /> Готово (+{used})
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatDraft({})}>
                Сброс
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="skills-dock">
        <div className="skills-dock__rail">
          {unlocked.map((sk) => {
            const active = loadout.includes(sk.id);
            return (
              <button
                key={sk.id}
                type="button"
                className={`skills-dock__slot ${active ? "is-active" : "is-off"}`}
                aria-pressed={active}
                onClick={() => toggleSkill(sk.id)}
              >
                <span className="skills-dock__ico">
                  <Icon name={sk.icon} size={22} color={active ? "var(--green)" : "var(--red)"} />
                </span>
                <span className="skills-dock__name">{sk.name}</span>
              </button>
            );
          })}
          {locked.map((sk) => (
            <button
              key={sk.id}
              type="button"
              className="skills-dock__slot is-mystery"
              title={sk.desc}
              onClick={() => toastMsg(`${sk.name} пока закрыт · нужен ${sk.req} ур.`)}
            >
              <span className="skills-dock__lock"><Icon name="lock" size={12} /></span>
              <span className="skills-dock__ico">
                <Icon name={sk.icon} size={22} color="rgba(255,255,255,.42)" />
              </span>
              <span className="skills-dock__name">{sk.name}</span>
              <span className="skills-dock__req">ур. {sk.req}</span>
            </button>
          ))}
        </div>
        <div className="skills-dock__cap">
          <span className={`chip${loadout.length >= 3 ? " chip--gold" : ""}`}>
            <Icon name="loadout" size={14} /> Набор для боя: {loadout.length}/3
          </span>
        </div>
      </div>
    </div>
  );
}
