import { NextResponse } from 'next/server';
import { ttsClient } from '@/lib/tencent';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  
  if (!token || !verifyToken(token.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text, voiceType = 101001 } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const params = {
      Text: text,
      SessionId: `session-${Date.now()}`,
      ModelType: 1,
      VoiceType: Number(voiceType),
    };

    const result = await ttsClient.TextToVoice(params);
    
    // Result contains Audio which is base64 string
    return NextResponse.json({ audio: result.Audio });
  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message || 'TTS failed' }, { status: 500 });
  }
}
