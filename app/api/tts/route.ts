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
    const { text, lang, voiceType } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Map language to Edge TTS Voices (4 variations per language to match frontend selector)
    // Index 0: Female 1 (Zhiyu equivalent)
    // Index 1: Female 2 (Zhiling equivalent)
    // Index 2: Male 1 (Zhiping equivalent)
    // Index 3: Male 2 (Zhilun equivalent)
    const voiceOptions: Record<string, string[]> = {
        'zh': ['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-CN-YunxiNeural', 'zh-CN-YunjianNeural'],
        'en': ['en-US-AriaNeural', 'en-US-MichelleNeural', 'en-US-GuyNeural', 'en-US-ChristopherNeural'],
        'ja': ['ja-JP-NanamiNeural', 'ja-JP-AoiNeural', 'ja-JP-KeitaNeural', 'ja-JP-DaichiNeural'],
        'ko': ['ko-KR-SunHiNeural', 'ko-KR-SunHiNeural', 'ko-KR-InJoonNeural', 'ko-KR-InJoonNeural'], // Limited Korean voices
        'fr': ['fr-FR-DeniseNeural', 'fr-FR-CelesteNeural', 'fr-FR-HenriNeural', 'fr-FR-JeromeNeural'],
        'de': ['de-DE-KatjaNeural', 'de-DE-AmalaNeural', 'de-DE-ConradNeural', 'de-DE-KillianNeural'],
        'es': ['es-ES-ElviraNeural', 'es-ES-AbrilNeural', 'es-ES-AlvaroNeural', 'es-ES-ArnauNeural'],
        'ru': ['ru-RU-SvetlanaNeural', 'ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural', 'ru-RU-DmitryNeural'],
    };

    let voice = 'en-US-AriaNeural'; // Default
    
    const targetLang = lang || 'en';
    const availableVoices = voiceOptions[targetLang] || voiceOptions['en'];
    
    // Map 101001-101004 to 0-3
    let voiceIndex = 0;
    if (voiceType && voiceType >= 101001 && voiceType <= 101004) {
        voiceIndex = voiceType - 101001;
    }
    
    // Safety check
    if (voiceIndex >= 0 && voiceIndex < availableVoices.length) {
        voice = availableVoices[voiceIndex];
    } else {
        voice = availableVoices[0];
    }
    
    console.log(`[TTS] Generating for lang: ${targetLang}, voiceType: ${voiceType}, selected: ${voice}`);

    let tts;
    try {
        tts = new Communicate(text, { voice });
    } catch (e) {
        console.error('[TTS] Communicate init failed:', e);
        throw e;
    }
    
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
