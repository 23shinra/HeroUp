import { useEffect, useMemo, useState } from "react";
import { CLASS_FEATURE_ENABLED, GAME } from "@domain/game-data";
import {
  classMeta,
  eloOf,
  skillMeta,
  sportMeta,
} from "@domain/game-engine";
import { SHApi } from "@domain/sync";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { PersonAvatar } from "../../components/PersonAvatar.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { pluralRu } from "../../lib/format.js";

function guildElo(g) {
  return (g.members || 0) * 1000 + (g.total || 0);
}

function RankBadge({ index }) {
  if (index === 0) return <span className="rank rank--1"><Icon name="crown" size={15} /></span>;
  if (index === 1) return <span className="rank rank--2">2</span>;
  if (index === 2) return <span className="rank rank--3">3</span>;
  return <span className="rank">{index + 1}</span>;
}

function rowGlow(index) {
  if (index === 0) return " rating-row--gold";
  if (index === 1) return " rating-row--silver";
  if (index === 2) return " rating-row--bronze";
  return "";
}

function RatingPodium({ items, type, onSelect, scoreNode }) {
  const top = items.slice(0, 3);
  if (!top.length) return null;
  const order = [1, 0, 2].filter((idx) => top[idx]);
  return (
    <div className="rating-podium">
      {order.map((idx) => {
        const item = top[idx];
        const isPlayer = type === "player";
        const placeClass = idx === 0
          ? " rating-podium__place--gold"
          : idx === 1
            ? " rating-podium__place--silver"
            : " rating-podium__place--bronze";
        const mine = isPlayer ? !!item.me : !!item.mine;
        const sub = isPlayer
          ? (item.guildName || "Без гильдии")
          : `${item.members} ${pluralRu(item.members || 0, "участник", "участника", "участников")}`;
        return (
          <button
            key={`${type}-${item.id || idx}`}
            type="button"
            className={`rating-podium__place${placeClass} item--tap${mine ? " item--current" : ""}`}
            onClick={() => onSelect(item)}
          >
            <div className="rating-podium__rank">{idx + 1}</div>
            <div className="rating-podium__avatar">
              {isPlayer
                ? <PersonAvatar entity={item} size={32} />
                : <Icon name="flag" size={30} color="var(--gold)" />}
            </div>
            <div className="rating-podium__name">{item.name}</div>
            <div className="rating-podium__sub">{sub}</div>
            <div className="rating-podium__score">{scoreNode(item)}</div>
          </button>
        );
      })}
    </div>
  );
}

function PlayerRow({ player, index, onSelect }) {
  return (
    <button
      type="button"
      className={`item item--tap rating-row${rowGlow(index)}${player.me ? " item--current" : ""}`}
      onClick={() => onSelect(player)}
    >
      <RankBadge index={index} />
      <div className="item__ico"><PersonAvatar entity={player} size={24} /></div>
      <div className="item__body">
        <div className="item__title">{player.name}</div>
        <div className="item__sub">{player.guildName || "Без гильдии"} · LVL {player.level}</div>
      </div>
      <span className="chip chip--gold">
        <Icon name="elo" size={13} color="#FF5500" /> {eloOf(player.trophies)}
      </span>
    </button>
  );
}

function GuildRow({ guild, index, onSelect }) {
  return (
    <button
      type="button"
      className={`item item--tap rating-row${rowGlow(index)}${guild.mine ? " item--current" : ""}`}
      onClick={() => onSelect(guild)}
    >
      <RankBadge index={index} />
      <div className="item__ico"><Icon name="flag" size={26} color="var(--gold)" /></div>
      <div className="item__body">
        <div className="item__title">{guild.name}</div>
        <div className="item__sub">
          {guild.members} {pluralRu(guild.members || 0, "участник", "участника", "участников")}
        </div>
      </div>
      <span className="chip chip--gold">
        <Icon name="elo" size={13} color="#FF5500" /> {guildElo(guild).toLocaleString("ru-RU")}
      </span>
    </button>
  );
}

function StatsGrid({ stats }) {
  const es = stats || { str: 0, spd: 0, end: 0, int: 0, team: 0 };
  const max = Math.max(20, ...Object.values(es).map((v) => Number(v) || 0));
  return (
    <div className="grid grid-2">
      {GAME.stats.map((s) => (
        <div key={s.id} className="stat">
          <div className="stat__top row" style={{ gap: 6 }}>
            <Icon name={s.icon} size={15} color={s.color} /> <span>{s.name}</span>
          </div>
          <div className="stat__val">{es[s.id] || 0}</div>
          <div className="statbar">
            <div
              className="statbar__fill"
              style={{ width: `${Math.round(((es[s.id] || 0) / max) * 100)}%`, background: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RatingPage() {
  const [tab, setTab] = useState("solo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [player, setPlayer] = useState(null);
  const [guild, setGuild] = useState(null);

  const load = () => {
    setLoading(true);
    setErr("");
    SHApi.leaderboard()
      .then(setData)
      .catch((e) => setErr(e.message || "Не удалось загрузить рейтинг"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const players = useMemo(
    () => (data?.players || []).slice().sort((a, b) => (b.trophies || 0) - (a.trophies || 0)),
    [data],
  );
  const guilds = useMemo(
    () => (data?.guilds || []).slice().sort((a, b) => guildElo(b) - guildElo(a)),
    [data],
  );

  const myIdx = players.findIndex((p) => p.me);
  const openPlayer = (p) => { setGuild(null); setPlayer(p); };
  const openGuild = (g) => { setPlayer(null); setGuild(g); };

  const playerRank = player
    ? players.findIndex((x) => x.id === player.id) + 1
    : 0;
  const playerSport = player ? sportMeta(player.sport) : null;
  const playerCls = player && CLASS_FEATURE_ENABLED ? classMeta(player.class) : null;
  const playerLoadout = player
    ? (player.loadout || []).map((sid) => skillMeta(sid)).filter(Boolean)
    : [];
  const playerStats = player?.stats || { str: 0, spd: 0, end: 0, int: 0, team: 0 };

  const guildMembers = guild
    ? players
      .filter((p) => Number(p.guildId) === Number(guild.id))
      .sort((a, b) => (b.trophies || 0) - (a.trophies || 0) || (b.level || 0) - (a.level || 0))
    : [];

  return (
    <div className="rating-scene">
      <div className="rating-scene__bg" aria-hidden="true" />
      <div className="topbar rating-scene__top">
        <div className="topbar__title"><h1>Рейтинг</h1><small>Топ по Эло</small></div>
        <div className="topbar__actions"><SyncBadge /></div>
      </div>

      <div className="rating-scene__tabs">
        <div className="seg">
          <button type="button" className={`seg__btn${tab === "solo" ? " seg__btn--on" : ""}`} onClick={() => setTab("solo")}>
            <Icon name="user" size={15} /> Игроки
          </button>
          <button type="button" className={`seg__btn${tab === "clan" ? " seg__btn--on" : ""}`} onClick={() => setTab("clan")}>
            <Icon name="flag" size={15} /> Гильдии
          </button>
        </div>
      </div>

      <div id="ratingBody">
        {loading && (
          <div className="loading-state" role="status">
            <span className="loading-state__spinner" aria-hidden="true" />
            <span>Загружаем рейтинг</span>
          </div>
        )}
        {err && (
          <div className="error-state" role="alert">
            <Icon name="flame" size={22} color="var(--red)" />
            <b>{err}</b>
            <button type="button" className="btn btn--ghost btn--sm" onClick={load}>Попробовать снова</button>
          </div>
        )}

        {!loading && !err && tab === "solo" && (
          players.length ? (
            <>
              <RatingPodium
                items={players}
                type="player"
                onSelect={openPlayer}
                scoreNode={(p) => (<><Icon name="elo" size={13} color="#FF5500" /> {eloOf(p.trophies)}</>)}
              />
              <div className="rating-list">
                {players.slice(3, 50).map((p, i) => (
                  <PlayerRow key={p.id || i} player={p} index={i + 3} onSelect={openPlayer} />
                ))}
              </div>
              {myIdx >= 6 && (
                <div className="rating-me">
                  <div className="rating-me__label">Твоё место — {myIdx + 1} из {players.length}</div>
                  <PlayerRow player={players[myIdx]} index={myIdx} onSelect={openPlayer} />
                </div>
              )}
            </>
          ) : (
            <div className="card center muted">Пока нет игроков в рейтинге</div>
          )
        )}

        {!loading && !err && tab === "clan" && (
          guilds.length ? (
            <>
              <p className="small muted rating-hint">
                Суммарное Эло участников гильдии. Нажми на гильдию, чтобы увидеть состав.
              </p>
              <RatingPodium
                items={guilds}
                type="guild"
                onSelect={openGuild}
                scoreNode={(c) => (<><Icon name="elo" size={13} color="#FF5500" /> {guildElo(c).toLocaleString("ru-RU")}</>)}
              />
              <div className="rating-list">
                {guilds.slice(3).map((g, i) => (
                  <GuildRow key={g.id || i} guild={g} index={i + 3} onSelect={openGuild} />
                ))}
              </div>
            </>
          ) : (
            <div className="card center muted">Пока нет гильдий в рейтинге</div>
          )
        )}
      </div>

      <Modal
        open={!!player}
        onClose={() => setPlayer(null)}
        sheetClass="rp-sheet"
        title={<span className="rp-sheet__badge"><Icon name="elo" size={14} color="#FF5500" /> Профиль игрока</span>}
      >
        {player && (
          <div className="rp-sheet__body">
            <div className="rp-hero">
              <div className="rp-hero__avatar"><PersonAvatar entity={player} size={56} /></div>
              <div className="rp-hero__info">
                <div className="rp-hero__name" id="rpName">
                  {player.name}
                  {player.me ? <span className="rp-me">вы</span> : null}
                </div>
                <div className="rp-hero__sub">
                  {playerRank > 0 && <span>#{playerRank} в рейтинге</span>}
                  {playerSport && (
                    <span><Icon name={playerSport.icon} size={13} /> {playerSport.name}</span>
                  )}
                  {playerCls && (
                    <span><Icon name={playerCls.icon || "badge"} size={13} /> {playerCls.name}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rp-metrics">
              <div className="rp-metric">
                <span className="rp-metric__label"><Icon name="star" size={13} color="var(--gold)" /> Уровень</span>
                <b className="rp-metric__val">LVL {player.level}</b>
              </div>
              <div className="rp-metric">
                <span className="rp-metric__label"><Icon name="elo" size={13} color="#FF5500" /> Эло</span>
                <b className="rp-metric__val">{eloOf(player.trophies)}</b>
              </div>
              <div className="rp-metric">
                <span className="rp-metric__label"><Icon name="dumbbell" size={13} color="var(--orange)" /> Неделя</span>
                <b className="rp-metric__val">{player.weekTrainings || 0}</b>
              </div>
            </div>

            {player.guildId ? (
              <button
                type="button"
                className="rp-guild"
                onClick={() => {
                  const g = guilds.find((x) => Number(x.id) === Number(player.guildId));
                  if (g) openGuild(g);
                }}
              >
                <span className="rp-guild__ico"><Icon name="flag" size={18} color="var(--gold)" /></span>
                <span className="rp-guild__body">
                  <span className="rp-guild__label">Гильдия</span>
                  <b>{player.guildName || "Гильдия"}</b>
                </span>
                <span className="rp-guild__chev"><Icon name="arrowR" size={16} /></span>
              </button>
            ) : (
              <div className="rp-guild rp-guild--empty">
                <span className="rp-guild__ico"><Icon name="flag" size={18} /></span>
                <span className="rp-guild__body">
                  <span className="rp-guild__label">Гильдия</span>
                  <b>Без гильдии</b>
                </span>
              </div>
            )}

            <section className="rp-block">
              <h3 className="rp-block__title"><Icon name="strength" size={15} color="var(--orange)" /> Характеристики</h3>
              <StatsGrid stats={playerStats} />
            </section>

            <section className="rp-block">
              <h3 className="rp-block__title"><Icon name="bolt" size={15} color="var(--orange)" /> Скиллы в бою</h3>
              {playerLoadout.length ? (
                <div className="loadout-row">
                  {playerLoadout.map((sk) => (
                    <span key={sk.id} className="chip loadout-chip" data-tip={sk.desc || ""}>
                      <Icon name={sk.icon} size={14} color="var(--orange)" /> {sk.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rp-empty">Скиллы не выбраны</p>
              )}
            </section>
          </div>
        )}
      </Modal>

      <Modal
        open={!!guild}
        onClose={() => setGuild(null)}
        title={<><Icon name="flag" size={18} color="var(--gold)" /> {guild?.name}</>}
      >
        {guild && (
          <>
            <div className="card">
              <div className="row between"><span>Участники</span><b>{guild.members}</b></div>
              <div className="divider" />
              <div className="row between">
                <span>Суммарное Эло</span>
                <b>{guildElo(guild).toLocaleString("ru-RU")}</b>
              </div>
            </div>
            <div className="spacer" />
            <div className="label" style={{ marginBottom: 8 }}>Состав</div>
            {guildMembers.length ? guildMembers.map((p, i) => (
              <button
                key={p.id || i}
                type="button"
                className={`item item--tap${p.me ? " item--current" : ""}`}
                onClick={() => openPlayer(p)}
              >
                <span className="rank">{i + 1}</span>
                <div className="item__ico"><PersonAvatar entity={p} size={24} /></div>
                <div className="item__body">
                  <div className="item__title">{p.name}</div>
                  <div className="item__sub">
                    <Icon name="elo" size={12} color="#FF5500" /> {eloOf(p.trophies)} · LVL {p.level}
                  </div>
                </div>
                <span className="chip chip--gold">
                  <Icon name="elo" size={13} color="#FF5500" /> {eloOf(p.trophies)}
                </span>
              </button>
            )) : (
              <div className="card center muted">В гильдии пока никого нет</div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
