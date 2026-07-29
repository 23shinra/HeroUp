import { useEffect, useState } from "react";
import { SHApi } from "@domain/sync";
import { eloOf } from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { escapeHtml, pluralRu } from "../../lib/format.js";
import { useGameStore } from "../../stores/useGameStore.js";

const GUILD_CHEST_COINS = 60;

function weekKey() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-W${Math.ceil(mon.getDate() / 7)}`;
}

export default function ClanPage() {
  const S = useGameStore((s) => s.S);
  const setS = useGameStore((s) => s.setS);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const g = S.guild;

  const [members, setMembers] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true);
    SHApi.guildRoster()
      .then((d) => {
        if (d.guild) setS((prev) => ({ ...prev, guild: d.guild }));
        setMembers((d.members || []).sort((a, b) => b.level - a.level || b.trophies - a.trophies));
        setWeekly(d.weekly);
      })
      .catch((e) => setErr(e.message || "Не удалось загрузить состав"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const claimChest = async () => {
    try {
      const r = await SHApi.claimGuildChest();
      if (r.state) setS((prev) => ({ ...prev, ...r.state, hero: { ...prev.hero, ...r.state.hero } }));
      else {
        setS((prev) => ({
          ...prev,
          hero: { ...prev.hero, guildChestWeek: r.weekKey || weekKey(), coins: (prev.hero.coins || 0) + (r.already ? 0 : (r.coins || GUILD_CHEST_COINS)) },
        }));
      }
      toastMsg(r.already ? "Сундук уже был получен" : `Сундук гильдии открыт! +${r.coins || GUILD_CHEST_COINS} монет`);
      if (weekly) setWeekly({ ...weekly, claimed: true });
    } catch (e) {
      toastMsg(e.message || "Не удалось забрать сундук");
    }
  };

  const pct = weekly?.target ? Math.round((weekly.count / weekly.target) * 100) : 0;
  const reached = weekly?.reached || (weekly && weekly.count >= weekly.target);
  const claimed = weekly?.claimed || S.hero.guildChestWeek === (weekly?.weekKey || weekKey());

  return (
    <>
      <div className="topbar">
        <div className="topbar__title"><h1>Гильдия</h1><small>Твоя команда и тренер</small></div>
        <div className="topbar__actions"><SyncBadge /></div>
      </div>

      <div className="section">
        {g ? (
          <div className="card">
            <div className="row" style={{ gap: 14 }}>
              <div className="current-section__ico"><Icon name="flag" size={34} color="var(--gold)" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{escapeHtml(g.name)}</div>
                <div className="small row" style={{ gap: 6, opacity: 0.9 }}>
                  <Icon name="badge" size={14} color="var(--gold)" /> Тренер: {escapeHtml(g.trainerName || "—")}
                </div>
                <div className="small muted" style={{ marginTop: 2 }}>Код: {escapeHtml(g.code || "—")}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card center muted row" style={{ justifyContent: "center", gap: 8 }}>
            <Icon name="flag" size={20} /> Ты не в гильдии
          </div>
        )}
      </div>

      {weekly?.target ? (
        <div className="section">
          <div className="card guild-goal">
            <div className="row between small" style={{ marginBottom: 6 }}>
              <span className="row" style={{ gap: 6 }}><Icon name="gift" size={15} color="var(--gold)" /> Цель гильдии на неделю</span>
              <b>{weekly.count}/{weekly.target}{reached ? " ✓" : ""}</b>
            </div>
            <div className="bar"><div className="bar__fill" style={{ width: `${Math.min(100, pct)}%`, background: reached ? "var(--green)" : "var(--gold)" }} /></div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Твой вклад: {weekly.myCount || 0} {pluralRu(weekly.myCount || 0, "тренировка", "тренировки", "тренировок")}
            </div>
            {reached && !claimed && (
              <button type="button" className="btn btn--gold btn--icon" style={{ marginTop: 10 }} onClick={claimChest}>
                <Icon name="gift" size={16} /> Забрать сундук (+{weekly.coins || GUILD_CHEST_COINS} монет)
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="section">
        <h2 className="row" style={{ gap: 8, margin: "0 0 12px" }}>
          <Icon name="team" size={18} color="var(--primary)" /> Состав гильдии
        </h2>
        {loading && (
          <div className="loading-state" role="status">
            <span className="loading-state__spinner" aria-hidden="true" />
            <span>Загружаем состав гильдии</span>
          </div>
        )}
        {err && <div className="error-state"><b>{err}</b></div>}
        {!loading && !members.length && <div className="card center muted">В гильдии пока только ты</div>}
        {members.map((m, i) => (
          <div key={m.id || i} className={`item${m.me ? " item--current" : ""}`}>
            <span className="rank">{i + 1}</span>
            <div className="item__body">
              <div className="item__title">{escapeHtml(m.name)}{m.me ? " (вы)" : ""}</div>
              <div className="item__sub">LVL {m.level}</div>
            </div>
            <span className="chip"><Icon name="elo" size={13} color="#FF5500" /> {eloOf(m.trophies)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
