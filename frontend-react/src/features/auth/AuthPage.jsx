import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { GAME } from "@domain/game-data";
import { SHApi } from "@domain/sync";
import { bindAccountSession, defaultState, hydrateState, saveState } from "@domain/state";
import { Icon } from "../../components/Icon.jsx";
import { PasswordField } from "../../components/PasswordField.jsx";
import { useGameStore } from "../../stores/useGameStore.js";

const initialDraft = {
  mode: "login",
  role: "",
  login: "",
  password: "",
  name: "",
  sport: "wrestling",
  guildCode: "",
  guildName: "",
  consent: false,
  guildPreview: null,
};

function validateCredentials(login, password) {
  const user = String(login || "").trim();
  if (user.length < 3) return "Логин: минимум 3 символа";
  if (!/^[a-zA-Z0-9_.-]+$/.test(user)) return "Логин: латиница, цифры, _ . -";
  if (String(password || "").length < 8) return "Пароль: минимум 8 символов";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Пароль: нужны буквы и цифры";
  return "";
}

function sportTiles(selected, onPick) {
  return (
    <div className="model-tiles">
      {GAME.sports.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`model-tile${selected === s.id ? " model-tile--on" : ""}`}
          onClick={() => onPick(s.id)}
        >
          <span className="model-tile__ico"><Icon name={s.icon} size={28} /></span>
          <span className="model-tile__t">{s.name}</span>
        </button>
      ))}
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ready = useGameStore((s) => SHApi.hasToken() && s.S.auth?.loggedIn && s.S.created);
  const S = useGameStore((s) => s.S);
  const applySession = useGameStore((s) => s.applySession);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const setS = useGameStore((s) => s.setS);

  const [draft, setDraft] = useState(initialDraft);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [regStep, setRegStep] = useState("role");

  const refreshPreview = async (code) => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setDraft((d) => ({ ...d, guildPreview: null }));
      return;
    }
    try {
      const preview = await SHApi.guildPreview(c);
      setDraft((d) => ({ ...d, guildPreview: preview, guildCode: c }));
    } catch {
      setDraft((d) => ({ ...d, guildPreview: null, guildCode: c }));
    }
  };

  useEffect(() => {
    const join = searchParams.get("join");
    if (!join) return;
    const code = join.trim().toUpperCase();
    setDraft((d) => ({ ...d, mode: "register", role: "child", guildCode: code }));
    setRegStep("guild");
    refreshPreview(code);
  }, [searchParams]);

  if (ready) {
    return <Navigate to={S.role === "trainer" ? "/trainer" : "/battle"} replace />;
  }

  const handleLogin = async () => {
    setErr("");
    setLoading(true);
    try {
      const d = await SHApi.login(draft.login.trim(), draft.password);
      const session = applySession({ ...d, state: d.state || {} }, `С возвращением, ${d.username}!`);
      navigate(session.role === "trainer" ? "/trainer" : "/battle", { replace: true });
    } catch (e) {
      setErr(e.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErr("");
    const credErr = validateCredentials(draft.login, draft.password);
    if (credErr) {
      setErr(credErr);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        username: draft.login.trim(),
        password: draft.password,
        role: draft.role,
        name: draft.name.trim(),
        consent: draft.consent,
      };
      if (draft.role === "child") {
        payload.guildCode = draft.guildCode.trim().toUpperCase();
      } else {
        payload.sport = draft.sport;
        payload.guildName = draft.guildName.trim();
      }
      const d = await SHApi.register(payload);
      bindAccountSession(d.username);
      let state = hydrateState(d.state || defaultState());
      state.auth.loggedIn = true;
      state.auth.username = d.username;
      state.role = d.role;
      state.guild = d.guild || null;
      if (d.role === "child") {
        state.hero.name = draft.name.trim();
        state.hero.sport = d.sport || draft.sport;
        state.created = true;
      } else {
        state.hero.name = draft.name.trim();
        state.created = true;
      }
      state = saveState(state);
      setS(state);
      toastMsg(d.role === "trainer" ? "Гильдия создана!" : "Добро пожаловать в LevelUp!");
      navigate(d.role === "trainer" ? "/trainer" : "/battle", { replace: true });
    } catch (e) {
      setErr(e.message || "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  };

  const mode = draft.mode;

  return (
    <>
      <div className="onb-logo"><Icon name="bolt" size={64} /></div>
      <h1 className="center">LevelUp</h1>

      <div className="seg" id="authSeg" style={{ maxWidth: 340, margin: "16px auto 4px" }}>
        <button
          type="button"
          className={`seg__btn${mode === "login" ? " seg__btn--on" : ""}`}
          onClick={() => { setDraft((d) => ({ ...d, mode: "login" })); setErr(""); }}
        >
          Вход
        </button>
        <button
          type="button"
          className={`seg__btn${mode === "register" ? " seg__btn--on" : ""}`}
          onClick={() => { setDraft((d) => ({ ...d, mode: "register" })); setRegStep("role"); setErr(""); }}
        >
          Регистрация
        </button>
      </div>

      <div className="card section">
        {mode === "login" ? (
          <div className="auth-step">
            <div className="label" style={{ marginTop: 0 }}>Логин</div>
            <input
              id="loginUser"
              className="input"
              autoComplete="username"
              placeholder="Твой логин"
              value={draft.login}
              onChange={(e) => setDraft((d) => ({ ...d, login: e.target.value }))}
            />
            <div className="label">Пароль</div>
            <PasswordField
              id="loginPass"
              autoComplete="current-password"
              placeholder="Пароль"
              value={draft.password}
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
            />
            <div className="spacer" />
            <button type="button" className="btn btn--icon" disabled={loading} onClick={handleLogin}>
              <Icon name="check" size={18} /> Войти
            </button>
          </div>
        ) : !draft.role ? (
          <>
            <div className="label" style={{ marginTop: 0 }}>Кто ты?</div>
            <div className="role-pick">
              <button type="button" className="role-tile" onClick={() => { setDraft((d) => ({ ...d, role: "child" })); setRegStep("cred"); }}>
                <span className="role-tile__ico"><Icon name="user" size={30} color="var(--primary)" /></span>
                <span className="role-tile__t">Я — ребёнок</span>
                <span className="role-tile__d">Тренируюсь, качаю героя, дерусь на арене</span>
              </button>
              <button type="button" className="role-tile" onClick={() => { setDraft((d) => ({ ...d, role: "trainer" })); setRegStep("cred"); }}>
                <span className="role-tile__ico"><Icon name="badge" size={30} color="var(--gold)" /></span>
                <span className="role-tile__t">Я — тренер</span>
                <span className="role-tile__d">Веду гильдию, задаю расписание, подтверждаю тренировки</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="linklike" onClick={() => setDraft((d) => ({ ...d, role: "" }))}>
              <Icon name="arrowR" size={14} /> сменить роль
            </button>

            {regStep === "cred" && (
              <div className="auth-step" id="stepCred">
                <div className="label" style={{ marginTop: 0 }}>1. Логин и пароль</div>
                <input id="regUser" className="input" maxLength={24} placeholder="Логин (для входа)" value={draft.login} onChange={(e) => setDraft((d) => ({ ...d, login: e.target.value }))} />
                <div className="spacer" />
                <PasswordField
                  id="regPass"
                  autoComplete="new-password"
                  placeholder="Пароль"
                  value={draft.password}
                  onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                />
                <p className="field-hint">Минимум 8 символов, обязательно буквы и цифры.</p>
                <button type="button" className="btn btn--icon" style={{ marginTop: 12 }} onClick={() => setRegStep("name")}>
                  <Icon name="check" size={18} /> Далее
                </button>
              </div>
            )}

            {regStep === "name" && (
              <div className="auth-step" id="stepName">
                <div className="label">{draft.role === "child" ? "2. Имя героя" : "2. Твоё имя"}</div>
                <input id="heroName" className="input" maxLength={draft.role === "child" ? 16 : 24} placeholder={draft.role === "child" ? "Например, Молния" : "Например, Иван Петрович"} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                <button type="button" className="btn btn--icon" style={{ marginTop: 12 }} onClick={() => setRegStep(draft.role === "child" ? "guild" : "section")}>
                  <Icon name="check" size={18} /> Далее
                </button>
              </div>
            )}

            {regStep === "guild" && draft.role === "child" && (
              <div className="auth-step" id="stepJoin">
                <div className="label">3. Гильдия тренера</div>
                <div className="auth-or"><span>или введи код</span></div>
                {draft.guildPreview && (
                  <div className="card">
                    <div className="item__title">{draft.guildPreview.name}</div>
                    <div className="item__sub">Тренер: {draft.guildPreview.trainerName}</div>
                  </div>
                )}
                <input
                  id="guildCodeInput"
                  className="input"
                  maxLength={6}
                  placeholder="Например, XYGYXV"
                  value={draft.guildCode}
                  style={{ textTransform: "uppercase", letterSpacing: 2, fontWeight: 800 }}
                  onChange={(e) => { setDraft((d) => ({ ...d, guildCode: e.target.value.toUpperCase() })); refreshPreview(e.target.value); }}
                />
                <label className="checkline" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={draft.consent} onChange={(e) => setDraft((d) => ({ ...d, consent: e.target.checked }))} />
                  <span>
                    Есть согласие родителя и принятие{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">правил</a>
                    {" / "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">политики</a>
                  </span>
                </label>
                <div className="spacer" />
                <button type="button" className="btn btn--icon" disabled={loading || !draft.consent || draft.guildCode.length < 4} onClick={handleRegister}>
                  <Icon name="check" size={18} /> Создать аккаунт
                </button>
              </div>
            )}

            {regStep === "section" && draft.role === "trainer" && (
              <div className="auth-step" id="stepSection">
                <div className="label">3. Секция гильдии</div>
                {sportTiles(draft.sport, (sport) => setDraft((d) => ({ ...d, sport })))}
                <button type="button" className="btn btn--icon" style={{ marginTop: 12 }} onClick={() => setRegStep("guildName")}>
                  <Icon name="arrowR" size={18} /> Далее
                </button>
              </div>
            )}

            {regStep === "guildName" && draft.role === "trainer" && (
              <div className="auth-step" id="stepGuildName">
                <div className="label">4. Название гильдии</div>
                <input id="guildNameInput" className="input" maxLength={40} placeholder="Например, Тигрята" value={draft.guildName} onChange={(e) => setDraft((d) => ({ ...d, guildName: e.target.value }))} />
                <div className="spacer" />
                <button type="button" className="btn btn--icon" disabled={loading || !draft.guildName.trim()} onClick={handleRegister}>
                  <Icon name="check" size={18} /> Создать гильдию
                </button>
              </div>
            )}
          </>
        )}

        <p className="auth-err small center" id="authErr">{err}</p>
      </div>
    </>
  );
}
