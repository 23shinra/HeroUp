export function confetti(n = 40) {
  if (typeof document === "undefined") return;
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  const colors = ["#FF5500", "#FFD700", "#2E5EFF", "#22C55E", "#FF69B4"];
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i");
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    el.style.animationDuration = `${1.4 + Math.random()}s`;
    box.appendChild(el);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}
