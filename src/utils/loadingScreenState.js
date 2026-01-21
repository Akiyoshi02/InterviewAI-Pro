let loadingScreenCount = 0;
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const incrementLoadingScreen = () => {
  loadingScreenCount += 1;
  notify();
};

export const decrementLoadingScreen = () => {
  loadingScreenCount = Math.max(0, loadingScreenCount - 1);
  notify();
};

export const isLoadingScreenActive = () => loadingScreenCount > 0;

export const subscribeLoadingScreen = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
