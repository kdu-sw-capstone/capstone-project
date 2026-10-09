import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// jsdom has no layout viewport; actual scrolling is checked in the Windows browser.
beforeEach(() => { vi.stubGlobal("scrollTo", vi.fn()); });
