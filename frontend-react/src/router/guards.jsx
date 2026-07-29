import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SHApi } from "@domain/sync";
import { useGameStore } from "../stores/useGameStore.js";

function sessionReady(S) {
  return SHApi.hasToken() && S.auth?.loggedIn && S.created;
}

export function RequireAuth({ role }) {
  const S = useGameStore((s) => s.S);
  const booted = useGameStore((s) => s.booted);
  const location = useLocation();

  if (!booted) {
    return (
      <div className="loading-state" role="status">
        <span className="loading-state__spinner" aria-hidden="true" />
        <span>Загружаем LevelUp…</span>
      </div>
    );
  }

  const ready = sessionReady(S);
  if (!ready) return <Navigate to="/auth" replace state={{ from: location }} />;

  if (role === "trainer" && S.role !== "trainer") {
    return <Navigate to="/battle" replace />;
  }
  if (role === "child" && S.role === "trainer") {
    return <Navigate to="/trainer" replace />;
  }

  return <Outlet />;
}

export function HomeRedirect() {
  const S = useGameStore((s) => s.S);
  const booted = useGameStore((s) => s.booted);
  const ready = useGameStore((s) => sessionReady(s.S));

  if (!booted) {
    return (
      <div className="loading-state" role="status">
        <span className="loading-state__spinner" aria-hidden="true" />
        <span>Загружаем LevelUp…</span>
      </div>
    );
  }

  if (!ready) return <Navigate to="/auth" replace />;
  return <Navigate to={S.role === "trainer" ? "/trainer" : "/battle"} replace />;
}
