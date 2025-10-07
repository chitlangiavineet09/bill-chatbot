// Simple logging utility
// In production, use Winston or similar

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const levelName = LogLevel[entry.level];
    const prefix = `[${entry.timestamp}] ${levelName}:`;

    if (this.isDevelopment) {
      // Pretty print for development
      console.log(prefix, entry.message);
      if (entry.context) {
        console.log('  Context:', entry.context);
      }
      if (entry.error) {
        console.error('  Error:', entry.error);
      }
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.writeLog(this.formatLog(LogLevel.DEBUG, message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.writeLog(this.formatLog(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.writeLog(this.formatLog(LogLevel.WARN, message, context));
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.writeLog(this.formatLog(LogLevel.ERROR, message, context, error));
  }

  // API request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, userId?: string): void {
    this.info('API Request', {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      userId
    });
  }

  // Database query logging
  logQuery(operation: string, table: string, duration: number, recordCount?: number): void {
    this.debug('Database Query', {
      operation,
      table,
      duration: `${duration}ms`,
      recordCount
    });
  }

  // Authentication logging
  logAuth(action: string, userId?: string, success: boolean = true, error?: Error): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.writeLog(this.formatLog(level, `Auth ${action}`, { userId, success }, error));
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.INFO;
    this.writeLog(this.formatLog(level, `Performance: ${operation}`, {
      ...context,
      duration: `${duration}ms`
    }));
  }
}

// Singleton instance
export const logger = new Logger();

// Performance measurement decorator
export function measurePerformance<T extends (...args: any[]) => any>(
  operationName: string,
  context?: Record<string, any>
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - start;
        logger.logPerformance(operationName, duration, context);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.logPerformance(operationName, duration, { ...context, error: true });
        throw error;
      }
    };

    return descriptor;
  };
}

// Request timing middleware
export function withRequestTiming(handler: Function) {
  return async (req: any, ...args: any[]) => {
    const start = Date.now();
    const method = req.method;
    const url = req.url;
    
    try {
      const response = await handler(req, ...args);
      const duration = Date.now() - start;
      logger.logRequest(method, url, response.status, duration);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      logger.logRequest(method, url, 500, duration);
      throw error;
    }
  };
}
