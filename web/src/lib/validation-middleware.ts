import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "./validation";
import { errorResponse } from "./api-response";

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "email";
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => ValidationError | null;
}

export function validateRequest(rules: ValidationRule[]) {
  return (req: NextRequest) => {
    return new Promise<{ data: any; errors: ValidationError[] }>(async (resolve) => {
      try {
        const body = await req.json();
        const errors: ValidationError[] = [];

        for (const rule of rules) {
          const value = body[rule.field];
          
          // Check required
          if (rule.required && (value === undefined || value === null || value === "")) {
            errors.push({ field: rule.field, message: `${rule.field} is required` });
            continue;
          }

          // Skip validation if value is empty and not required
          if (!rule.required && (value === undefined || value === null || value === "")) {
            continue;
          }

          // Type validation
          if (rule.type) {
            if (rule.type === "string" && typeof value !== "string") {
              errors.push({ field: rule.field, message: `${rule.field} must be a string` });
              continue;
            }
            if (rule.type === "number" && typeof value !== "number") {
              errors.push({ field: rule.field, message: `${rule.field} must be a number` });
              continue;
            }
            if (rule.type === "boolean" && typeof value !== "boolean") {
              errors.push({ field: rule.field, message: `${rule.field} must be a boolean` });
              continue;
            }
            if (rule.type === "email") {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                errors.push({ field: rule.field, message: `${rule.field} must be a valid email` });
                continue;
              }
            }
          }

          // String length validation
          if (rule.type === "string" && typeof value === "string") {
            if (rule.minLength && value.length < rule.minLength) {
              errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.minLength} characters` });
              continue;
            }
            if (rule.maxLength && value.length > rule.maxLength) {
              errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.maxLength} characters` });
              continue;
            }
          }

          // Number range validation
          if (rule.type === "number" && typeof value === "number") {
            if (rule.min !== undefined && value < rule.min) {
              errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.min}` });
              continue;
            }
            if (rule.max !== undefined && value > rule.max) {
              errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.max}` });
              continue;
            }
          }

          // Pattern validation
          if (rule.pattern && typeof value === "string" && !rule.pattern.test(value)) {
            errors.push({ field: rule.field, message: `${rule.field} format is invalid` });
            continue;
          }

          // Custom validation
          if (rule.custom) {
            const customError = rule.custom(value);
            if (customError) {
              errors.push(customError);
              continue;
            }
          }
        }

        resolve({ data: body, errors });
      } catch (error) {
        errors.push({ field: "body", message: "Invalid JSON in request body" });
        resolve({ data: {}, errors });
      }
    });
  };
}

export function withValidation(rules: ValidationRule[]) {
  return (handler: (req: NextRequest, data: any) => Promise<NextResponse>) => {
    return async (req: NextRequest) => {
      const { data, errors } = await validateRequest(rules)(req);
      
      if (errors.length > 0) {
        return errorResponse("Validation failed", 400, errors);
      }

      return handler(req, data);
    };
  };
}
