import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Front-camera stream lifecycle. Starts only when start() is called (user gesture).
 */
export function useCameraStream({ facingMode = "user" } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | starting | live | denied | unsupported | error
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* ignore */ }
      });
    }
    const video = videoRef.current;
    if (video) {
      try { video.srcObject = null; } catch { /* ignore */ }
    }
    setStatus((s) => (s === "live" || s === "starting" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("Камера не поддерживается в этом браузере");
      return null;
    }
    stop();
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        try { await video.play(); } catch { /* autoplay race */ }
      }
      setStatus("live");
      return stream;
    } catch (e) {
      const name = e && e.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
        setError("Нет доступа к камере — разреши в настройках браузера");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setStatus("unsupported");
        setError("Камера не найдена на устройстве");
      } else {
        setStatus("error");
        setError((e && e.message) || "Не удалось открыть камеру");
      }
      return null;
    }
  }, [facingMode, stop]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, error, start, stop, streamRef };
}
