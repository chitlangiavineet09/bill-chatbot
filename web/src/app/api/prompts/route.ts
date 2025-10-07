import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  // Note: Prompts endpoint does not require authentication for reading
  // TODO: Add authentication back if prompts contain sensitive information
  try {
    const response = await fetch(`${BACKEND_URL}/prompts`);
    
    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Keep authentication for POST (updating prompts) - only admins should update
  const auth = await requireAuth('Admin');
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating prompts:', error);
    return NextResponse.json(
      { error: 'Failed to update prompts' },
      { status: 500 }
    );
  }
}
