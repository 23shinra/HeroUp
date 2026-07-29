import { confetti } from "./confetti.js";

export function showAttendanceToasts(applied, toastMsg) {
  if (!applied?.count) return;
  const coinsTxt = applied.coins ? ` · +${applied.coins} монет` : "";
  setTimeout(() => toastMsg(`Тренер подтвердил тренировок: ${applied.count} · +${applied.xp} XP${coinsTxt}`), 400);
  if (applied.mvp) {
    setTimeout(() => {
      toastMsg("Ты — MVP тренировки! 🏅");
      confetti();
    }, 1400);
  }
  if (applied.praise) {
    setTimeout(() => toastMsg(`Тренер: «${applied.praise}»`), applied.mvp ? 2400 : 1400);
  }
  if (applied.milestone) {
    setTimeout(() => {
      toastMsg(`Рубеж серии ${applied.milestone.days} дней! +${applied.milestone.coins} монет`);
      confetti();
    }, 2000);
  }
}
