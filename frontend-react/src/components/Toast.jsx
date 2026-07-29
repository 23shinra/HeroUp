import { useGameStore } from "../stores/useGameStore.js";

export function Toast() {
  const toast = useGameStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div id="toast" className="toast toast--in" role="status">
      {toast}
    </div>
  );
}
