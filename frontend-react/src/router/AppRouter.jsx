import { lazy, Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { AppShell } from "../components/AppShell.jsx";
import { GuestShell } from "../components/GuestShell.jsx";
import { HomeRedirect, RequireAuth } from "./guards.jsx";

const AuthPage = lazy(() => import("../features/auth/AuthPage.jsx"));
const MapPage = lazy(() => import("../features/map/MapPage.jsx"));
const BattlePage = lazy(() => import("../features/battle/BattlePage.jsx"));
const SkillsPage = lazy(() => import("../features/skills/SkillsPage.jsx"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage.jsx"));
const RatingPage = lazy(() => import("../features/rating/RatingPage.jsx"));
const ClanPage = lazy(() => import("../features/clan/ClanPage.jsx"));
const ShopPage = lazy(() => import("../features/shop/ShopPage.jsx"));
const TrainerPage = lazy(() => import("../features/trainer/TrainerPage.jsx"));
const ParentPage = lazy(() => import("../features/parent/ParentPage.jsx"));
const PrivacyPage = lazy(() => import("../features/legal/PrivacyPage.jsx"));
const TermsPage = lazy(() => import("../features/legal/TermsPage.jsx"));
const ClassSelectPage = lazy(() => import("../features/class-select/ClassSelectPage.jsx"));

function PageFallback() {
  return (
    <div className="loading-state" role="status">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>Загружаем экран…</span>
    </div>
  );
}

function Lazy({ children }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth" element={<GuestShell><Lazy><AuthPage /></Lazy></GuestShell>} />
      <Route path="/privacy" element={<GuestShell><Lazy><PrivacyPage /></Lazy></GuestShell>} />
      <Route path="/terms" element={<GuestShell><Lazy><TermsPage /></Lazy></GuestShell>} />

      <Route element={<RequireAuth role="child" />}>
        <Route element={<AppShell showNav />}>
          <Route path="/map" element={<Lazy><MapPage /></Lazy>} />
          <Route path="/battle" element={<Lazy><BattlePage /></Lazy>} />
          <Route path="/skills" element={<Lazy><SkillsPage /></Lazy>} />
          <Route path="/profile" element={<Lazy><ProfilePage /></Lazy>} />
          <Route path="/rating" element={<Lazy><RatingPage /></Lazy>} />
          <Route path="/clan" element={<Lazy><ClanPage /></Lazy>} />
          <Route path="/shop" element={<Lazy><ShopPage /></Lazy>} />
          <Route path="/parent" element={<Lazy><ParentPage /></Lazy>} />
          <Route path="/class-select" element={<Lazy><ClassSelectPage /></Lazy>} />
        </Route>
      </Route>

      <Route element={<RequireAuth role="trainer" />}>
        <Route element={<AppShell showNav={false} />}>
          <Route path="/trainer" element={<Lazy><TrainerPage /></Lazy>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
