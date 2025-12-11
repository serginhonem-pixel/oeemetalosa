// src/utils/env.js
const DEFAULT_DEV_CACHE_KEY = "telha-oee-dev-cache-v1";

export const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const DEV_CACHE_KEY =
  import.meta.env?.VITE_DEV_CACHE_KEY || DEFAULT_DEV_CACHE_KEY;

// Garante uma chave mesmo quando a env nao esta configurada.
export const getDevCacheKey = () => DEV_CACHE_KEY || DEFAULT_DEV_CACHE_KEY;

export const IS_PRODUCTION = !IS_LOCALHOST;
