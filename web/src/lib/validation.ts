import { UserRole, MessageRole } from "@prisma/client";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): ValidationError | null {
  if (!email) {
    return { field: 'email', message: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { field: 'email', message: 'Invalid email format' };
  }
  
  return null;
}

export function validatePassword(password: string): ValidationError | null {
  if (!password) {
    return { field: 'password', message: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { field: 'password', message: 'Password must be at least 6 characters' };
  }
  
  return null;
}

export function validateRole(role: string): ValidationError | null {
  if (!role) {
    return { field: 'role', message: 'Role is required' };
  }
  
  if (!Object.values(UserRole).includes(role as UserRole)) {
    return { field: 'role', message: 'Invalid role' };
  }
  
  return null;
}

export function validateMessageRole(role: string): ValidationError | null {
  if (!role) {
    return { field: 'role', message: 'Role is required' };
  }
  
  if (!Object.values(MessageRole).includes(role as MessageRole)) {
    return { field: 'role', message: 'Invalid message role' };
  }
  
  return null;
}

export function validateRequired(value: any, field: string): ValidationError | null {
  if (value === undefined || value === null || value === '') {
    return { field, message: `${field} is required` };
  }
  
  return null;
}

export function validateString(value: any, field: string, minLength?: number): ValidationError | null {
  const requiredError = validateRequired(value, field);
  if (requiredError) return requiredError;
  
  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }
  
  if (minLength && value.length < minLength) {
    return { field, message: `${field} must be at least ${minLength} characters` };
  }
  
  return null;
}

export function validatePagination(page: string | null, limit: string | null): { page: number; limit: number; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  const pageNum = page ? parseInt(page) : 1;
  const limitNum = limit ? parseInt(limit) : 10;
  
  if (isNaN(pageNum) || pageNum < 1) {
    errors.push({ field: 'page', message: 'Page must be a positive integer' });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
  }
  
  return {
    page: isNaN(pageNum) ? 1 : pageNum,
    limit: isNaN(limitNum) ? 10 : Math.min(limitNum, 100),
    errors
  };
}
