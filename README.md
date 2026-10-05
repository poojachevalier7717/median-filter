# median-filter

A small, dependency-free TypeScript-ready JavaScript (ESM) library that applies a
sliding-window median filter to one-dimensional numeric signals for noise
reduction.

```js
import { medianFilter } from './src/index.js';

// Remove an isolated spike without blurring the surrounding step.
const clean = medianFilter([0, 0, 0, 50, 0, 0, 0], { windowSize: 3 });
// => [0, 0, 0, 0, 0, 0, 0]
```

Exports:
- `medianFilter(signal, opts?)` — returns a new filtered array; does not mutate
  the input.
- `validateOptions(opts?)` — parses and validates the options object; primarily
  exposed for callers that want to check configuration before filtering.

## Why this exists

A moving average smooths noise but also blurs sharp transitions and only
attenuates spikes rather than removing them. A median filter removes isolated
outliers entirely (a single outlier is never the median of its neighborhood)
and preserves step edges. The trade-off is that it is more expensive to compute
per sample — this implementation sorts each window independently, which is
simple and correct, and fine for the short signals it is intended for. It is
not optimized for very long signals or real-time streaming.

## Edge handling

The filter uses **half-sample reflection** at the boundaries: when a window
extends past either end, values are mirrored back from inside the signal so the
boundary value is effectively duplicated. This avoids the artificial
zero-padding discontinuities that would otherwise appear as filter artifacts at
the first and last samples.

`windowSize` must be a **positive odd integer**. An even window has no single
center sample, so alignment is ambiguous; the library rejects it rather than
silently pick one convention. Additionally, `windowSize` must not exceed **twice
the signal length**, because beyond that the reflection starts aliasing samples
in a way that no longer reflects local statistics and the output becomes
misleading.

## Testing

```
node --test
```

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

