import { NextRequest, NextResponse } from "next/server";
import { withAuth, withValidationAndAuth, addSecurityHeaders } from "@/lib/api-middleware";
import { ThreadService } from "@/lib/services/thread-service";
import { cache, CacheKeys, CacheTTL } from "@/lib/cache";
import { logger } from "@/lib/logger";

// GET /api/threads - Get all threads for the authenticated user
async function getThreads(req: NextRequest, context: any) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const cacheKey = CacheKeys.threads(context.user.id, search);
  
  const threads = await cache.getOrSet(
    cacheKey,
    () => ThreadService.getThreads({
      userId: context.user.id,
      ...(search && { search }),
      limit,
      offset
    }),
    CacheTTL.MEDIUM
  );

  logger.info('Threads fetched', { 
    userId: context.user.id, 
    count: threads.length,
    search,
    limit,
    offset
  });

  const response = NextResponse.json(threads);
  return addSecurityHeaders(response);
}

export const GET = withAuth(getThreads);

// POST /api/threads - Create a new thread
async function createThread(_req: NextRequest, context: any) {
  const { title } = context.data;

  const thread = await ThreadService.createThread({
    title,
    userId: context.user.id
  });

  // Invalidate user's thread cache
  cache.deletePattern(`threads:${context.user.id}:*`);

  logger.info('Thread created', { 
    threadId: thread.id, 
    userId: context.user.id,
    title: thread.title
  });

  const response = NextResponse.json(thread, { status: 201 });
  return addSecurityHeaders(response);
}

export const POST = withValidationAndAuth(createThread, [
  { field: "title", type: "string", maxLength: 255 }
]);
