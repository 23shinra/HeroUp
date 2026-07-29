import { sportMeta, sportSpriteSrc } from "@domain/game-engine";
import { GAME } from "@domain/game-data";
import { Icon } from "./Icon.jsx";

/** Sport sprite or fallback icon for leaderboard entities. */
export function PersonAvatar({ entity, size = 24 }) {
  const sportById = entity?.sport ? sportMeta(entity.sport) : null;
  const rawAvatar = entity?.avatar ? String(entity.avatar).toLowerCase() : "";
  const sportByAvatar = !sportById && rawAvatar
    ? GAME.sports.find((s) => String(s.avatar).toLowerCase() === rawAvatar)
    : null;
  const sportByAlias = !sportById && !sportByAvatar && rawAvatar
    ? (rawAvatar.includes("box")
      ? sportMeta("boxing")
      : (rawAvatar.includes("wrest")
        ? sportMeta("wrestling")
        : (rawAvatar.includes("robot") ? sportMeta("robotics") : null)))
    : null;
  const sport = sportById || sportByAvatar || sportByAlias;
  if (sport?.sprite) {
    return <img className="item__photo" src={sportSpriteSrc(sport)} alt={sport.name} />;
  }
  const fallback = entity?.avatar || "user";
  return <Icon name={fallback} size={size} />;
}
