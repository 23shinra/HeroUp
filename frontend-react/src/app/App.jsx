import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "../router/AppRouter.jsx";
import { TipHost } from "../components/TipHost.jsx";
import { useGameStore } from "../stores/useGameStore.js";

export function App() {
  const boot = useGameStore((s) => s.boot);
  const booted = useGameStore((s) => s.booted);

  useEffect(() => {
    boot();
  }, [boot]);

  if (!booted) {
    return (
      <div id="app">
        <main className="screen">
          <div className="loading-state" role="status">
            <span className="loading-state__spinner" aria-hidden="true" />
            <span>Загружаем LevelUp…</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <TipHost />
      <AppRouter />
    </BrowserRouter>
  );
}
