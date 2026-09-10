import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { remindersFullyOn } from "@domain/reminders";
import { SHApi } from "@domain/sync";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { PasswordField } from "../../components/PasswordField.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { toggleReminders } from "../../hooks/useRemindersBoot.jsx";
import { useGameStore } from "../../stores/useGameStore.js";

function phoneDigits(raw) {
  let d = String(raw || "").replace(/\D+/g, "");
  if (d.startsWith("8")) d = `7${d.slice(1)}`;
  if (d && !d.startsWith("7")) d = `7${d}`;
  return d.slice(0, 11);
}

function formatPhoneMask(raw) {
  const d = phoneDigits(raw);
  if (!d) return "";
  const rest = d.slice(1);
  let out = "+7";
  if (rest.length > 0) out += ` ${rest.slice(0, 3)}`;
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += ` ${rest.slice(6, 8)}`;
  if (rest.length > 8) out += ` ${rest.slice(8, 10)}`;
  return out;
}

function formatPhoneDisplay(raw) {
  return formatPhoneMask(raw) || String(raw || "");
}

function phoneReady(raw) {
  return phoneDigits(raw).length === 11;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const logout = useGameStore((s) => s.logout);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const applySession = useGameStore((s) => s.applySession);
  const S = useGameStore((s) => s.S);
  const setS = useGameStore((s) => s.setS);

  const [remindersOn, setRemindersOn] = useState(remindersFullyOn());
  const [username, setUsername] = useState(S.auth?.username || "");
  const [phone, setPhone] = useState(S.auth?.phone || "");
  const [passwordSet, setPasswordSet] = useState(!!S.auth?.passwordSet);
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [bindOpen, setBindOpen] = useState(false);
  const [bindPhone, setBindPhone] = useState("");
  const [bindCode, setBindCode] = useState("");
  const [bindSent, setBindSent] = useState(false);
  const [bindErr, setBindErr] = useState("");
  const [bindLoading, setBindLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAccount(true);
      try {
        const d = await SHApi.getState();
        if (cancelled) return;
        setUsername(d.username || "");
        setPhone(d.phone || "");
        setPasswordSet(!!d.passwordSet);
        setS((prev) => ({
          ...prev,
          auth: {
            ...prev.auth,
            username: d.username || prev.auth?.username || "",
            phone: d.phone || "",
            passwordSet: !!d.passwordSet,
            loggedIn: true,
          },
        }));
      } catch {
        /* keep local auth snapshot */
      } finally {
        if (!cancelled) setLoadingAccount(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setS]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const closeBindModal = () => {
    setBindOpen(false);
    setBindPhone("");
    setBindCode("");
    setBindSent(false);
    setBindErr("");
    setBindLoading(false);
    setResendIn(0);
  };

  const handleSendBindCode = async () => {
    setBindErr("");
    setBindLoading(true);
    try {
      await SHApi.bindPhoneSend(phoneDigits(bindPhone));
      setBindSent(true);
      setBindCode("");
      setResendIn(60);
      toastMsg("Код отправлен в WhatsApp");
    } catch (e) {
      setBindErr(e.message || "Не удалось отправить код");
    } finally {
      setBindLoading(false);
    }
  };

  const handleConfirmBind = async () => {
    setBindErr("");
    setBindLoading(true);
    try {
      const d = await SHApi.bindPhoneConfirm(phoneDigits(bindPhone), bindCode.trim());
      if (d?.token) applySession(d);
      else {
        setPhone(d.phone || phoneDigits(bindPhone));
        setS((prev) => ({
          ...prev,
          auth: {
            ...prev.auth,
            phone: d.phone || phoneDigits(bindPhone),
            loggedIn: true,
          },
        }));
      }
      toastMsg("Телефон привязан");
      closeBindModal();
    } catch (e) {
      setBindErr(e.message || "Неверный код");
    } finally {
      setBindLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwErr("");
    setPwLoading(true);
    try {
      const d = await SHApi.changePassword(oldPassword, newPassword);
      if (d?.token) applySession(d);
      setOldPassword("");
      setNewPassword("");
      setPwOpen(false);
      setPasswordSet(true);
      toastMsg("Пароль обновлён");
    } catch (e) {
      setPwErr(e.message || "Не удалось сменить пароль");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="profile-scene">
      <div className="profile-scene__bg" aria-hidden="true" />
      <div className="topbar profile-scene__top settings-topbar">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={() => navigate("/profile")}>
          <Icon name="arrowL" size={20} />
        </button>
        <div className="topbar__actions">
          <SyncBadge />
        </div>
        <div className="topbar__title settings-topbar__title">
          <h1>Настройки</h1>
        </div>
      </div>

      <div className="card section settings-page__card">
        <div className="settings-account">
          <div className="settings-account__title">Аккаунт</div>
          {loadingAccount ? (
            <p className="field-hint">Загружаем данные…</p>
          ) : (
            <>
              <div className="settings-row">
                <span className="settings-row__label"><Icon name="user" size={16} /> Логин</span>
                <span className="settings-row__value">{username || "—"}</span>
              </div>
              {phone ? (
                <div className="settings-row">
                  <span className="settings-row__label"><Icon name="phone" size={16} /> Телефон</span>
                  <span className="settings-row__value">{formatPhoneDisplay(phone)}</span>
                </div>
              ) : (
                <div className="settings-bind-cta">
                  <p className="field-hint">
                    Телефон не привязан. Можно добавить по коду в WhatsApp — тогда вход будет и по номеру.
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => { setBindOpen(true); setBindErr(""); }}
                  >
                    <Icon name="phone" size={18} /> Привязать телефон
                  </button>
                </div>
              )}
            </>
          )}

          {passwordSet ? (
            <div className="settings-password-wrap">
              <button
                type="button"
                className={`btn btn--ghost btn--icon${pwOpen ? " is-active" : ""}`}
                aria-expanded={pwOpen}
                onClick={() => {
                  if (pwOpen) {
                    setPwOpen(false);
                    setPwErr("");
                    setOldPassword("");
                    setNewPassword("");
                  } else {
                    setPwOpen(true);
                    setPwErr("");
                  }
                }}
              >
                <Icon name="lock" size={18} /> {pwOpen ? "Смена пароля" : "Сменить пароль"}
              </button>
              <div className={`settings-password-panel${pwOpen ? " is-open" : ""}`} aria-hidden={!pwOpen}>
                <div className="settings-password-panel__inner">
                  <div className="settings-password">
                    <div className="label" style={{ marginTop: 0 }}>Текущий пароль</div>
                    <PasswordField
                      autoComplete="current-password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      disabled={!pwOpen}
                    />
                    <div className="label">Новый пароль</div>
                    <PasswordField
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={!pwOpen}
                    />
                    <p className="field-hint">Минимум 8 символов, буквы и цифры.</p>
                    {pwErr ? <p className="auth-err small">{pwErr}</p> : null}
                    <div className="settings-password__actions">
                      <button
                        type="button"
                        className="btn btn--icon"
                        disabled={pwLoading || !oldPassword || !newPassword}
                        onClick={handleChangePassword}
                        tabIndex={pwOpen ? 0 : -1}
                      >
                        <Icon name="check" size={18} /> Сохранить
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={pwLoading}
                        onClick={() => { setPwOpen(false); setPwErr(""); setOldPassword(""); setNewPassword(""); }}
                        tabIndex={pwOpen ? 0 : -1}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="field-hint">Пароль не задан — вход только по коду на телефон.</p>
          )}
        </div>

        <label className={`settings-toggle${remindersOn ? " is-on" : ""}`}>
          <span className="settings-toggle__copy">
            <Icon name="clock" size={18} color="var(--orange)" />
            <span className="settings-toggle__text">
              <strong>Напоминания о тренировках</strong>
              <small>Пуш перед занятием по расписанию</small>
            </span>
          </span>
          <input
            type="checkbox"
            className="settings-toggle__input"
            checked={remindersOn}
            onChange={async (e) => {
              const on = await toggleReminders(e.target.checked, toastMsg);
              setRemindersOn(on);
            }}
          />
          <span className="settings-toggle__track" aria-hidden="true">
            <span className="settings-toggle__thumb" />
          </span>
        </label>

        <Link to="/parent" className="btn btn--ghost btn--icon" style={{ textDecoration: "none" }}>
          <Icon name="team" size={18} color="var(--primary)" /> Режим для родителя
        </Link>

        <button
          type="button"
          className="btn btn--danger"
          onClick={() => { logout(); navigate("/auth"); }}
        >
          Выйти из аккаунта
        </button>
      </div>

      <Modal
        open={bindOpen}
        onClose={closeBindModal}
        title={<><Icon name="phone" size={18} /> Привязать телефон</>}
      >
        <p className="field-hint" style={{ marginTop: 0 }}>
          Код придёт в WhatsApp. После подтверждения номер привяжется к аккаунту.
        </p>
        <div className="label">Номер телефона</div>
        <input
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 700 123 45 67"
          value={formatPhoneMask(bindPhone)}
          onChange={(e) => {
            setBindPhone(phoneDigits(e.target.value));
            if (bindSent) {
              setBindSent(false);
              setBindCode("");
            }
          }}
          disabled={bindLoading}
        />
        {bindSent ? (
          <>
            <div className="label">Код из WhatsApp</div>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={8}
              value={bindCode}
              onChange={(e) => setBindCode(e.target.value.replace(/\D+/g, ""))}
              disabled={bindLoading}
            />
            {bindErr ? <p className="auth-err small">{bindErr}</p> : null}
            <div className="settings-password__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--icon"
                disabled={bindLoading || bindCode.length < 4}
                onClick={handleConfirmBind}
              >
                <Icon name="check" size={18} /> Привязать
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={bindLoading || resendIn > 0}
                onClick={handleSendBindCode}
              >
                {resendIn > 0 ? `Ещё раз (${resendIn})` : "Отправить снова"}
              </button>
            </div>
          </>
        ) : (
          <>
            {bindErr ? <p className="auth-err small">{bindErr}</p> : null}
            <div className="settings-password__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--icon"
                disabled={bindLoading || !phoneReady(bindPhone)}
                onClick={handleSendBindCode}
              >
                <Icon name="check" size={18} /> Получить код
              </button>
              <button type="button" className="btn btn--ghost" disabled={bindLoading} onClick={closeBindModal}>
                Отмена
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
