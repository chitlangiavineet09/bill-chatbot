import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    
    // Check cache
    cache.set('health-check', 'ok', 1000);
    const cacheStatus = cache.get('health-check') === 'ok';
    
    // Check environment variables
    const envCheck = {
      database: !!process.env.DATABASE_URL,
      nextAuth: !!process.env.NEXTAUTH_SECRET,
      nextAuthUrl: !!process.env.NEXTAUTH_URL,
    };
    
    const allEnvVarsPresent = Object.values(envCheck).every(Boolean);
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      checks: {
        database: 'healthy',
        cache: cacheStatus ? 'healthy' : 'unhealthy',
        environment: allEnvVarsPresent ? 'healthy' : 'unhealthy',
      },
      responseTime: `${Date.now() - startTime}ms`,
    };
    
    const statusCode = allEnvVarsPresent && cacheStatus ? 200 : 503;
    
    logger.info('Health check', { 
      status: health.status, 
      responseTime: health.responseTime,
      checks: health.checks
    });
    
    return NextResponse.json(health, { status: statusCode });
    
  } catch (error) {
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      checks: {
        database: 'unhealthy',
        cache: 'unknown',
        environment: 'unknown',
      },
      responseTime: `${Date.now() - startTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    
    logger.error('Health check failed', error as Error, { responseTime: health.responseTime });
    
    return NextResponse.json(health, { status: 503 });
  }
}
