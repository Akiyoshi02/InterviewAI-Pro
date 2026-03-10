import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installMediapipeConsoleFilter,
  shouldSuppressMediapipeConsoleEntry,
} from '../mediapipeConsoleFilter.js';

describe('mediapipeConsoleFilter', () => {
  let restoreFilter = null;
  let originalWarn;

  beforeEach(() => {
    originalWarn = console.warn;
  });

  afterEach(() => {
    restoreFilter?.();
    restoreFilter = null;
    console.warn = originalWarn;
    vi.restoreAllMocks();
  });

  it('suppresses known mediapipe runtime noise', () => {
    expect(
      shouldSuppressMediapipeConsoleEntry([
        'W0309 03:00:59.760999 landmark_projection_calculator.cc:81] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI.',
      ]),
    ).toBe(true);
  });

  it('does not suppress unrelated warnings', () => {
    expect(
      shouldSuppressMediapipeConsoleEntry(['Unable to access camera/microphone for live interview.']),
    ).toBe(false);
  });

  it('filters matching console.warn output but preserves unrelated warnings', () => {
    const warnSpy = vi.fn();
    console.warn = warnSpy;
    restoreFilter = installMediapipeConsoleFilter();

    console.warn('W0309 03:00:59.060999 gl_context.cc:1118] OpenGL error checking is disabled');
    console.warn('Real application warning');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Real application warning');
  });

  it('does not crash if a captured filtered console method runs after teardown', () => {
    const warnSpy = vi.fn();
    console.warn = warnSpy;
    restoreFilter = installMediapipeConsoleFilter();

    const wrappedWarn = console.warn;
    restoreFilter();
    restoreFilter = null;

    expect(() => {
      wrappedWarn('Late runtime warning after teardown');
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith('Late runtime warning after teardown');
  });
});
