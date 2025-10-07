import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  try {
    const formData = await req.formData();
    const url = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/ocr`;
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
    
    const res = await fetch(url, { 
      method: "POST", 
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`Backend error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.text();
    return new Response(data, { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error('OCR API Error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(JSON.stringify({ 
        error: 'Request timeout - OCR processing is taking too long. Please try with a smaller file or try again.' 
      }), { 
        status: 408,
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'OCR processing failed. Please check if the backend server is running.' 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
}
