import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { Communicate } from 'edge-tts-universal';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  
  if (!token || !verifyToken(token.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text, lang, voiceType, voiceName } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let voice = 'en-US-AriaNeural'; // Default fallback

    // Priority 1: Direct Voice Name (from new frontend)
    if (voiceName) {
        voice = voiceName;
    } 
    // Priority 2: Legacy VoiceType Mapping
    else {
        // Determine gender from voiceType (Tencent IDs)
        // Female: 101001, 101002
        // Male: 101003, 101004
        const isMale = voiceType === 101003 || voiceType === 101004;
        const gender = isMale ? 'male' : 'female';
    
        // Map language and gender to Edge TTS Voice
        const voiceMap: Record<string, { female: string, male: string }> = {
            'zh': { female: 'zh-CN-XiaoxiaoNeural', male: 'zh-CN-YunxiNeural' },
            'en': { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' },
            'ja': { female: 'ja-JP-NanamiNeural', male: 'ja-JP-KeitaNeural' },
            'ko': { female: 'ko-KR-SunHiNeural', male: 'ko-KR-InJoonNeural' },
            'fr': { female: 'fr-FR-DeniseNeural', male: 'fr-FR-HenriNeural' },
            'de': { female: 'de-DE-KatjaNeural', male: 'de-DE-ConradNeural' },
            'es': { female: 'es-ES-ElviraNeural', male: 'es-ES-AlvaroNeural' },
            'ru': { female: 'ru-RU-SvetlanaNeural', male: 'ru-RU-DmitryNeural' },
        };
        
        if (lang && voiceMap[lang]) {
            voice = voiceMap[lang][gender];
        }
    }

    const tts = new Communicate(text, { voice });
    
    const chunks: Buffer[] = [];
    for await (const chunk of tts.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
            chunks.push(chunk.data);
        }
    }
    
    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');

    return NextResponse.json({ audio: audioBase64 });
  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message || 'TTS failed' }, { status: 500 });
  }
}
