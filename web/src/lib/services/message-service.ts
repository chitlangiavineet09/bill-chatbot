import { db } from "@/lib/db";
import { NotFoundError, DatabaseError } from "@/lib/error-handler";
import { MessageRole } from "@prisma/client";

export interface CreateMessageData {
  content: string;
  role: MessageRole;
  kind?: string | null;
  threadId: string;
  userId: string;
}

export interface UpdateMessageData {
  content?: string;
}

export interface MessageFilters {
  threadId?: string;
  userId?: string;
  role?: MessageRole;
  limit?: number;
  offset?: number;
}

export class MessageService {
  static async createMessage(data: CreateMessageData) {
    try {
      // Verify thread belongs to user
      const thread = await db.chatThread.findFirst({
        where: { 
          id: data.threadId,
          userId: data.userId 
        }
      });

      if (!thread) {
        throw new NotFoundError("Thread");
      }

      const message = await db.message.create({
        data: {
          content: data.content,
          role: data.role,
          kind: data.kind ?? null,
          threadId: data.threadId,
          userId: data.userId,
        }
      });

      // Update thread's updatedAt timestamp
      await db.chatThread.update({
        where: { id: data.threadId },
        data: { updatedAt: new Date() }
      });

      return message;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to create message");
    }
  }

  static async getMessageById(id: string, userId: string) {
    try {
      const message = await db.message.findFirst({
        where: { 
          id,
          thread: { userId }
        }
      });

      if (!message) {
        throw new NotFoundError("Message");
      }

      return message;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to fetch message");
    }
  }

  static async getMessages(filters: MessageFilters) {
    try {
      const where: any = {};
      
      if (filters.threadId) {
        where.threadId = filters.threadId;
      }
      
      if (filters.userId) {
        where.thread = { userId: filters.userId };
      }
      
      if (filters.role) {
        where.role = filters.role;
      }

      const messages = await db.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
        include: {
          thread: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      return messages;
    } catch (error) {
      throw new DatabaseError("Failed to fetch messages");
    }
  }

  static async getMessagesByThreadId(threadId: string, limit: number = 50) {
    try {
      const messages = await db.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          thread: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      throw new DatabaseError("Failed to fetch messages by thread");
    }
  }

  static async updateMessage(id: string, data: UpdateMessageData, userId: string) {
    try {
      const message = await db.message.findFirst({
        where: { 
          id,
          thread: { userId }
        }
      });

      if (!message) {
        throw new NotFoundError("Message");
      }

      const updatedMessage = await db.message.update({
        where: { id },
        data
      });

      return updatedMessage;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to update message");
    }
  }

  static async deleteMessage(id: string, userId: string) {
    try {
      const message = await db.message.findFirst({
        where: { 
          id,
          thread: { userId }
        }
      });

      if (!message) {
        throw new NotFoundError("Message");
      }

      await db.message.delete({
        where: { id }
      });

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to delete message");
    }
  }

  static async getMessageStats(userId: string) {
    try {
      const [totalMessages, messagesByRole, recentMessages] = await Promise.all([
        db.message.count({ 
          where: { 
            thread: { userId } 
          } 
        }),
        db.message.groupBy({
          by: ['role'],
          where: { 
            thread: { userId } 
          },
          _count: {
            role: true
          }
        }),
        db.message.findMany({
          where: { 
            thread: { userId } 
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            thread: {
              select: {
                id: true,
                title: true
              }
            }
          }
        })
      ]);

      return {
        totalMessages,
        messagesByRole,
        recentMessages
      };
    } catch (error) {
      throw new DatabaseError("Failed to fetch message stats");
    }
  }
}
