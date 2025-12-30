/**
 * Operating System Detection Utility
 * Detects the user's operating system from the browser's user agent
 */

/**
 * Detect the operating system
 * @returns {string} - 'windows', 'macos', 'linux', 'android', 'ios', or 'unknown'
 */
export function detectOS() {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() || '';

  // Windows detection
  if (userAgent.includes('win') || platform.includes('win')) {
    return 'windows';
  }

  // macOS detection
  if (userAgent.includes('mac') || platform.includes('mac')) {
    return 'macos';
  }

  // iOS detection
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) {
    return 'ios';
  }

  // Android detection
  if (userAgent.includes('android')) {
    return 'android';
  }

  // Linux detection
  if (userAgent.includes('linux') || platform.includes('linux')) {
    return 'linux';
  }

  return 'unknown';
}

/**
 * Check if the OS is Windows
 * @returns {boolean}
 */
export function isWindows() {
  return detectOS() === 'windows';
}

/**
 * Check if the OS is macOS
 * @returns {boolean}
 */
export function isMacOS() {
  return detectOS() === 'macos';
}

/**
 * Check if the OS is a mobile device
 * @returns {boolean}
 */
export function isMobile() {
  const os = detectOS();
  return os === 'ios' || os === 'android';
}

/**
 * Detect if device is mobile or desktop
 * @returns {string} - 'mobile' or 'desktop'
 */
export function detectDeviceType() {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  // Check for mobile devices
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  // Also check screen width as additional indicator
  const isSmallScreen = window.innerWidth <= 768;
  
  return (isMobileDevice || isSmallScreen) ? 'mobile' : 'desktop';
}

/**
 * Check if device is desktop
 * @returns {boolean}
 */
export function isDesktop() {
  return detectDeviceType() === 'desktop';
}

