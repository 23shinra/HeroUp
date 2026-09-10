/**
 * Steps through a battle log with timed delays, adjustable speed, and skip.
 */
export class BattlePlaybackEngine {
  /**
   * @param {object} options
   * @param {Array} options.log - Battle log entries from simulateBattle
   * @param {number} [options.baseMs=650] - Base delay between log lines at 1× speed
   * @param {(step: number, line: object|null) => void} [options.onStep]
   * @param {(phase: string) => void} [options.onPhase]
   * @param {() => void} [options.onComplete]
   */
  constructor({ log = [], baseMs = 650, onStep, onPhase, onComplete } = {}) {
    this.log = log;
    this.baseMs = baseMs;
    this.onStep = onStep;
    this.onPhase = onPhase;
    this.onComplete = onComplete;
    this._timer = null;
    this._step = -1;
    this._running = false;
    this._speed = 1;
  }

  get step() {
    return this._step;
  }

  get running() {
    return this._running;
  }

  get speed() {
    return this._speed;
  }

  set speed(v) {
    this._speed = Math.max(0.5, Math.min(4, v));
  }

  start() {
    if (this._running || !this.log.length) return;
    this._running = true;
    this._step = 0;
    this.onPhase?.("playing");
    this.onStep?.(0, this.log[0] ?? null);
    this._scheduleNext();
  }

  stop() {
    clearTimeout(this._timer);
    this._timer = null;
    this._running = false;
    this.onPhase?.("stopped");
  }

  /** Skip to the end, firing every remaining step synchronously. */
  skip() {
    clearTimeout(this._timer);
    this._timer = null;
    if (!this._running) return;
    while (this._step < this.log.length - 1) {
      this._step += 1;
      this.onStep?.(this._step, this.log[this._step] ?? null);
    }
    this._running = false;
    this.onPhase?.("complete");
    this.onComplete?.();
  }

  destroy() {
    this.stop();
    this.onStep = null;
    this.onPhase = null;
    this.onComplete = null;
  }

  _scheduleNext() {
    const delay = Math.max(60, Math.round(this.baseMs / this._speed));
    this._timer = setTimeout(() => {
      this._step += 1;
      if (this._step >= this.log.length) {
        this._running = false;
        this.onPhase?.("complete");
        this.onComplete?.();
        return;
      }
      this.onStep?.(this._step, this.log[this._step] ?? null);
      this._scheduleNext();
    }, delay);
  }
}
