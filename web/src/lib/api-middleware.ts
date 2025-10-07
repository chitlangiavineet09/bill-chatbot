import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "./auth-helpers";
import { withValidation, ValidationRule } from "./validation-middleware";
import { withErrorHandling } from "./error-handler";
import { UserRole } from "@prisma/client";

export interface ApiHandler {
  (req: NextRequest, context?: any): Promise<NextResponse | Response>;
}

export interface ApiMiddlewareOptions {
  requireAuth?: boolean;
  requiredRole?: UserRole;
  validation?: ValidationRule[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withApiMiddleware(
  handler: ApiHandler,
  options: ApiMiddlewareOptions = {}
) {
  return withErrorHandling(async (req: NextRequest, context?: any) => {
    // 1. Rate limiting
    if (options.rateLimit) {
      const clientId = req.ip || req.headers.get("x-forwarded-for") || "unknown";
      const now = Date.now();
      const windowStart = now - options.rateLimit.windowMs;
      
      const clientData = rateLimitStore.get(clientId);
      
      if (clientData) {
        if (now < clientData.resetTime) {
          if (clientData.count >= options.rateLimit.maxRequests) {
            return NextResponse.json(
              { error: "Too many requests" },
              { status: 429, headers: { "Retry-After": "60" } }
            );
          }
          clientData.count++;
        } else {
          rateLimitStore.set(clientId, { count: 1, resetTime: now + options.rateLimit.windowMs });
        }
      } else {
        rateLimitStore.set(clientId, { count: 1, resetTime: now + options.rateLimit.windowMs });
      }
    }

    // 2. Authentication
    if (options.requireAuth) {
      const auth = await requireAuth(options.requiredRole);
      if (auth instanceof Response) return auth;
      context = { ...context, user: auth.user };
    }

    // 3. Validation
    if (options.validation) {
      const validationHandler = withValidation(options.validation);
      return validationHandler(async (req: NextRequest, data: any) => {
        return handler(req, { ...context, data });
      })(req);
    }

    // 4. Execute handler
    return handler(req, context);
  });
}

// Common middleware configurations
export const withAuth = (handler: ApiHandler, requiredRole?: UserRole) =>
  withApiMiddleware(handler, { requireAuth: true, requiredRole });

export const withAdminAuth = (handler: ApiHandler) =>
  withApiMiddleware(handler, { requireAuth: true, requiredRole: "Admin" });

export const withValidationAndAuth = (
  handler: ApiHandler,
  validation: ValidationRule[],
  requiredRole?: UserRole
) =>
  withApiMiddleware(handler, {
    requireAuth: true,
    requiredRole,
    validation,
  });

export const withRateLimit = (
  handler: ApiHandler,
  maxRequests: number = 100,
  windowMs: number = 60000
) =>
  withApiMiddleware(handler, {
    rateLimit: { maxRequests, windowMs },
  });

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  return response;
}

// CORS middleware
export function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", process.env.NODE_ENV === "production" ? "https://yourdomain.com" : "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Max-Age", "86400");
  
  return response;
}

// Request logging middleware
export function logRequest(req: NextRequest, response: NextResponse) {
  const { method, url } = req;
  const { status } = response;
  const userAgent = req.headers.get("user-agent") || "unknown";
  const ip = req.ip || req.headers.get("x-forwarded-for") || "unknown";
  
  console.log(`${method} ${url} ${status} - ${ip} - ${userAgent}`);
}
