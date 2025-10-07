import { db } from "@/lib/db";
import { NotFoundError, DatabaseError } from "@/lib/error-handler";

export interface CreateThreadData {
  title?: string;
  userId: string;
}

export interface UpdateThreadData {
  title?: string;
}

export interface ThreadFilters {
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class ThreadService {
  static async createThread(data: CreateThreadData) {
    try {
      const thread = await db.chatThread.create({
        data: {
          title: data.title || 'New Chat',
          userId: data.userId,
        },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });
      return thread;
    } catch (error) {
      throw new DatabaseError("Failed to create thread");
    }
  }

  static async getThreadById(id: string, userId: string) {
    try {
      const thread = await db.chatThread.findFirst({
        where: { 
          id,
          userId 
        },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      if (!thread) {
        throw new NotFoundError("Thread");
      }

      return thread;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to fetch thread");
    }
  }

  static async getThreads(filters: ThreadFilters) {
    try {
      const where: any = {};
      
      if (filters.userId) {
        where.userId = filters.userId;
      }
      
      if (filters.search) {
        where.title = {
          contains: filters.search,
          mode: 'insensitive'
        };
      }

      const threads = await db.chatThread.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      return threads;
    } catch (error) {
      throw new DatabaseError("Failed to fetch threads");
    }
  }

  static async updateThread(id: string, data: UpdateThreadData, userId: string) {
    try {
      const thread = await db.chatThread.findFirst({
        where: { id, userId }
      });

      if (!thread) {
        throw new NotFoundError("Thread");
      }

      const updatedThread = await db.chatThread.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      return updatedThread;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to update thread");
    }
  }

  static async updateThreadTitle(id: string, title: string, userId: string) {
    try {
      const thread = await db.chatThread.findFirst({
        where: { id, userId }
      });

      if (!thread) {
        throw new NotFoundError("Thread");
      }

      const updatedThread = await db.chatThread.update({
        where: { id },
        data: { title },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      return updatedThread;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to update thread title");
    }
  }

  static async deleteThread(id: string, userId: string) {
    try {
      // First verify the thread exists and belongs to the user
      const thread = await db.chatThread.findFirst({
        where: { id, userId },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      if (!thread) {
        throw new NotFoundError("Thread");
      }

      // Delete the thread (messages will be automatically deleted due to onDelete: Cascade)
      await db.chatThread.delete({
        where: { id }
      });

      return { 
        success: true, 
        deletedMessages: thread._count.messages 
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to delete thread");
    }
  }

  static async getThreadStats(userId: string) {
    try {
      const [totalThreads, totalMessages, recentThreads] = await Promise.all([
        db.chatThread.count({ where: { userId } }),
        db.message.count({ 
          where: { 
            thread: { userId } 
          } 
        }),
        db.chatThread.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            _count: {
              select: { messages: true }
            }
          }
        })
      ]);

      return {
        totalThreads,
        totalMessages,
        recentThreads
      };
    } catch (error) {
      throw new DatabaseError("Failed to fetch thread stats");
    }
  }
}
