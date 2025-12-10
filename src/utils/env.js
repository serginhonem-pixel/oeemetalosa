// src/utils/env.js
export const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

export const IS_PRODUCTION = !IS_LOCALHOST;
