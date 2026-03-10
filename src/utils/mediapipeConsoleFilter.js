const MEDIAPIPE_NOISE_PATTERNS = [
  /gl_context\.cc:\d+]/i,
  /gl_context\.cc:\d+].*OpenGL error checking is disabled/i,
  /landmark_projection_calculator\.cc:\d+].*Using NORM_RECT without IMAGE_DIMENSIONS/i,
  /face_landmarker_graph\.cc:\d+].*FaceBlendshapesGraph acceleration to xnnpack/i,
  /TensorFlow Lite XNNPACK delegate for CPU/i,
  /Graph successfully started running\./i,
];

const CONSOLE_METHODS = ['log', 'warn', 'error'];

let activeFilterCount = 0;
let originalConsoleMethods = null;

const matchesNoisePattern = (value) =>
  typeof value === 'string' && MEDIAPIPE_NOISE_PATTERNS.some((pattern) => pattern.test(value));

export const shouldSuppressMediapipeConsoleEntry = (args = []) =>
  Array.isArray(args) && args.some((value) => matchesNoisePattern(value));

export const installMediapipeConsoleFilter = () => {
  if (typeof console === 'undefined') {
    return () => {};
  }

  activeFilterCount += 1;
  if (activeFilterCount === 1) {
    originalConsoleMethods = CONSOLE_METHODS.reduce((accumulator, method) => {
      accumulator[method] = console[method];
      return accumulator;
    }, {});

    for (const method of CONSOLE_METHODS) {
      const originalMethod = originalConsoleMethods[method];
      console[method] = (...args) => {
        if (shouldSuppressMediapipeConsoleEntry(args)) {
          return;
        }

        if (typeof originalMethod === 'function') {
          originalMethod(...args);
        }
      };
    }
  }

  return () => {
    activeFilterCount = Math.max(0, activeFilterCount - 1);
    if (activeFilterCount === 0 && originalConsoleMethods) {
      for (const method of CONSOLE_METHODS) {
        console[method] = originalConsoleMethods[method];
      }
      originalConsoleMethods = null;
    }
  };
};

export default {
  installMediapipeConsoleFilter,
  shouldSuppressMediapipeConsoleEntry,
};
