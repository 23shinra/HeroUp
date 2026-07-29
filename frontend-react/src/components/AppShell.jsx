import { Outlet } from "react-router-dom";
import { useGameStore } from "../stores/useGameStore.js";
import { useChildLive } from "../hooks/useChildLive.js";
import { useRemindersBoot } from "../hooks/useRemindersBoot.jsx";
import { NavBar } from "./NavBar.jsx";
import { Toast } from "./Toast.jsx";
import { SyncStatusModal } from "./SyncBadge.jsx";

export function AppShell({ showNav = true }) {
  const role = useGameStore((s) => s.S.role);
  useChildLive();
  const { modal: remindersModal } = useRemindersBoot();

  return (
    <div id="app">
      <main id="screen" className="screen">
        <Outlet />
      </main>
      {showNav && role !== "trainer" && <NavBar />}
      <Toast />
      <SyncStatusModal />
      {remindersModal}
    </div>
  );
}
