import { lazy, Suspense, useState } from "react";
import { EXERCISE_TYPES } from "../../domain/exercise/index.js";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";

const CameraWorkoutOverlay = lazy(() => import("./CameraWorkoutOverlay.jsx"));

export function CameraWorkoutEntry({ onFinished }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeType, setActiveType] = useState(null);

  const openType = (type) => {
    setPickerOpen(false);
    setActiveType(type);
  };

  const closeOverlay = (result) => {
    setActiveType(null);
    if (result && onFinished) onFinished(result);
  };

  return (
    <>
      <button
        type="button"
        className="btn skills-camera-cta"
        onClick={() => setPickerOpen(true)}
      >
        <Icon name="dumbbell" size={18} />
        Тренировка с камерой
      </button>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Выбери упражнение"
        sheetClass="modal__sheet--exercise"
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Камера считает повторы на устройстве. Видео никуда не отправляется.
          За повтор — 2 XP, лимит 60 XP в день.
        </p>
        <div className="exercise-pick">
          {Object.values(EXERCISE_TYPES).map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="exercise-pick__btn"
              onClick={() => openType(ex.id)}
            >
              <span className="exercise-pick__ico">
                <Icon name={ex.id === "squat" ? "endurance" : "strength"} size={22} />
              </span>
              <span className="exercise-pick__text">
                <strong>{ex.name}</strong>
                <small>{ex.tip}</small>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {activeType ? (
        <Suspense
          fallback={(
            <div className="exercise-overlay exercise-overlay--loading" role="status">
              Загрузка камеры…
            </div>
          )}
        >
          <CameraWorkoutOverlay exerciseType={activeType} onClose={closeOverlay} />
        </Suspense>
      ) : null}
    </>
  );
}
