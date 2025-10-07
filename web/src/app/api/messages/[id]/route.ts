import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

// GET /api/messages/[id] - Get a specific message
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const message = await db.message.findFirst({
      where: {
        id: params.id,
        userId: auth.user.id, // Ensure user can only access their own messages
      }
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message' },
      { status: 500 }
    );
  }
}

// PUT /api/messages/[id] - Update a message
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const result = await db.message.updateMany({
      where: {
        id: params.id,
        userId: auth.user.id, // Ensure user can only update their own messages
      },
      data: { content }
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/[id] - Delete a message
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const result = await db.message.deleteMany({
      where: {
        id: params.id,
        userId: auth.user.id, // Ensure user can only delete their own messages
      }
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
