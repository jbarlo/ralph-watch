/**
 * Railway-oriented programming utilities.
 * Use Result<T, E> for fallible operations instead of throwing exceptions.
 */

export type Ok<T> = { readonly _tag: 'ok'; readonly value: T };
export type Err<E> = { readonly _tag: 'err'; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { _tag: 'ok', value };
}

export function err<E>(error: E): Err<E> {
  return { _tag: 'err', error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result._tag === 'ok';
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result._tag === 'err';
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

export function tryCatch<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e as E);
  }
}

export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(e as E);
  }
}
