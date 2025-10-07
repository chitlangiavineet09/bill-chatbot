import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth-config";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function getServerAuth() {
  const session = await getServerSession(authOptions);
  return session;
}

export async function requireAuth(role?: string) {
  const session = await getServerAuth();
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (role && (session.user as any).role !== role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  return { user: session.user };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
