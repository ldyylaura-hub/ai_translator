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
    const { imageBase64, mode = 'accurate' } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // Mode selection: 'accurate' (High Precision) vs 'basic' (Standard)
    if (mode === 'basic') {
        const params = {
            ImageBase64: base64Data,
            // LanguageType: "auto", // Basic OCR supports LanguageType
        };
        const result = await ocrClient.GeneralBasicOCR(params);
        const text = result.TextDetections?.map((item: any) => item.DetectedText).join('\n');
        return NextResponse.json({ text });
    } else {
        // Default to Accurate
        const accurateParams = {
            ImageBase64: base64Data,
            IsPdf: false,
        };
        const result = await ocrClient.GeneralAccurateOCR(accurateParams);
        const text = result.TextDetections?.map((item: any) => item.DetectedText).join('\n');
        return NextResponse.json({ text });
    }

  } catch (error: any) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: error.message || 'OCR failed' }, { status: 500 });
  }
}
