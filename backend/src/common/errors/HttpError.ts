export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code = 'HTTP_ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new HttpError(400, message, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new HttpError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'Forbidden') {
    return new HttpError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Not found') {
    return new HttpError(404, message, 'NOT_FOUND');
  }
  static conflict(message = 'Conflict', details?: unknown) {
    return new HttpError(409, message, 'CONFLICT', details);
  }
  static unprocessable(message = 'Unprocessable entity', details?: unknown) {
    return new HttpError(422, message, 'UNPROCESSABLE_ENTITY', details);
  }
  static internal(message = 'Internal server error') {
    return new HttpError(500, message, 'INTERNAL_ERROR');
  }
}
