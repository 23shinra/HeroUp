import { useState } from "react";
import { Icon } from "./Icon.jsx";

export function PasswordField({
  id,
  value,
  onChange,
  placeholder = "Пароль",
  autoComplete = "current-password",
  className = "input",
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        className={className}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <button
        type="button"
        className={`password-toggle${visible ? " is-on" : ""}`}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} />
      </button>
    </div>
  );
}
