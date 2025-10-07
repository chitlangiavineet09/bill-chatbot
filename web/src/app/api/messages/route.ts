import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { MessageRole } from "@prisma/client";

// GET /api/messages?threadId=xxx - Get messages for a specific thread
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');

    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }

    // Verify the thread belongs to the user
    const thread = await db.chatThread.findFirst({
      where: {
        id: threadId,
        userId: auth.user.id,
      }
    });

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    const messages = await db.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create a new message
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const { content, role, kind, threadId } = body;

    if (!content || !role || !threadId) {
      return NextResponse.json(
        { error: 'Content, role, and threadId are required' },
        { status: 400 }
      );
    }

    if (!Object.values(MessageRole).includes(role)) {
      return NextResponse.json(
        { error: 'Invalid message role' },
        { status: 400 }
      );
    }

    // Verify the thread belongs to the user
    const thread = await db.chatThread.findFirst({
      where: {
        id: threadId,
        userId: auth.user.id,
      }
    });

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    const message = await db.message.create({
      data: {
        content,
        role,
        kind,
        threadId,
        userId: auth.user.id,
      }
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
