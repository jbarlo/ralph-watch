import { describe, it, expect, beforeEach } from 'vitest';
import { parseEnv, getEnv, resetEnvCache } from './env';

describe('env validation', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  describe('parseEnv', () => {
    it('should parse valid env with RALPH_BIN', () => {
      const result = parseEnv({
        RALPH_BIN: '/usr/local/bin',
      });

      expect(result.RALPH_BIN).toBe('/usr/local/bin');
      expect(result.RALPH_DIR).toBeUndefined();
      expect(result.REACT_EDITOR).toBeUndefined();
    });

    it('should parse env with all vars', () => {
      const result = parseEnv({
        RALPH_BIN: '/path/to/bin',
        RALPH_DIR: '/path/to/project',
        REACT_EDITOR: 'vim',
      });

      expect(result.RALPH_BIN).toBe('/path/to/bin');
      expect(result.RALPH_DIR).toBe('/path/to/project');
      expect(result.REACT_EDITOR).toBe('vim');
    });

    it('should throw when RALPH_BIN is missing', () => {
      expect(() => parseEnv({})).toThrow('Missing RALPH_BIN');
    });

    it('should throw with helpful error message format', () => {
      expect(() => parseEnv({})).toThrow('Environment validation failed');
      expect(() => parseEnv({})).toThrow('set path to ralph bin directory');
    });

    it('should allow extra env vars', () => {
      const result = parseEnv({
        RALPH_BIN: '/bin',
        SOME_OTHER_VAR: 'value',
        PATH: '/usr/bin',
      });

      expect(result.RALPH_BIN).toBe('/bin');
    });
  });

  describe('getEnv', () => {
    it('should cache parsed env', () => {
      const originalEnv = process.env.RALPH_BIN;
      process.env.RALPH_BIN = '/test/bin';

      try {
        const first = getEnv();
        const second = getEnv();

        expect(first).toBe(second);
        expect(first.RALPH_BIN).toBe('/test/bin');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.RALPH_BIN;
        } else {
          process.env.RALPH_BIN = originalEnv;
        }
      }
    });

    it('should throw if RALPH_BIN not set', () => {
      const originalEnv = process.env.RALPH_BIN;
      delete process.env.RALPH_BIN;

      try {
        expect(() => getEnv()).toThrow('Missing RALPH_BIN');
      } finally {
        if (originalEnv !== undefined) {
          process.env.RALPH_BIN = originalEnv;
        }
      }
    });
  });

  describe('resetEnvCache', () => {
    it('should allow re-parsing after reset', () => {
      const originalEnv = process.env.RALPH_BIN;
      process.env.RALPH_BIN = '/first/bin';

      try {
        const first = getEnv();
        expect(first.RALPH_BIN).toBe('/first/bin');

        process.env.RALPH_BIN = '/second/bin';
        resetEnvCache();

        const second = getEnv();
        expect(second.RALPH_BIN).toBe('/second/bin');
        expect(first).not.toBe(second);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.RALPH_BIN;
        } else {
          process.env.RALPH_BIN = originalEnv;
        }
      }
    });
  });
});
