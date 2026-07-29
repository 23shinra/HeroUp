import { useNavigate } from "react-router-dom";
import { GAME } from "@domain/game-data";
import { Icon } from "../../components/Icon.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { useGameStore } from "../../stores/useGameStore.js";

export default function ShopPage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const setS = useGameStore((s) => s.setS);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const h = S.hero;

  const buy = (item) => {
    if (h.coins < item.price) {
      toastMsg("Не хватает монет. Тренируйся, чтобы заработать!");
      return;
    }
    setS((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        coins: prev.hero.coins - item.price,
        cosmetics: {
          ...prev.hero.cosmetics,
          owned: [...prev.hero.cosmetics.owned, item.id],
          equipped: { ...prev.hero.cosmetics.equipped, [item.type]: item.id },
        },
      },
    }));
    toastMsg(`Куплено и надето: ${item.name}`);
  };

  const toggleEquip = (item) => {
    setS((prev) => {
      const eq = { ...prev.hero.cosmetics.equipped };
      eq[item.type] = eq[item.type] === item.id ? null : item.id;
      return { ...prev, hero: { ...prev.hero, cosmetics: { ...prev.hero.cosmetics, equipped: eq } } };
    });
  };

  return (
    <>
      <div className="topbar">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={() => navigate("/profile")}>
          <Icon name="arrowL" size={20} />
        </button>
        <div className="topbar__title"><h1>Магазин</h1><small>Только косметика — не влияет на бой</small></div>
        <div className="topbar__actions">
          <SyncBadge />
          <span className="chip chip--gold"><Icon name="coin" size={15} color="var(--gold)" /> {h.coins}</span>
        </div>
      </div>

      <div className="section">
        <h2 className="row" style={{ gap: 8 }}><Icon name="sparkles" size={18} /> Эффекты</h2>
        {GAME.shop.map((item) => {
          const owned = h.cosmetics.owned.includes(item.id);
          const equipped = h.cosmetics.equipped[item.type] === item.id;
          return (
            <div key={item.id} className="item">
              <div className="item__ico"><Icon name={item.icon} size={24} color={item.color} /></div>
              <div className="item__body">
                <div className="item__title">{item.name}</div>
                <div className="item__sub">{owned ? (equipped ? "Надето" : "В инвентаре") : "Косметика"}</div>
              </div>
              {owned ? (
                <button type="button" className={`btn btn--sm${equipped ? " btn--ghost" : ""}`} onClick={() => toggleEquip(item)}>
                  {equipped ? "Снять" : "Надеть"}
                </button>
              ) : (
                <button type="button" className="btn btn--gold btn--sm btn--icon" disabled={h.coins < item.price} onClick={() => buy(item)}>
                  {item.price} <Icon name="coin" size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="info-note section">
        Эффекты дают только внешний вид. Баланс боёв зависит от реальных тренировок.
      </p>
    </>
  );
}
