import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  const userPayload = token ? verifyToken(token.value) : null;
  
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const historyId = parseInt(params.id);

    // Verify ownership
    const history = await prisma.history.findUnique({
      where: { id: historyId },
    });

    if (!history || history.userId !== (userPayload as any).userId) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    await prisma.history.delete({
      where: { id: historyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('History Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete history' }, { status: 500 });
  }
}
