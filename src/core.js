/**
 * Median filter for one-dimensional signals.
 *
 * A median filter slides a window of fixed size across the input signal. At each
 * position, the output value is the median of all values currently inside the
 * window. Unlike a moving average, a median filter preserves sharp edges (step
 * changes) while removing isolated spikes — a single outlier inside the window
 * has no effect on the median, whereas it would shift a mean noticeably.
 *
 * Edge handling: this implementation uses "reflect" padding. When the window
 * extends past either end of the signal, we mirror values back from inside.
 * Reflect (a.k.a. half-sample symmetric) padding is chosen over zero-padding
 * because zero-padding introduces artificial discontinuities at the boundaries
 * that manifest as filter artifacts, and over "nearest" padding because reflect
 * better preserves local statistics near the edges. The reflection is
 * half-sample: index -1 maps to 0, -2 maps to 1, and similarly on the far end,
 * so index n maps to n-1, n+1 maps to n-2.
 *
 * Window size must be a positive odd integer. An even window has no single
 * center sample, which makes the alignment ambiguous; we refuse it rather than
 * pick silently. A window of 1 returns the input unchanged.
 */

/**
 * Validate filter options and return a normalized copy.
 *
 * @param {object} [opts]
 * @param {number} [opts.windowSize=3] - Odd positive integer.
 * @returns {{windowSize: number}}
 * @throws {TypeError} if opts is present but not an object.
 * @throws {RangeError} if windowSize is not a finite, positive, odd integer.
 */
export function validateOptions(opts) {
  const out = { windowSize: 3 };
  if (opts === undefined || opts === null) return out;
  if (typeof opts !== 'object') {
    throw new TypeError('options must be an object');
  }
  if (opts.windowSize !== undefined) {
    const ws = opts.windowSize;
    if (typeof ws !== 'number' || !Number.isFinite(ws)) {
      throw new RangeError('windowSize must be a finite number');
    }
    // Bitwise check for integer: works only for values in the safe 32-bit range,
    // which is far beyond any realistic window size.
    if ((ws | 0) !== ws) {
      throw new RangeError('windowSize must be an integer');
    }
    if (ws <= 0) {
      throw new RangeError('windowSize must be positive');
    }
    if (ws % 2 === 0) {
      throw new RangeError('windowSize must be odd');
    }
    out.windowSize = ws;
  }
  return out;
}

/**
 * Map an index that may fall outside [0, n) back into range via half-sample
 * reflection. n must be at least 1.
 *
 * Half-sample reflection maps the sequence of indices ..., -2, -1, 0, 1, ... to
 * ..., 1, 0, 0, 1, ... — so the boundary value is effectively duplicated. This
 * is the most common convention in image/signal processing libraries.
 */
function reflectIndex(i, n) {
  // Bring i into the range [0, 2n) using modular arithmetic, then fold.
  const period = 2 * n;
  let m = i % period;
  if (m < 0) m += period; // JS % can be negative; normalize to [0, period)
  if (m >= n) m = period - 1 - m; // mirror the upper half
  return m;
}

/**
 * Compute the median of a sorted array slice. The slice MUST already be sorted
 * ascending. Because the caller sorts in place, we avoid an extra copy.
 *
 * @param {number[]} sorted - in-place sorted values
 * @param {number} len - number of valid elements from index 0
 * @returns {number}
 */
function medianOfSorted(sorted, len) {
  if (len === 0) return NaN; // defensive; should not occur for windowSize >= 1
  const mid = len >> 1; // floor(len / 2)
  if (len % 2 === 1) return sorted[mid];
  // Even length only reachable if called with an even-sized collection; the
  // public API forbids even window sizes, but we average anyway for safety so
  // the function is total and reusable.
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Apply a sliding-window median filter to a 1-D numeric signal.
 *
 * @param {number[]} signal - Input values. Must be non-empty.
 * @param {object} [opts] - Optional configuration.
 * @param {number} [opts.windowSize=3] - Odd positive integer.
 * @returns {number[]} Filtered signal, same length as input.
 * @throws {TypeError} if signal is not an array or is empty.
 * @throws {TypeError} if any element is not a finite number.
 * @throws {RangeError} if windowSize exceeds twice the signal length (the
 *   reflection would alias a sample onto itself in a way that produces
 *   meaningless output).
 */
export function medianFilter(signal, opts) {
  if (!Array.isArray(signal)) {
    throw new TypeError('signal must be an array');
  }
  const n = signal.length;
  if (n === 0) {
    throw new TypeError('signal must be non-empty');
  }
  for (let i = 0; i < n; i++) {
    const v = signal[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new TypeError('signal[' + i + '] must be a finite number');
    }
  }

  const { windowSize } = validateOptions(opts);

  if (windowSize > 2 * n) {
    throw new RangeError(
      'windowSize (' + windowSize + ') must not exceed twice the signal length (' + (2 * n) + ')',
    );
  }

  const half = windowSize >> 1; // floor(windowSize / 2)
  const result = new Array(n);
  // Reusable scratch buffer for collecting window values before sorting. We
  // allocate once and overwrite per position to avoid per-sample allocation.
  const window = new Array(windowSize);

  for (let c = 0; c < n; c++) {
    // Collect windowSize samples centered at c, reflecting at the boundaries.
    for (let k = 0; k < windowSize; k++) {
      const src = reflectIndex(c - half + k, n);
      window[k] = signal[src];
    }
    // Sort ascending. Array.prototype.sort with a numeric comparator is stable
    // and correct for finite numbers. We copy first to avoid mutating signal.
    const sorted = window.slice().sort((a, b) => a - b);
    result[c] = medianOfSorted(sorted, windowSize);
  }

  return result;
}
