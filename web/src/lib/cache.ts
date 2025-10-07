// Simple in-memory cache for development
// In production, use Redis or similar

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Get or set pattern
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  // Cache invalidation patterns
  deletePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  // Get cache stats
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired
    };
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache key generators
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  thread: (id: string) => `thread:${id}`,
  threads: (userId: string, filters?: string) => `threads:${userId}:${filters || 'all'}`,
  message: (id: string) => `message:${id}`,
  messages: (threadId: string) => `messages:${threadId}`,
  prompts: () => 'prompts:all',
  structure: () => 'structure:all',
  userStats: (userId: string) => `stats:user:${userId}`,
} as const;

// Cache TTL constants
export const CacheTTL = {
  SHORT: 1 * 60 * 1000,      // 1 minute
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
} as const;

// Cache decorator for functions
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttl: number = CacheTTL.MEDIUM
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator(...args);
      const cached = cache.get(key);
      
      if (cached !== null) {
        return cached;
      }

      const result = await method.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };

    return descriptor;
  };
}

// Cache invalidation helpers
export const CacheInvalidation = {
  user: (userId: string) => {
    cache.delete(CacheKeys.user(userId));
    cache.deletePattern(`threads:${userId}:*`);
    cache.deletePattern(`stats:user:${userId}`);
  },
  
  thread: (threadId: string) => {
    cache.delete(CacheKeys.thread(threadId));
    cache.delete(CacheKeys.messages(threadId));
  },
  
  message: (messageId: string, threadId?: string) => {
    cache.delete(CacheKeys.message(messageId));
    if (threadId) {
      cache.delete(CacheKeys.messages(threadId));
    }
  },
  
  prompts: () => {
    cache.delete(CacheKeys.prompts());
  },
  
  structure: () => {
    cache.delete(CacheKeys.structure());
  }
} as const;
