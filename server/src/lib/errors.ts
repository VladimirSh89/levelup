import type { ZodError } from "zod";

/** Thrown by routes/services to signal a specific HTTP status + message. */
export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "AppError";
  }
}

export function notFound(message = "Not found"): AppError {
  return new AppError(message, 404);
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError(message, 403);
}

export function conflict(message = "Conflict"): AppError {
  return new AppError(message, 409);
}

/** First human-readable message from a zod validation error. */
export function zodErrorMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
