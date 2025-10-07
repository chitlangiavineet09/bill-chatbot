import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { ThreadService } from "@/lib/services/thread-service";
import { db } from "@/lib/db";

// GET /api/threads/[id] - Get a specific thread with messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const resolvedParams = await params;
    const thread = await db.chatThread.findFirst({
      where: {
        id: resolvedParams.id,
        userId: auth.user.id, // Ensure user can only access their own threads
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(thread);
  } catch (error) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}

// PUT /api/threads/[id] - Update thread title
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    const thread = await db.chatThread.updateMany({
      where: {
        id: resolvedParams.id,
        userId: auth.user.id, // Ensure user can only update their own threads
      },
      data: { title }
    });

    if (thread.count === 0) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating thread:', error);
    return NextResponse.json(
      { error: 'Failed to update thread' },
      { status: 500 }
    );
  }
}

// DELETE /api/threads/[id] - Delete a thread and all its messages
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const resolvedParams = await params;
    const result = await ThreadService.deleteThread(resolvedParams.id, auth.user.id);

    return NextResponse.json({
      success: true,
      message: `Thread deleted successfully. ${result.deletedMessages} messages were also deleted.`,
      deletedMessages: result.deletedMessages
    });
  } catch (error: any) {
    console.error('Error deleting thread:', error);
    
    if (error.name === 'NotFoundError') {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    );
  }
}
