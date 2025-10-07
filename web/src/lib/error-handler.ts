import { NextResponse } from "next/server";
import { errorResponse, serverErrorResponse } from "./api-response";

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "Database operation failed") {
    super(message, 500, "DATABASE_ERROR");
  }
}

export function handleError(error: unknown): NextResponse {
  console.error("Error occurred:", error);

  // Handle known AppError instances
  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode, undefined, error.code);
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as any;
    
    switch (prismaError.code) {
      case "P2002":
        return errorResponse("A record with this information already exists", 409, undefined, "DUPLICATE_ENTRY");
      case "P2025":
        return errorResponse("Record not found", 404, undefined, "NOT_FOUND");
      case "P2003":
        return errorResponse("Foreign key constraint failed", 400, undefined, "FOREIGN_KEY_CONSTRAINT");
      case "P2014":
        return errorResponse("Invalid ID provided", 400, undefined, "INVALID_ID");
      default:
        return serverErrorResponse("Database operation failed");
    }
  }

  // Handle validation errors
  if (error && typeof error === "object" && "name" in error && error.name === "ValidationError") {
    return errorResponse("Validation failed", 400);
  }

  // Handle JWT errors
  if (error && typeof error === "object" && "name" in error) {
    const jwtError = error as any;
    if (jwtError.name === "JsonWebTokenError") {
      return errorResponse("Invalid token", 401, undefined, "INVALID_TOKEN");
    }
    if (jwtError.name === "TokenExpiredError") {
      return errorResponse("Token expired", 401, undefined, "TOKEN_EXPIRED");
    }
  }

  // Handle network errors
  if (error && typeof error === "object" && "code" in error) {
    const networkError = error as any;
    if (networkError.code === "ECONNREFUSED" || networkError.code === "ENOTFOUND") {
      return serverErrorResponse("Service temporarily unavailable");
    }
  }

  // Default error response
  return serverErrorResponse("An unexpected error occurred");
}

export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function withErrorHandling(handler: Function) {
  return async (req: any, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      return handleError(error);
    }
  };
}
