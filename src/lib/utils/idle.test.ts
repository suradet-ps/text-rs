import { describe, it, expect, vi } from 'vitest';
import { requestIdleCallbackShim, cancelIdleCallbackShim } from './idle';

describe('idle shim', () => {
  it('invokes the callback with a deadline-like object', async () => {
    const cb = vi.fn();
    requestIdleCallbackShim(cb, { timeout: 50 });
    await new Promise((r) => setTimeout(r, 60));
    expect(cb).toHaveBeenCalledOnce();
    const arg = cb.mock.calls[0]?.[0] as { didTimeout: boolean; timeRemaining: () => number } | undefined;
    expect(arg?.didTimeout).toBe(false);
    expect(typeof arg?.timeRemaining()).toBe('number');
  });

  it('cancelIdleCallbackShim does not throw and prevents the callback', async () => {
    const cb = vi.fn();
    const id = requestIdleCallbackShim(cb, { timeout: 50 });
    cancelIdleCallbackShim(id);
    await new Promise((r) => setTimeout(r, 60));
    expect(cb).not.toHaveBeenCalled();
  });
});
