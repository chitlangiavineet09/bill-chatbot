import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const url = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/ocr-stream`;
    
    const res = await fetch(url, { 
      method: "POST", 
      body: formData
    });
    
    if (!res.ok) {
      throw new Error(`Backend error: ${res.status} ${res.statusText}`);
    }
    
    // Return the streaming response directly
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error('OCR Stream API Error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'OCR streaming failed. Please check if the backend server is running.' 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
}
