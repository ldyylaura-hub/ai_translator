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
    const body = await request.json();
    const { text, lang, voiceType, voiceName } = body;

    console.log(`[TTS DEBUG] Request received. textlen=${text?.length}, lang=${lang}, voiceName=${voiceName}, voiceType=${voiceType}`);

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let voice = 'en-US-AriaNeural'; // Default fallback

    // Priority 1: Direct Voice Name
    if (voiceName && typeof voiceName === 'string' && voiceName.length > 0) {
        voice = voiceName;
    } 
    // Priority 2: Legacy VoiceType Mapping
    else {
        // Determine gender from voiceType (Tencent IDs)
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

    console.log(`[TTS DEBUG] Initializing Communicate with voice: "${voice}"`);
    
    // Create options object explicitly
    // Simplify options to avoid potential formatting issues with rate/pitch
    const options = { voice };
    
    console.log(`[TTS DEBUG] Communicate initialized with options:`, JSON.stringify(options));
    
    const tts = new Communicate(text, options);
    
    console.log(`[TTS DEBUG] Communicate initialized. Starting stream...`);
    
    const chunks: Buffer[] = [];

    for await (const chunk of tts.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(chunk.data);
      }
    }
    
    console.log(`[TTS DEBUG] Stream finished. Collected ${chunks.length} chunks.`);

    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    return NextResponse.json({ audio: audioUrl });
  } catch (error: any) {
    console.error('[TTS ERROR] Detailed error:', error);
    // Print stack trace if available
    if (error.stack) console.error(error.stack);
    return NextResponse.json({ error: 'TTS failed', details: error.message }, { status: 500 });
  }
}
