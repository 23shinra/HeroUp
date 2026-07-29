import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <main className="screen" style={{ padding: "20px 16px 90px", maxWidth: 720 }}>
      <h1>Правила использования</h1>
      <p>LevelUp — игровая мотивация для детских спортивных секций. Регистрация ребёнка возможна только с согласия родителя.</p>
      <p>Запрещены оскорбления, чужие аккаунты и попытки обойти систему посещаемости. Тренер может удалить участника из гильдии.</p>
      <p><Link to="/auth">Вернуться к регистрации</Link></p>
    </main>
  );
}
