export class BeamError<T extends number | string> extends Error {
  constructor(public code: T, message?: string) {
    super(message);
  }
}

export type SerializedError = [number | string] | [number | string, string];
