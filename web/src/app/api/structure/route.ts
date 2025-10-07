import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import fs from 'fs';
import path from 'path';

const STRUCTURE_FILE_PATH = path.join(process.cwd(), '..', 'server', 'structure.json');

export async function GET() {
  // Note: Structure endpoint does not require authentication for reading
  // TODO: Add authentication back if structure contains sensitive information
  try {
    const structureData = fs.readFileSync(STRUCTURE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(structureData);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error reading structure.json:', error);
    return NextResponse.json(
      { error: 'Failed to read structure.json' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('Admin');
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json();
    
    // Validate the JSON structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON structure' },
        { status: 400 }
      );
    }

    // Write the updated structure to file
    fs.writeFileSync(STRUCTURE_FILE_PATH, JSON.stringify(body, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing structure.json:', error);
    return NextResponse.json(
      { error: 'Failed to write structure.json' },
      { status: 500 }
    );
  }
}
