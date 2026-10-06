/**
 * Custom error class for "expected" errors — ones we throw deliberately
 * to communicate a specific HTTP status + message to the client.
 * Anything NOT an AppError gets treated as an unexpected 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    options: { errors?: unknown; isOperational?: boolean } = {},
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.errors = options.errors;

    // Capture the stack trace, excluding this constructor call.
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", errors?: unknown): AppError {
    return new AppError(message, 400, { errors });
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(message, 404);
  }

  static conflict(message = "Conflict"): AppError {
    return new AppError(message, 409);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError(message, 500, { isOperational: false });
  }
}