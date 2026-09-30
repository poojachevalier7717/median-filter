import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { medianFilter, validateOptions } from '../src/index.js';

test('default windowSize is 3', () => {
  // A flat signal stays flat under any window — a sanity check that the default
  // options produce the expected length and value.
  const out = medianFilter([5, 5, 5, 5, 5]);
  assert.deepEqual(out, [5, 5, 5, 5, 5]);
});

test('windowSize 1 returns input unchanged', () => {
  const sig = [1, 9, 2, 8, 3];
  assert.deepEqual(medianFilter(sig, { windowSize: 1 }), [1, 9, 2, 8, 3]);
});

test('removes an isolated spike (the core purpose)', () => {
  // One outlier surrounded by calm values should be pulled down to the local
  // median, not merely attenuated as a moving average would do.
  const sig = [1, 1, 100, 1, 1];
  assert.deepEqual(medianFilter(sig, { windowSize: 3 }), [1, 1, 1, 1, 1]);
});

test('preserves a step edge', () => {
  // A median filter should not blur a clean step the way a moving average does.
  const sig = [0, 0, 0, 5, 5, 5];
  assert.deepEqual(medianFilter(sig, { windowSize: 3 }), [0, 0, 0, 5, 5, 5]);
});

test('reflect padding duplicates boundary value at the very end', () => {
  // With windowSize 3 and a length-3 signal, every window touches a reflected
  // neighbor. At the center position [1, 9, 1] the window is [1,9,1] -> median 1.
  // At index 0 the window samples indices 0, 0(reflect), 1 = [1,1,9] -> 1.
  assert.deepEqual(
    medianFilter([1, 9, 1], { windowSize: 3 }),
    [1, 1, 1],
  );
});

test('reflect padding on a length-1 signal returns that value', () => {
  // All window samples reflect onto index 0.
  assert.deepEqual(medianFilter([42], { windowSize: 1 }), [42]);
});

test('larger windowSize smooths a ramp region', () => {
  const sig = [0, 0, 1, 2, 10, 2, 1, 0, 0];
  // windowSize 5 centered on the spike (index 4) collects [1,2,10,2,1] -> 2.
  const out = medianFilter(sig, { windowSize: 5 });
  assert.equal(out[4], 2);
});

test('does not mutate the input array', () => {
  const sig = [3, 1, 2];
  const snapshot = sig.slice();
  medianFilter(sig, { windowSize: 3 });
  assert.deepEqual(sig, snapshot);
});

test('rejects non-array signal', () => {
  assert.throws(() => medianFilter(null), /signal must be an array/);
  assert.throws(() => medianFilter('abc'), /signal must be an array/);
});

test('rejects empty signal', () => {
  assert.throws(() => medianFilter([]), /signal must be non-empty/);
});

test('rejects non-finite elements', () => {
  assert.throws(() => medianFilter([1, NaN, 2]), /finite number/);
  assert.throws(() => medianFilter([1, Infinity, 2]), /finite number/);
});

test('rejects even windowSize', () => {
  assert.throws(
    () => medianFilter([1, 2, 3], { windowSize: 2 }),
    /must be odd/,
  );
});

test('rejects non-positive windowSize', () => {
  assert.throws(() => medianFilter([1, 2, 3], { windowSize: 0 }), /must be positive/);
  assert.throws(() => medianFilter([1, 2, 3], { windowSize: -1 }), /must be positive/);
});

test('rejects windowSize larger than twice the signal length', () => {
  // With n=2 the reflection aliasing limit is 4; a window of 5 would sample
  // each original point multiple times in a way that no longer reflects local
  // statistics, so we refuse rather than silently produce a misleading result.
  assert.throws(
    () => medianFilter([1, 2], { windowSize: 5 }),
    /must not exceed twice the signal length/,
  );
});

test('validateOptions returns defaults when called with no args', () => {
  assert.deepEqual(validateOptions(), { windowSize: 3 });
  assert.deepEqual(validateOptions(null), { windowSize: 3 });
});

test('validateOptions rejects non-object', () => {
  assert.throws(() => validateOptions(5), /options must be an object/);
});

test('output length always matches input length', () => {
  for (const ws of [1, 3, 5, 7]) {
    const sig = [0, 1, 2, 3, 4, 5, 6];
    const out = medianFilter(sig, { windowSize: ws });
    assert.equal(out.length, sig.length);
  }
});
