/**
 * Steps through a battle log with timed delays and phase callbacks.
 */
export class BattlePlaybackEngine {
  /**
   * @param {object} options
   * @param {Array} options.log - Battle log entries from simulateBattle
   * @param {number} [options.stepMs=650] - Delay between log lines
   * @param {(step: number, line: object|null) => void} [options.onStep]
   * @param {(phase: string) => void} [options.onPhase]
   * @param {() => void} [options.onComplete]
   */
  constructor({ log = [], stepMs = 650, onStep, onPhase, onComplete } = {}) {
    this.log = log;
    this.stepMs = stepMs;
    this.onStep = onStep;
    this.onPhase = onPhase;
    this.onComplete = onComplete;
    this._timer = null;
    this._step = 0;
    this._running = false;
  }

  get step() {
    return this._step;
  }

  get running() {
    return this._running;
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

  destroy() {
    this.stop();
    this.onStep = null;
    this.onPhase = null;
    this.onComplete = null;
  }

  _scheduleNext() {
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
    }, this.stepMs);
  }
}
