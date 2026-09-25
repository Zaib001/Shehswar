/**
 * SHEHSWAR ONE360 - Result Monad for Domain Operations
 */

export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(readonly value: T) {}
}

export class Failure<E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(readonly error: E) {}
}

export const ok = <T, E = Error>(value: T): Result<T, E> => new Success<T>(value);
export const err = <T, E = Error>(error: E): Result<T, E> => new Failure<E>(error);
