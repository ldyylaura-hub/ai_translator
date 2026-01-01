import { NextResponse } from 'next/server';
import { ocrClient } from '@/lib/tencent';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  
  if (!token || !verifyToken(token.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { imageBase64, mode = 'accurate', lang = 'auto' } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // Map frontend language codes to Tencent OCR LanguageType
    // See: https://cloud.tencent.com/document/product/866/33526
    const langMap: Record<string, string> = {
        'zh': 'zh',     // Chinese
        'en': 'eng',    // English
        'ja': 'jap',    // Japanese
        'ko': 'kor',    // Korean
        'fr': 'fre',    // French
        'es': 'spa',    // Spanish
        'de': 'ger',    // German
        'ru': 'rus',    // Russian
        'auto': 'auto'
    };

    const ocrLang = langMap[lang] || 'auto';

    // Strategy:
    // 1. If user explicitly selects a language (not 'auto' and not 'zh'), 
    //    we prefer GeneralBasicOCR because it supports 'LanguageType' hint, which drastically improves accuracy for specific scripts (like Japanese Kana).
    //    GeneralAccurateOCR DOES NOT support LanguageType hint and relies solely on auto-detection, which often fails for mixed CJK text.
    // 2. If mode is explicitly 'basic', we use GeneralBasicOCR.
    // 3. Otherwise (mode='accurate' AND lang='auto'/'zh'), we use GeneralAccurateOCR for best quality on Chinese/English.

    const shouldUseBasicWithLang = (ocrLang !== 'auto' && ocrLang !== 'zh');
    
    if (mode === 'basic' || shouldUseBasicWithLang) {
        console.log(`[OCR] Using Standard Edition (GeneralBasicOCR). Lang: ${ocrLang}, Mode: ${mode}`);
        const params: any = {
            ImageBase64: base64Data,
        };
        // Only add LanguageType if it's not auto (or if we want to force auto, but usually omitting it is safer for auto)
        if (ocrLang !== 'auto') {
            params.LanguageType = ocrLang;
        }

        const result = await ocrClient.GeneralBasicOCR(params);
        const text = result.TextDetections?.map((item: any) => item.DetectedText).join('\n');
        return NextResponse.json({ text, usedMode: 'basic', usedLang: ocrLang });
    } else {
        console.log(`[OCR] Using High-Precision Edition (GeneralAccurateOCR). Lang: ${ocrLang}, Mode: ${mode}`);
        // Default to Accurate (High Precision) - Best for Chinese/English/Auto
        const accurateParams = {
            ImageBase64: base64Data,
            IsPdf: false,
        };
        const result = await ocrClient.GeneralAccurateOCR(accurateParams);
        const text = result.TextDetections?.map((item: any) => item.DetectedText).join('\n');
        return NextResponse.json({ text, usedMode: 'accurate' });
    }

  } catch (error: any) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: error.message || 'OCR failed' }, { status: 500 });
  }
}
