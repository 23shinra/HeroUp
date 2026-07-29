import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useGameStore } from "../stores/useGameStore.js";

const NAV_ITEMS = [
  { to: "/map", route: "map", icon: "map", label: "Карта", img: "/assets/icon-map.png?v=191" },
  { to: "/rating", route: "rating", icon: "trophy", label: "Рейтинг" },
  { to: "/battle", route: "battle", icon: "swords", label: "Бой", fab: true },
  { to: "/skills", route: "skills", icon: "training", label: "Тренировка" },
  { to: "/profile", route: "profile", icon: "user", label: "Профиль" },
];

function battleBlocksNav(to) {
  if (!to || to === "/battle" || to.startsWith("/battle")) return false;
  const { battlePhase, battleState } = useGameStore.getState();
  if (battlePhase === "arena" && battleState?.opp && !battleState.rewards) return true;
  return false;
}

export function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav id="nav" className="nav">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.route}
          to={item.to}
          className={`nav__btn${item.fab ? " nav__btn--fab" : ""}${pathname.startsWith(item.to) ? " nav__btn--active" : ""}`}
          onClick={(e) => {
            if (!battleBlocksNav(item.to)) {
              const st = useGameStore.getState();
              if (st.battlePhase === "matchmaking" && item.to !== "/battle") {
                st.resetBattle();
                st.toastMsg("Поиск соперника отменён");
              }
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent("sh:battle-nav", {
              detail: { to: item.to },
            }));
          }}
        >
          <span className="nav__ico">
            {item.img ? (
              <img className="nav__ico-img" src={item.img} alt="" width={24} height={24} decoding="async" />
            ) : (
              <Icon name={item.icon} size={24} />
            )}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
