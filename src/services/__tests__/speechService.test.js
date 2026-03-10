import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalSpeechSynthesis = globalThis.window?.speechSynthesis;
const originalUtterance = globalThis.window?.SpeechSynthesisUtterance;
const originalNavigatorWebdriver = Object.getOwnPropertyDescriptor(window.navigator, 'webdriver');

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.voice = null;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.lang = 'en-US';
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
  }
}

const setNavigatorWebdriver = (value) => {
  Object.defineProperty(window.navigator, 'webdriver', {
    configurable: true,
    value,
  });
};

const loadSpeechService = async ({ webdriver = false, synth } = {}) => {
  vi.resetModules();
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: FakeUtterance,
  });
  setNavigatorWebdriver(webdriver);
  const module = await import('../speechService.js');
  return module.default;
};

describe('speechService runtime fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (typeof originalSpeechSynthesis === 'undefined') {
      delete window.speechSynthesis;
    } else {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeechSynthesis,
      });
    }

    if (typeof originalUtterance === 'undefined') {
      delete window.SpeechSynthesisUtterance;
    } else {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: originalUtterance,
      });
    }

    if (originalNavigatorWebdriver) {
      Object.defineProperty(window.navigator, 'webdriver', originalNavigatorWebdriver);
    } else {
      delete window.navigator.webdriver;
    }
  });

  it('bypasses playback in automation environments without throwing', async () => {
    const synth = {
      speaking: false,
      pending: false,
      getVoices: vi.fn(() => []),
      speak: vi.fn(),
      cancel: vi.fn(),
    };

    const speechService = await loadSpeechService({ webdriver: true, synth });
    const onEnd = vi.fn();

    const result = await speechService.speak('Hello world', { onEnd });

    expect(result).toEqual({ spoken: false, reason: 'automation' });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('treats recoverable synthesis errors as non-fatal', async () => {
    const synth = {
      speaking: false,
      pending: false,
      getVoices: vi.fn(() => [{ name: 'Test Voice', lang: 'en-US' }]),
      speak: vi.fn((utterance) => {
        queueMicrotask(() => utterance.onerror?.({ error: 'synthesis-failed' }));
      }),
      cancel: vi.fn(),
    };

    const speechService = await loadSpeechService({ webdriver: false, synth });
    const onEnd = vi.fn();
    const onError = vi.fn();

    const result = await speechService.speak('Hello world', { onEnd, onError });

    expect(result).toEqual({ spoken: false, reason: 'synthesis-failed' });
    expect(onError).toHaveBeenCalledWith('synthesis-failed');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });
});
