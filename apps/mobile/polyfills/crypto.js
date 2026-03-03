// Empty crypto polyfill for React Native
// React Native apps should use the native Web Crypto API (globalThis.crypto)
// This file prevents Node.js crypto imports from breaking Metro bundler
module.exports = {};
