/**
 * Custom error hierarchy for ProwlLog local storage layer.
 * All errors provide actionable messages for UI and logging.
 */

export class AppError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} with ID "${id}" was not found.`, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
  }
}

export class RelationError extends AppError {
  constructor(message: string) {
    super(message, 'RELATION_ERROR');
  }
}

export class StorageQuotaError extends AppError {
  readonly originalError?: unknown;

  constructor(
    message = 'Device storage quota exceeded. Please free up space or export existing data.',
    originalError?: unknown
  ) {
    super(message, 'QUOTA_EXCEEDED');
    this.originalError = originalError;
  }
}

export class DatabaseError extends AppError {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}
