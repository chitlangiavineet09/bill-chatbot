import { NextResponse } from "next/server";
import { ValidationError } from "./validation";

export interface ApiError {
  error: string;
  details?: ValidationError[];
  code?: string;
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: string, status: number = 400, details?: ValidationError[], code?: string) {
  const response: ApiError = { error };
  if (details) response.details = details;
  if (code) response.code = code;
  
  return NextResponse.json(response, { status });
}

export function validationErrorResponse(errors: ValidationError[]) {
  return errorResponse('Validation failed', 400, errors);
}

export function notFoundResponse(resource: string = 'Resource') {
  return errorResponse(`${resource} not found`, 404);
}

export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401);
}

export function forbiddenResponse() {
  return errorResponse('Forbidden', 403);
}

export function serverErrorResponse(message: string = 'Internal server error') {
  return errorResponse(message, 500);
}
