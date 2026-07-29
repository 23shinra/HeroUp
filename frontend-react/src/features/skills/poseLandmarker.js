/** Lazy MediaPipe PoseLandmarker factory (on-device only). */

export async function createPoseLandmarker() {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks("/models/wasm");
  const opts = {
    baseOptions: {
      modelAssetPath: "/models/pose/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  try {
    return await PoseLandmarker.createFromOptions(vision, opts);
  } catch {
    opts.baseOptions.delegate = "CPU";
    return PoseLandmarker.createFromOptions(vision, opts);
  }
}

/** @deprecated use createPoseLandmarker — kept for clarity in imports */
export async function getPoseLandmarker() {
  return createPoseLandmarker();
}

/** MediaPipe pose connections for skeleton overlay. */
export const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22],
  [27, 29], [27, 31], [28, 30], [28, 32],
];

export function drawPoseSkeleton(ctx, landmarks, width, height, mirror = true) {
  if (!ctx || !landmarks?.length) return;
  const mapX = (x) => (mirror ? (1 - x) * width : x * width);
  const mapY = (y) => y * height;

  ctx.save();
  ctx.lineWidth = Math.max(2, width * 0.006);
  ctx.strokeStyle = "rgba(80, 220, 255, 0.85)";
  ctx.fillStyle = "rgba(255, 200, 80, 0.95)";

  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    const va = pa.visibility != null ? pa.visibility : 1;
    const vb = pb.visibility != null ? pb.visibility : 1;
    if (va < 0.4 || vb < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(mapX(pa.x), mapY(pa.y));
    ctx.lineTo(mapX(pb.x), mapY(pb.y));
    ctx.stroke();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    if (!p) continue;
    const v = p.visibility != null ? p.visibility : 1;
    if (v < 0.45) continue;
    ctx.beginPath();
    ctx.arc(mapX(p.x), mapY(p.y), Math.max(2.5, width * 0.008), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
