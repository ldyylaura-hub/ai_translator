import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  const userPayload = token ? verifyToken(token.value) : null;
  
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const history = await prisma.history.findMany({
      // @ts-ignore
      where: { userId: (userPayload as any).userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('History Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
