import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearMemoryFallback } from '@/storage/storage';

afterEach(() => {
  cleanup();
  clearMemoryFallback();
  vi.restoreAllMocks();
});

