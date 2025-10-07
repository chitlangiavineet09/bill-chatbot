import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/chat`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

  // Stream back as-is (SSE)
  const readable = res.body;
  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
