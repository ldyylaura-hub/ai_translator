import { NextResponse } from 'next/server';
import { tmtClient } from '@/lib/tencent';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  const userPayload = token ? verifyToken(token.value) : null;
  
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text, sourceLang = 'auto', targetLang } = await request.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: 'Text and target language are required' }, { status: 400 });
    }

    // Limit text length to 2000 chars for free tier safety, but allow more than default
    if (text.length > 2000) {
        return NextResponse.json({ error: 'Text too long (max 2000 chars)' }, { status: 400 });
    }

    const params = {
      SourceText: text,
      Source: sourceLang,
      Target: targetLang,
      ProjectId: 0,
    };

    let result;
    try {
        result = await tmtClient.TextTranslate(params);
    } catch (error: any) {
        // Fallback for Auto-Detect failure (e.g. short text like "hi")
        // Tencent might return "LanguageRecognitionErr" or Chinese error message
        if (sourceLang === 'auto') {
            let retryLang = '';
            if (/^[\x00-\x7F]+$/.test(text)) retryLang = 'en'; // ASCII -> English
            else if (/[\u3040-\u30ff]/.test(text)) retryLang = 'ja'; // Kana -> Japanese
            else if (/[\uac00-\ud7af]/.test(text)) retryLang = 'ko'; // Hangul -> Korean
            else if (/[\u4e00-\u9fa5]/.test(text)) retryLang = 'zh'; // Hanzi -> Chinese
            
            if (retryLang) {
                console.log(`[Translate] Auto-detect failed, retrying with inferred lang: ${retryLang}`);
                params.Source = retryLang;
                result = await tmtClient.TextTranslate(params);
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    }

    const translatedText = result.TargetText || '';

    // Save to history
    // @ts-ignore
    await prisma.history.create({
      data: {
        sourceText: text,
        translatedText: translatedText,
        sourceLang: sourceLang,
        targetLang: targetLang,
        userId: (userPayload as any).userId,
      },
    });

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error('Translation Error:', error);
    return NextResponse.json({ error: error.message || 'Translation failed' }, { status: 500 });
  }
}
