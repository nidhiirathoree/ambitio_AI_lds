import '@/lib/backend-init';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { loadEditEvents } = await import('@backend/learning/editCapture');
    const events = loadEditEvents();
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ events: [], error: String(e) }, { status: 500 });
  }
}
