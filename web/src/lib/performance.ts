// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private thresholds = {
    slow: 1000,    // 1 second
    warning: 500,  // 500ms
  };

  start(name: string, metadata?: Record<string, any>): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, {
      name,
      startTime: performance.now(),
      metadata
    });
    return id;
  }

  end(id: string): PerformanceMetric | null {
    const metric = this.metrics.get(id);
    if (!metric) return null;

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    // Log performance warnings
    if (duration > this.thresholds.slow) {
      console.warn(`🐌 Slow operation: ${metric.name} took ${duration.toFixed(2)}ms`, metric.metadata);
    } else if (duration > this.thresholds.warning) {
      console.warn(`⚠️  Slow operation: ${metric.name} took ${duration.toFixed(2)}ms`, metric.metadata);
    }

    this.metrics.delete(id);
    return metric;
  }

  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const id = this.start(name, metadata);
    try {
      const result = fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const id = this.start(name, metadata);
    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Performance decorator
export function measurePerformance<T extends (...args: any[]) => any>(
  name: string,
  metadata?: Record<string, any>
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measureAsync(
        `${target.constructor.name}.${propertyName}`,
        () => method.apply(this, args),
        { ...metadata, args: args.length }
      );
    };

    return descriptor;
  };
}

// React hook for measuring component performance
export function usePerformanceMonitor(componentName: string) {
  // This would need to be imported in a React component file
  // const startTime = React.useRef<number>();
  // 
  // React.useEffect(() => {
  //   startTime.current = performance.now();
  //   
  //   return () => {
  //     if (startTime.current) {
  //       const duration = performance.now() - startTime.current;
  //       console.log(`Component ${componentName} rendered in ${duration.toFixed(2)}ms`);
  //     }
  //   };
  // });
}

// Database query performance monitoring
export function withQueryPerformance<T extends (...args: any[]) => any>(
  operation: string,
  table: string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measureAsync(
        `DB.${operation}`,
        () => method.apply(this, args),
        { table, operation }
      );
    };

    return descriptor;
  };
}

// API route performance monitoring
export function withApiPerformance(routeName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measureAsync(
        `API.${routeName}`,
        () => method.apply(this, args),
        { route: routeName }
      );
    };

    return descriptor;
  };
}

// Web Vitals monitoring
export function measureWebVitals() {
  if (typeof window === 'undefined') return;

  // First Contentful Paint
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('FCP:', entry.startTime);
    }
  }).observe({ entryTypes: ['paint'] });

  // Largest Contentful Paint
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('LCP:', entry.startTime);
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('FID:', entry.processingStart - entry.startTime);
    }
  }).observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('CLS:', entry.value);
    }
  }).observe({ entryTypes: ['layout-shift'] });
}
