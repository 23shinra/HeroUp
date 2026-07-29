import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  computeExerciseXp,
  createExerciseCounter,
  EXERCISE_TYPES,
  newExerciseSessionId,
} from "../../domain/exercise/index.js";
import { Icon } from "../../components/Icon.jsx";
import { useCameraStream } from "../../hooks/useCameraStream.js";
import { useGameStore } from "../../stores/useGameStore.js";
import { drawPoseSkeleton, createPoseLandmarker } from "./poseLandmarker.js";

const PHASE_LABEL = {
  up: "Вверх",
  down: "Вниз",
};

export default function CameraWorkoutOverlay({ exerciseType, onClose }) {
  const completeExerciseSession = useGameStore((s) => s.completeExerciseSession);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const heroExercise = useGameStore((s) => s.S?.hero?.exercise);
  const meta = EXERCISE_TYPES[exerciseType] || EXERCISE_TYPES.squat;

  const { videoRef, status: camStatus, error: camError, start, stop } = useCameraStream();
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const landmarkerRef = useRef(null);
  const counterRef = useRef(null);
  const lastInferRef = useRef(0);
  const sessionIdRef = useRef(newExerciseSessionId());
  const finishingRef = useRef(false);

  const [modelStatus, setModelStatus] = useState("idle"); // idle | loading | ready | error
  const [modelError, setModelError] = useState(null);
  const [started, setStarted] = useState(false);
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState("up");
  const [readyBody, setReadyBody] = useState(false);
  const [bodyHint, setBodyHint] = useState("Встань целиком в кадр");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);

  const usedXpToday = useMemo(() => {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Almaty" });
    if (heroExercise?.lastDay === day) return Number(heroExercise.dayXp) || 0;
    return 0;
  }, [heroExercise]);

  const previewReward = useMemo(
    () => computeExerciseXp(reps, { usedXpToday }),
    [reps, usedXpToday],
  );

  useEffect(() => {
    counterRef.current = createExerciseCounter(exerciseType);
    setReps(0);
    setPhase("up");
    setReadyBody(false);
  }, [exerciseType]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    stopLoop();
    stop();
    const lm = landmarkerRef.current;
    landmarkerRef.current = null;
    if (lm && typeof lm.close === "function") {
      try { lm.close(); } catch { /* ignore */ }
    }
  }, [stop, stopLoop]);

  useEffect(() => () => cleanupAll(), [cleanupAll]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const counter = counterRef.current;
    if (!video || !canvas || !landmarker || !counter) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const now = performance.now();
    if (video.readyState >= 2 && now - lastInferRef.current >= 66) {
      lastInferRef.current = now;
      try {
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result?.landmarks?.[0];
        const ctx = canvas.getContext("2d");
        const w = canvas.width = video.videoWidth || 640;
        const h = canvas.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, w, h);
        if (landmarks) {
          drawPoseSkeleton(ctx, landmarks, w, h, true);
          const step = counter.step(landmarks, Date.now());
          setReps(step.reps);
          setPhase(step.phase);
          setReadyBody(step.ready);
          if (!step.ready) {
            const map = {
              no_pose: "Не вижу человека",
              partial: "Покажи плечи, бёдра и колени",
              torso: "Покажи корпус",
              legs: "Покажи колени",
              metric: "Поправь положение",
            };
            setBodyHint(map[step.reason] || "Покажи плечи и колени");
          } else {
            setBodyHint(PHASE_LABEL[step.phase] || "");
          }
        } else {
          setReadyBody(false);
          setBodyHint("Покажи плечи и колени");
        }
      } catch {
        /* skip bad frame */
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  const begin = async () => {
    setModelError(null);
    setModelStatus("loading");
    setStarted(true);
    try {
      const lm = await createPoseLandmarker();
      landmarkerRef.current = lm;
      setModelStatus("ready");
      const stream = await start();
      if (!stream) {
        setModelStatus("error");
        return;
      }
      stopLoop();
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setModelStatus("error");
      setModelError((e && e.message) || "Не удалось загрузить модель распознавания");
    }
  };

  const finish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    stopLoop();
    stop();
    const counted = counterRef.current?.reps || reps;
    try {
      if (counted <= 0) {
        setSummary({
          reps: 0,
          acceptedReps: 0,
          xpAwarded: 0,
          remainingXp: Math.max(0, 60 - usedXpToday),
          queued: false,
          zero: true,
        });
        return;
      }
      const result = await completeExerciseSession({
        sessionId: sessionIdRef.current,
        exerciseType,
        reps: counted,
      });
      setSummary({
        reps: counted,
        acceptedReps: result.acceptedReps ?? counted,
        xpAwarded: result.xpAwarded || 0,
        remainingXp: result.remainingXp,
        queued: !!result.queued,
        already: !!result.already,
        leveled: result.leveled || 0,
      });
      if (result.queued) {
        toastMsg("Офлайн: опыт начислится при появлении сети");
      } else if (result.xpAwarded > 0) {
        toastMsg(`+${result.xpAwarded} XP за тренировку`);
      } else if (result.remainingXp === 0) {
        toastMsg("Дневной лимит камерных тренировок исчерпан");
      }
    } catch (e) {
      toastMsg(e.message || "Не удалось сохранить тренировку");
      finishingRef.current = false;
      setSubmitting(false);
      // resume camera if still mounted
      if (camStatus === "live" || modelStatus === "ready") {
        try {
          await start();
          rafRef.current = requestAnimationFrame(loop);
        } catch { /* ignore */ }
      }
      return;
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = () => {
    cleanupAll();
    onClose?.(null);
  };

  const closeSummary = () => {
    cleanupAll();
    onClose?.(summary);
  };

  const statusLine = (() => {
    if (summary) return null;
    if (!started) return "Нажми «Старт», чтобы включить камеру";
    if (modelStatus === "loading") return "Загрузка модели…";
    if (modelStatus === "error") return modelError || "Ошибка модели";
    if (camStatus === "starting") return "Открываем камеру…";
    if (camStatus === "denied" || camStatus === "unsupported" || camStatus === "error") {
      return camError || "Камера недоступна";
    }
    if (!readyBody) return bodyHint;
    return bodyHint || PHASE_LABEL[phase];
  })();

  return createPortal(
    <div className="exercise-overlay" role="dialog" aria-modal="true" aria-label={meta.name}>
      <div className="exercise-overlay__top">
        <button type="button" className="icon-btn" onClick={summary ? closeSummary : cancel} aria-label="Закрыть">
          <Icon name="close" size={18} />
        </button>
        <div className="exercise-overlay__title">
          <strong>{meta.name}</strong>
          <small>2 XP / повтор · лимит 60 XP/день</small>
        </div>
        <div className="exercise-overlay__xp">
          <span>{previewReward.xp}</span>
          <small>XP</small>
        </div>
      </div>

      <div className="exercise-stage">
        <video
          ref={videoRef}
          className="exercise-stage__video"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="exercise-stage__canvas" aria-hidden="true" />
        {!started && (
          <div className="exercise-stage__intro">
            <p>{meta.tip}</p>
            <p className="muted">Распознавание только на устройстве. Видео не записывается и не отправляется.</p>
            <button type="button" className="btn" onClick={begin}>
              <Icon name="dumbbell" size={16} /> Старт
            </button>
          </div>
        )}
        {started && (modelStatus === "loading" || camStatus === "starting") && (
          <div className="exercise-stage__intro" role="status">Загрузка…</div>
        )}
        {(camStatus === "denied" || camStatus === "unsupported" || camStatus === "error" || modelStatus === "error") && (
          <div className="exercise-stage__intro">
            <p>{camError || modelError}</p>
            <button type="button" className="btn" onClick={begin}>Повторить</button>
          </div>
        )}
        {summary && (
          <div className="exercise-stage__intro exercise-stage__summary">
            <h2>{summary.zero ? "Без повторов" : "Тренировка завершена"}</h2>
            <p>
              Повторы: <b>{summary.acceptedReps ?? summary.reps}</b>
              {summary.reps != null && summary.acceptedReps != null && summary.acceptedReps < summary.reps
                ? ` (из ${summary.reps}, лимит)`
                : ""}
            </p>
            <p>
              Опыт: <b>+{summary.xpAwarded || 0} XP</b>
              {typeof summary.remainingXp === "number" ? ` · осталось сегодня ${summary.remainingXp}` : ""}
            </p>
            {summary.queued ? <p className="muted">Сессия в очереди — начислим XP при сети.</p> : null}
            <button type="button" className="btn" onClick={closeSummary}>Готово</button>
          </div>
        )}
      </div>

      {!summary && (
        <div className="exercise-overlay__hud">
          <div className={`exercise-pill${readyBody ? " is-ok" : ""}`}>{statusLine}</div>
          <div className="exercise-reps" aria-live="polite">
            <span className="exercise-reps__n">{reps}</span>
            <span className="exercise-reps__l">повторов</span>
          </div>
          <div className="exercise-overlay__actions">
            <button type="button" className="btn btn--ghost" onClick={cancel} disabled={submitting}>
              Отмена
            </button>
            <button
              type="button"
              className="btn"
              onClick={finish}
              disabled={!started || submitting || modelStatus === "loading"}
            >
              {submitting ? "Сохранение…" : "Завершить"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
