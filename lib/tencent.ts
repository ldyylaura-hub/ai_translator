import * as tencentcloud from 'tencentcloud-sdk-nodejs';

const OcrClient = tencentcloud.ocr.v20181119.Client;
const TmtClient = tencentcloud.tmt.v20180321.Client;
const TtsClient = tencentcloud.tts.v20190823.Client;

const clientConfig = {
  credential: {
    secretId: process.env.TENCENT_SECRET_ID || '',
    secretKey: process.env.TENCENT_SECRET_KEY || '',
  },
  region: 'ap-guangzhou',
  profile: {
    httpProfile: {
      endpoint: 'ocr.tencentcloudapi.com',
    },
  },
};

// OCR Client
export const ocrClient = new OcrClient({
  ...clientConfig,
  profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } }
});

// Translation Client
export const tmtClient = new TmtClient({
  ...clientConfig,
  profile: { httpProfile: { endpoint: 'tmt.tencentcloudapi.com' } }
});

// TTS Client
export const ttsClient = new TtsClient({
  ...clientConfig,
  profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com' } }
});
