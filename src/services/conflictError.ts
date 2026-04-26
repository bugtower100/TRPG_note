export class VersionConflictError<TRemote = unknown> extends Error {
  readonly code = 'version_conflict';
  readonly version?: number;
  readonly remote: TRemote | null;

  constructor(message: string, options?: { version?: number; remote?: TRemote | null }) {
    super(message);
    this.name = 'VersionConflictError';
    this.version = options?.version;
    this.remote = options?.remote ?? null;
    Object.setPrototypeOf(this, VersionConflictError.prototype);
  }
}
