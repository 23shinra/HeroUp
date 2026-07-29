import "@testing-library/jest-dom/vitest";

/** In-memory localStorage for node/jsdom test isolation. */
function createLocalStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key(i) {
      return Object.keys(store)[i] ?? null;
    },
  };
}

const storage = createLocalStorageMock();
Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
  writable: true,
});

beforeEach(() => {
  storage.clear();
});
