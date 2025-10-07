import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-helpers";
import { validateEmail, validatePassword } from "@/lib/validation";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate input
    const emailError = validateEmail(email);
    if (emailError) {
      return errorResponse(emailError.message, 400);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return errorResponse(passwordError.message, 400);
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return errorResponse("User already exists with this email", 409);
    }

    // Create new user
    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "User", // Always create as User, not Admin
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      }
    });

    return successResponse({ user }, 201);
  } catch (error) {
    console.error("Signup error:", error);
    return errorResponse("Failed to create user", 500);
  }
}
