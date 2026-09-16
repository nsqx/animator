/**
 * cubic-bezier easing generator
 * takes control points (x1, y1); (x2, y2) and returns a function f
 * f: time t | [0,1] -> position x | [0,1]
 */
export function createCubicBezier(x1, y1, x2, y2) {
	// linear curve returns identity
	if (x1 === y1 && x2 === y2) return x => x;

	if (!(x1 >= 0 && x1 <= 1) || !(x2 >= 0 && x2 <= 1))
		throw new RangeError('control point x-coordinates must be x | [0,1]');

	// polynomial coefficients for function r(t)=<x(t),y(t)>
	// derived from cubic bezier control points with r(0)=<0,0> and r(1)=<1,1>

	// x(t) = ax * t^3 + bx * t^2 + cx * t
	const ax = 1.0 - 3.0 * x2 + 3.0 * x1;
	const bx = 3.0 * x2 - 6.0 * x1;
	const cx = 3.0 * x1;
	const X = t => ((ax * t + bx) * t + cx) * t;

	// y(t) = ay * t^3 + by * t^2 + cy * t
	const ay = 1.0 - 3.0 * y2 + 3.0 * y1;
	const by = 3.0 * y2 - 6.0 * y1;
	const cy = 3.0 * y1;
	const Y = t => ((ay * t + by) * t + cy) * t;

	// derivative dx/dt: d/dt [ax * t^3 + bx * t^2 + cx * t]
	const dx_dt = t => (3.0 * ax * t + 2.0 * bx) * t + cx;

	// get t(x) from x(t)
	function solveX(x) {
		let t = x; // initial guess

		// newton's method
		for (let i = 0; i < 8; i++) {
			const slope = dx_dt(t);
			if (Math.abs(slope) < 1e-6) break; // cannot divide by ~ 0; use binary search

			const xOffset = X(t) - x;
			if (Math.abs(xOffset) < 1e-7) return t;

			t = Math.min(Math.max(t - xOffset / slope, 0), 1);
		}

		// binary search fallback
		let a = 0.0,
			b = 1.0;
		t = x;
		for (let i = 0; i < 16; i++) {
			const xOffset = X(t) - x;
			if (Math.abs(xOffset) < 1e-7) return t;
			if (xOffset > 0) {
				b = t;
			} else {
				a = t;
			}
			t = (a + b) / 2.0;
		}
		return t;
	}

	return function solve(x) {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		return Y(solveX(x)); // evaluate y(t) from time x
	};
}

export const CUBIC_BEZIER_PRESETS = Object.freeze({
	linear: t => t,
	ease: createCubicBezier(0.25, 0.1, 0.25, 1.0),
	easeIn: createCubicBezier(0.42, 0.0, 1.0, 1.0),
	easeOut: createCubicBezier(0.0, 0.0, 0.58, 1.0),
	easeInOut: createCubicBezier(0.42, 0.0, 0.58, 1.0),
});

export class Animator {
	#raf = null;
	#startTime = 0;
	#pausedAt = 0;
	#elapsed = 0;
	#iteration = 0;
	#state = 'idle'; // 'idle' | 'running' | 'paused' | 'finished'
	#resolveFinished = null;
	#easing = CUBIC_BEZIER_PRESETS.linear;

	duration;
	loop;
	onStart;
	onUpdate;
	onPause;
	onComplete;
	onLoop;
	finished = Promise.resolve();

	constructor(options = {}) {
		this.duration = options.duration ?? 1000;
		this.loop = options.loop ?? false;
		this.onStart = options.onStart ?? (() => {});
		this.onUpdate = options.onUpdate ?? (() => {});
		this.onPause = options.onPause ?? (() => {});
		this.onComplete = options.onComplete ?? (() => {});
		this.onLoop = options.onLoop ?? (() => {});
		this.#easing = options.easing ?? CUBIC_BEZIER_PRESETS.linear;

		this.#resetState();
	}

	get easing() {
		return this.#easing;
	}

	set easing(v) {
		this.#easing = typeof v === 'function' ? v : CUBIC_BEZIER_PRESETS.linear;
	}

	get isPlaying() {
		return this.#state === 'running';
	}

	get state() {
		return this.#state;
	}

	get progress() {
		if (this.duration <= 0) return 1;
		return Math.min(Math.max(this.#elapsed / this.duration, 0), 1);
	}

	#resetState() {
		this.#state = 'idle';
		this.#elapsed = 0;
		this.#iteration = 0;
		this.#startTime = 0;
		this.#pausedAt = 0;
		if (this.#raf) cancelAnimationFrame(this.#raf);

		this.finished = new Promise(resolve => {
			this.#resolveFinished = resolve;
		});
	}

	#tick = now => {
		if (this.#state !== 'running') return;

		this.#elapsed = now - this.#startTime;
		const rawProgress =
			this.duration <= 0 ? 1 : Math.min(Math.max(this.#elapsed / this.duration, 0), 1);
		const easedProgress = this.#easing(rawProgress);

		this.onUpdate(easedProgress, rawProgress);

		if (rawProgress >= 1) {
			const maxLoops = typeof this.loop === 'number' ? this.loop : Infinity;

			if (this.loop && this.#iteration < maxLoops - 1) {
				this.#iteration++;
				const overshoot = this.#elapsed - this.duration;
				this.#startTime = now - overshoot;
				this.#elapsed = overshoot;
				this.onLoop(this);
				this.#raf = requestAnimationFrame(this.#tick);
			} else {
				this.#elapsed = this.duration;
				this.stop();
			}
		} else {
			this.#raf = requestAnimationFrame(this.#tick);
		}
	};

	play() {
		if (this.#state === 'running') return this;
		const now = performance.now();

		if (this.#state === 'idle' || this.#state === 'finished') {
			let initialElapsed = this.#elapsed;
			if (this.#state === 'finished') {
				this.#resetState();
			}
			if (initialElapsed >= this.duration) {
				initialElapsed = 0;
			}
			this.#state = 'running';
			this.#elapsed = initialElapsed;
			this.#startTime = now - initialElapsed;
			this.onStart(this);
		} else if (this.#state === 'paused') {
			this.#state = 'running';
			this.#startTime = now - this.#elapsed;
		}

		this.#raf = requestAnimationFrame(this.#tick);
		return this;
	}

	pause() {
		if (this.#state !== 'running') return this;

		const now = performance.now();
		this.#elapsed = now - this.#startTime;
		this.#state = 'paused';
		this.#pausedAt = now;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.onPause(this);
		return this;
	}

	stop() {
		if (this.#state === 'idle' || this.#state === 'finished') return this;

		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#state = 'finished';
		this.onComplete(this);

		if (this.#resolveFinished) {
			this.#resolveFinished(this);
			this.#resolveFinished = null;
		}
		return this;
	}

	reset() {
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#resetState();
		this.onUpdate(this.#easing(0), 0);
		return this;
	}

	seek(progressRatio) {
		const clamped = Math.min(Math.max(progressRatio, 0), 1);
		this.#elapsed = clamped * this.duration;
		const now = performance.now();

		if (this.#state === 'running') {
			this.#startTime = now - this.#elapsed;
		} else if (this.#state === 'paused') {
			this.#pausedAt = now;
			this.#startTime = now - this.#elapsed;
		}

		const eased = this.#easing(clamped);
		this.onUpdate(eased, clamped);
		return this;
	}
}
