import { describe, expect, it } from 'vitest';
import {
  err,
  flatMap,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  tryCatch,
  tryCatchAsync,
  unwrapOr,
} from './result';

describe('Result utilities', () => {
  describe('constructors', () => {
    it('ok creates Ok result', () => {
      const result = ok(42);
      expect(result._tag).toBe('ok');
      expect(result.value).toBe(42);
    });

    it('err creates Err result', () => {
      const result = err('something went wrong');
      expect(result._tag).toBe('err');
      expect(result.error).toBe('something went wrong');
    });
  });

  describe('type guards', () => {
    it('isOk returns true for Ok', () => {
      expect(isOk(ok(1))).toBe(true);
      expect(isOk(err('e'))).toBe(false);
    });

    it('isErr returns true for Err', () => {
      expect(isErr(err('e'))).toBe(true);
      expect(isErr(ok(1))).toBe(false);
    });
  });

  describe('map', () => {
    it('transforms Ok value', () => {
      const result = map(ok(10), (x) => x * 2);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(20);
      }
    });

    it('passes through Err unchanged', () => {
      const result = map(err('oops'), (x: number) => x * 2);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('oops');
      }
    });
  });

  describe('flatMap', () => {
    it('chains successful operations', () => {
      const divide = (n: number): ReturnType<typeof ok<number> | typeof err> =>
        n === 0 ? err('division by zero') : ok(100 / n);

      const result = flatMap(ok(10), divide);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(10);
      }
    });

    it('short-circuits on Err', () => {
      const called = { value: false };
      const fn = () => {
        called.value = true;
        return ok(1);
      };

      flatMap(err('early error'), fn);
      expect(called.value).toBe(false);
    });
  });

  describe('mapErr', () => {
    it('transforms Err value', () => {
      const result = mapErr(err('oops'), (e) => `Error: ${e}`);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Error: oops');
      }
    });

    it('passes through Ok unchanged', () => {
      const result = mapErr(ok(42), (e: string) => `Error: ${e}`);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('unwrapOr', () => {
    it('returns value for Ok', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('returns default for Err', () => {
      expect(unwrapOr(err('oops'), 0)).toBe(0);
    });
  });

  describe('tryCatch', () => {
    it('returns Ok for successful function', () => {
      const result = tryCatch(() => JSON.parse('{"a": 1}'));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ a: 1 });
      }
    });

    it('returns Err for throwing function', () => {
      const result = tryCatch(() => JSON.parse('invalid json'));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });

  describe('tryCatchAsync', () => {
    it('returns Ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.resolve('success');
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('success');
      }
    });

    it('returns Err for rejecting async function', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.reject(new Error('async error'));
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect((result.error as Error).message).toBe('async error');
      }
    });
  });
});
