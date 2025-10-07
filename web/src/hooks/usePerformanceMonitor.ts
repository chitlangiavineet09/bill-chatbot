"use client";
import { useRef, useEffect } from "react";

export function usePerformanceMonitor(componentName: string) {
  const startTime = useRef<number>();
  
  useEffect(() => {
    startTime.current = performance.now();
    
    return () => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current;
        console.log(`Component ${componentName} rendered in ${duration.toFixed(2)}ms`);
      }
    };
  });
}
