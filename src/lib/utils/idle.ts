/**
 * requestIdleCallback / cancelIdleCallback with safe fallbacks.
 *
 * WebKit on older macOS (pre-Safari 16.4) and some test environments do
 * not provide these. The fallback uses setTimeout/clearTimeout which is
 * good enough for a "do this when the browser is idle" heuristic.
 */
type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleRequestCallback = (deadline: IdleDeadline) => void;

const ric: (cb: IdleRequestCallback, opts?: { timeout?: number }) => number =
  typeof globalThis !== 'undefined' &&
  (globalThis as { requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout?: number }) => number })
    .requestIdleCallback
    ? (globalThis as { requestIdleCallback: (cb: IdleRequestCallback, opts?: { timeout?: number }) => number })
        .requestIdleCallback.bind(globalThis)
    : (cb, opts) => {
        const id = setTimeout(
          () => cb({ didTimeout: false, timeRemaining: () => 50 }),
          0,
        );
        return id as unknown as number;
      };

const cic: (id: number) => void =
  typeof globalThis !== 'undefined' &&
  (globalThis as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
    ? (globalThis as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback.bind(globalThis)
    : (id) => {
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
      };

export const requestIdleCallbackShim = ric;
export const cancelIdleCallbackShim = cic;
