import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

// GET /api/users/[id] - Get user by ID (Admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth('Admin');
  if (auth instanceof Response) return auth;

  try {
    const user = await db.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chatThreads: true,
            messages: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user (Admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth('Admin');
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const { email, role } = body;

    if (email && typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email must be a string' },
        { status: 400 }
      );
    }

    if (role && !Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (email) updateData.email = email.toLowerCase();
    if (role) updateData.role = role;

    const user = await db.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth('Admin');
  if (auth instanceof Response) return auth;

  try {
    // Prevent admin from deleting themselves
    if (params.id === auth.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const result = await db.user.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
