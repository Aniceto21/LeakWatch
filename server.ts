import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser with 25MB limit to handle up to 5 compressed base64 images
app.use(express.json({ limit: '25mb' }));

// In-memory rate limiting to protect the Gemini API
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 40;

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Analysis request rate limit reached. Please wait a minute and try again.',
    });
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  next();
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const OFFICIAL_CIVIC_CATEGORIES = [
  'Water Leakage',
  'Potholes',
  'Road Damage',
  'Public Infrastructure',
  'Other Civic Issues',
  'Unclear or Unsupported Image',
] as const;

const ALLOWED_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const ALLOWED_DECISIONS = [
  'LEAKAGE_DETECTED',
  'ISSUE_DETECTED',
  'DAMAGE_DETECTED',
  'POSSIBLE_LEAKAGE',
  'POSSIBLE_ISSUE',
  'NO_LEAKAGE_VISIBLE',
  'UNRELATED_IMAGE',
  'UNCLEAR_IMAGE',
  'CONFLICTING_IMAGES',
] as const;

interface ImagePayload {
  imageBase64: string;
  mimeType?: string;
}

function cleanBase64(raw: string): string {
  return raw.includes(',') ? raw.split(',')[1] : raw;
}

function normalizeCategory(raw?: string): (typeof OFFICIAL_CIVIC_CATEGORIES)[number] {
  if (!raw) return 'Unclear or Unsupported Image';
  const exact = OFFICIAL_CIVIC_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  if (exact) return exact;

  const lower = raw.toLowerCase();
  if (
    lower.includes('unclear') ||
    lower.includes('unrelated') ||
    lower.includes('unsupported') ||
    lower.includes('document') ||
    lower.includes('notice') ||
    lower.includes('not identified')
  ) {
    return 'Unclear or Unsupported Image';
  }
  if (lower.includes('pothole')) return 'Potholes';
  if (lower.includes('road') || lower.includes('footpath') || lower.includes('asphalt') || lower.includes('pavement')) {
    return 'Road Damage';
  }
  if (
    lower.includes('water') ||
    lower.includes('leak') ||
    lower.includes('pipe') ||
    lower.includes('valve') ||
    lower.includes('tank')
  ) {
    return 'Water Leakage';
  }
  if (
    lower.includes('manhole') ||
    lower.includes('drain') ||
    lower.includes('infrastructure') ||
    lower.includes('streetlight') ||
    lower.includes('culvert')
  ) {
    return 'Public Infrastructure';
  }
  return 'Other Civic Issues';
}

function normalizeSeverity(raw?: string): (typeof ALLOWED_SEVERITIES)[number] {
  if (!raw) return 'Medium';
  const match = ALLOWED_SEVERITIES.find((s) => s.toLowerCase() === raw.trim().toLowerCase());
  return match || 'Medium';
}

function clampConfidence01(raw: any): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0.5;
  if (num > 1 && num <= 100) return Math.round((num / 100) * 100) / 100;
  return Math.max(0, Math.min(1, Math.round(num * 100) / 100));
}

export async function analyzeCivicImagesWithGemini(images: ImagePayload[]) {
  if (!process.env.GEMINI_API_KEY) {
    const err: any = new Error('Server GEMINI_API_KEY is not configured.');
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }

  const promptText = `
You are the senior municipal & civil infrastructure AI Vision inspector for LeakWatch Goa (Public Works Department & Civic Infrastructure Portal, Goa, India).
Analyze the following ${images.length} uploaded photograph(s) accurately and honestly.

### OFFICIAL SUPPORTED CATEGORIES (MUST use exact strings):
1. "Water Leakage" — broken water pipelines, leaking pipe joints/valves, overflowing water tanks, roadside potable water leakage, damaged supply connections/taps.
2. "Potholes" — small, large, deep, multiple, or water-filled potholes/cavities in roads or streets.
3. "Road Damage" — cracked, sunken, or broken asphalt/concrete road surfaces, damaged/collapsed footpaths, broken road edges/shoulders (without main circular pothole cavities).
4. "Public Infrastructure" — open/uncovered manholes, damaged drainage covers/gratings, broken public culverts, broken streetlights, damaged public utility structures/railings.
5. "Other Civic Issues" — other legitimate public municipal/civic infrastructure issues (e.g., clogged open stormwater drains, fallen utility poles, broken public benches/barriers).
6. "Unclear or Unsupported Image" — printed documents, government/public notices, circulars, receipts, screenshots, blank walls, portraits, pets, indoor personal items, or images too blurry/dark/cropped to verify any real physical civic problem.

### STRICT VISUAL INSPECTION RULES:
1. **NO HALLUCINATION / DOCUMENT REJECTION (ZERO TOLERANCE):**
   - Inspect ONLY what is actually visible in the pixels. Do NOT invent unseen water leaks, potholes, pipes, or road damage.
   - If an image shows a printed notice, flyer, text circular, government document, book page, or screenshot (even if the text says "Water", "Road", "Notice", or "PWD"), classify that photo as "Unclear or Unsupported Image", set isCivicIssue: false, and visualDecision: "UNRELATED_IMAGE".
   - If an image is too blurry, dark, or ambiguous to determine a real civic issue, classify as "Unclear or Unsupported Image", isCivicIssue: false, needsHumanReview: true, visualDecision: "UNCLEAR_IMAGE".

2. **PER-IMAGE INDIVIDUAL ANALYSIS ("imageAnalysis" array of length ${images.length}):**
   - For each photograph (1..${images.length}), return:
     - imageIndex (1-indexed integer)
     - category (one of the 6 exact strings above)
     - detectedIssue (concise specific phrase, e.g. "Deep Water-Filled Pothole", "Leaking Roadside Water Valve", "Cracked Asphalt Road Surface", "Open Stormwater Manhole", "Printed Public Notice Document")
     - description (1–2 honest factual sentences of what is visibly seen in that photo)
     - severity ("Low" | "Medium" | "High" | "Critical")
     - confidence (number from 0.0 to 1.0 estimating visual classification confidence; label honestly—do not inflate uncertain cases)
     - isCivicIssue (boolean: true ONLY if real physical public/civic infrastructure problem is visible)
     - visualDecision ("LEAKAGE_DETECTED" for visible active water leaks, "ISSUE_DETECTED" for clear potholes/road damage/infra issues, "DAMAGE_DETECTED" for broken utility assets without active water spray, "POSSIBLE_ISSUE" if partial/ambiguous, "UNRELATED_IMAGE" if document/screenshot/non-civic object, "UNCLEAR_IMAGE" if dark/blurry)
     - visibleEvidence (array of 2–4 short concrete visual cues)

3. **MULTI-IMAGE CONFLICT DETECTION:**
   - Multiple photographs of the **same** problem (e.g. a close-up and a wide shot of the same leaking pipe, or two angles of the same pothole cluster) MUST have hasUnrelatedMultipleIssues: false.
   - If ${images.length} > 1 and the photographs clearly depict **distinct, unrelated civic issues** (e.g. Photo 1 shows a water pipeline leak and Photo 2 shows an unrelated pothole or broken drainage cover on a different site), set hasUnrelatedMultipleIssues: true, needsHumanReview: true, visualDecision: "CONFLICTING_IMAGES", and explain clearly in unrelatedIssuesReason so the citizen can submit them as separate complaints.
   - Never assume an overall civic issue if ALL images are unrelated documents or unclear.

4. **OVERALL FIELDS:**
   - category: one of the 6 exact official strings.
   - detectedIssue: concise summary title (e.g. "Pressurized Roadside Pipeline Leak", "Deep Asphalt Pothole Cluster").
   - description: clear, citizen-ready 2–3 sentence description suitable for submitting as the complaint description.
   - severity: "Low" (minor surface wear/slow drip), "Medium" (moderate crack/steady leak/pothole needing repair), "High" (deep pothole, pressurized main burst, major road collapse), "Critical" (open manhole hazard, dangerous road cave-in, heavy trunk main flooding).
   - confidence: float 0.0–1.0.
   - isCivicIssue: boolean.
   - needsHumanReview: boolean (true if unclear, conflicting images, partial evidence, or confidence < 0.70).
   - recommendedAction: actionable step for Goa PWD / municipal field engineers.
`;

  const contentParts: any[] = [{ text: promptText }];
  images.forEach((img, index) => {
    contentParts.push({ text: `=== PHOTOGRAPH ${index + 1} OF ${images.length} ===` });
    contentParts.push({
      inlineData: {
        mimeType: img.mimeType || 'image/jpeg',
        data: cleanBase64(img.imageBase64),
      },
    });
  });

  const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let response: any = null;
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: contentParts },
        config: {
          systemInstruction:
            'You are a careful civil & municipal infrastructure visual auditor for LeakWatch Goa. Describe only what is physically visible in the pixels. Never invent civic defects on printed text documents, notices, or unrelated photos. Output strict JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              detectedIssue: { type: Type.STRING },
              description: { type: Type.STRING },
              severity: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              isCivicIssue: { type: Type.BOOLEAN },
              needsHumanReview: { type: Type.BOOLEAN },
              hasUnrelatedMultipleIssues: { type: Type.BOOLEAN },
              unrelatedIssuesReason: { type: Type.STRING },
              visualDecision: { type: Type.STRING },
              visibleEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedAction: { type: Type.STRING },
              imageAnalysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    imageIndex: { type: Type.INTEGER },
                    category: { type: Type.STRING },
                    detectedIssue: { type: Type.STRING },
                    description: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    isCivicIssue: { type: Type.BOOLEAN },
                    visualDecision: { type: Type.STRING },
                    visibleEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: [
                    'imageIndex',
                    'category',
                    'detectedIssue',
                    'description',
                    'severity',
                    'confidence',
                    'isCivicIssue',
                    'visualDecision',
                    'visibleEvidence',
                  ],
                },
              },
            },
            required: [
              'category',
              'detectedIssue',
              'description',
              'severity',
              'confidence',
              'isCivicIssue',
              'needsHumanReview',
              'hasUnrelatedMultipleIssues',
              'visualDecision',
              'visibleEvidence',
              'recommendedAction',
              'imageAnalysis',
            ],
          },
        },
      });
      if (response && response.text) break;
    } catch (err: any) {
      lastError = err;
      console.warn(`Vision model ${modelName} failed:`, err?.message || err);
    }
  }

  if (!response || !response.text) {
    throw lastError || new Error('All Gemini Vision candidate models failed.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(response.text.trim());
  } catch (parseErr: any) {
    throw new Error(`Invalid JSON returned from Gemini Vision: ${parseErr?.message || parseErr}`);
  }

  // Normalize per-image analysis items
  const normalizedImages = Array.isArray(parsed.imageAnalysis)
    ? parsed.imageAnalysis.map((img: any, idx: number) => {
        const cat = normalizeCategory(img.category);
        const conf01 = clampConfidence01(img.confidence);
        const sev = normalizeSeverity(img.severity);
        const isCivic = cat !== 'Unclear or Unsupported Image' && Boolean(img.isCivicIssue !== false);
        const decision = ALLOWED_DECISIONS.includes(img.visualDecision)
          ? img.visualDecision
          : isCivic
          ? cat === 'Water Leakage'
            ? 'LEAKAGE_DETECTED'
            : 'ISSUE_DETECTED'
          : 'UNCLEAR_IMAGE';

        return {
          imageIndex: Number(img.imageIndex) || idx + 1,
          category: cat,
          detectedIssue: String(img.detectedIssue || cat),
          description: String(img.description || 'Visual observation recorded.'),
          severity: sev,
          confidence: conf01,
          isCivicIssue: isCivic,
          visualDecision: decision,
          visibleEvidence: Array.isArray(img.visibleEvidence) ? img.visibleEvidence.map(String) : [],
          // Backward compatibility
          leakageCategory: cat,
          problemDescription: String(img.description || 'Visual observation recorded.'),
          confidenceScore: Math.round(conf01 * 100),
        };
      })
    : [];

  // Normalize top-level fields
  let overallCategory = normalizeCategory(parsed.category);
  let overallConfidence = clampConfidence01(parsed.confidence);
  let overallSeverity = normalizeSeverity(parsed.severity);
  let isCivicIssue = overallCategory !== 'Unclear or Unsupported Image' && Boolean(parsed.isCivicIssue);
  let needsHumanReview = Boolean(parsed.needsHumanReview) || overallConfidence < 0.7;
  let hasUnrelatedMultipleIssues = Boolean(parsed.hasUnrelatedMultipleIssues);
  let unrelatedIssuesReason = String(parsed.unrelatedIssuesReason || '');
  let visualDecision = ALLOWED_DECISIONS.includes(parsed.visualDecision)
    ? parsed.visualDecision
    : isCivicIssue
    ? overallCategory === 'Water Leakage'
      ? 'LEAKAGE_DETECTED'
      : 'ISSUE_DETECTED'
    : 'UNRELATED_IMAGE';

  let detectedIssue = String(parsed.detectedIssue || overallCategory);
  let description = String(parsed.description || 'Civic infrastructure photograph submitted for review.');
  let visibleEvidence: string[] = Array.isArray(parsed.visibleEvidence) ? parsed.visibleEvidence.map(String) : [];
  let recommendedAction = String(
    parsed.recommendedAction || 'Assign concerned Goa PWD / municipal field engineer for site inspection.'
  );

  // Programmatic multi-image consistency checks
  if (normalizedImages.length > 0) {
    const allUnrelatedOrDocs = normalizedImages.every(
      (img: any) =>
        img.visualDecision === 'UNRELATED_IMAGE' ||
        (img.category === 'Unclear or Unsupported Image' &&
          /document|notice|circular|screenshot|paper|flyer|poster/i.test(
            `${img.detectedIssue} ${img.description}`
          ))
    );

    const allUnclear = normalizedImages.every((img: any) => img.visualDecision === 'UNCLEAR_IMAGE');

    const validCivicImages = normalizedImages.filter((img: any) => img.isCivicIssue);
    const distinctValidCategories = new Set(validCivicImages.map((img: any) => img.category));

    if (allUnrelatedOrDocs) {
      overallCategory = 'Unclear or Unsupported Image';
      isCivicIssue = false;
      needsHumanReview = true;
      hasUnrelatedMultipleIssues = false;
      visualDecision = 'UNRELATED_IMAGE';
      overallSeverity = 'Low';
      overallConfidence = Math.max(0.9, overallConfidence);
      const isDocLike = /document|notice|circular|screenshot|paper|flyer|poster/i.test(
        `${detectedIssue} ${description}`
      );
      if (isDocLike) {
        detectedIssue = 'Printed Notice / Non-Civic Image';
      }
      if (!description || description.length < 15) {
        description =
          images.length > 1
            ? `All ${images.length} uploaded images appear unrelated to physical civic infrastructure.`
            : 'The uploaded image does not appear to show a real-world civic infrastructure issue.';
      }
      if (visibleEvidence.length === 0) {
        visibleEvidence = ['No physical road surface, pipeline, or public infrastructure defect verified'];
      }
      recommendedAction = 'Ask citizen to upload clear on-site photographs of the actual civic issue.';
    } else if (allUnclear) {
      overallCategory = 'Unclear or Unsupported Image';
      isCivicIssue = false;
      needsHumanReview = true;
      hasUnrelatedMultipleIssues = false;
      visualDecision = 'UNCLEAR_IMAGE';
      overallSeverity = 'Low';
      detectedIssue = 'Unclear / Blurry / Dark Photograph';
    } else if (distinctValidCategories.size > 1 || hasUnrelatedMultipleIssues) {
      hasUnrelatedMultipleIssues = true;
      needsHumanReview = true;
      visualDecision = 'CONFLICTING_IMAGES';
      if (!unrelatedIssuesReason) {
        unrelatedIssuesReason = `Uploaded photographs appear to depict multiple distinct civic categories (${Array.from(
          distinctValidCategories
        ).join(', ')}). Please keep only photos of the same incident or submit unrelated issues as separate complaints.`;
      }
    }
  }

  const confidenceScore = Math.round(overallConfidence * 100);
  const verificationStatus =
    !isCivicIssue && overallCategory === 'Unclear or Unsupported Image'
      ? 'NOT_ENOUGH_EVIDENCE'
      : needsHumanReview
      ? 'REQUIRES_HUMAN_REVIEW'
      : 'AI_ANALYSED';

  return {
    category: overallCategory,
    detectedIssue,
    description,
    severity: overallSeverity,
    confidence: overallConfidence,
    isCivicIssue,
    needsHumanReview,
    hasUnrelatedMultipleIssues,
    unrelatedIssuesReason: unrelatedIssuesReason || undefined,

    // Compatibility fields
    isWaterLeakRelated: overallCategory === 'Water Leakage',
    visualDecision,
    leakageCategory: overallCategory,
    problemDescription: description,
    visibleEvidence,
    confidenceScore,
    verificationStatus,
    recommendedAction,
    imageAnalysis: normalizedImages,
    aiDescription: description,
    aiConfidence: confidenceScore,
    aiVerificationStatus:
      visualDecision === 'UNRELATED_IMAGE'
        ? 'Unrelated'
        : isCivicIssue && !needsHumanReview
        ? 'Verified'
        : 'Needs Admin Review',
  };
}

/**
 * Shared AI civic issue analysis handler
 */
async function handleAnalyzeCivicIssue(req: express.Request, res: express.Response) {
  try {
    let images: ImagePayload[] = [];

    if (Array.isArray(req.body.images)) {
      images = req.body.images;
    } else if (req.body.imageBase64) {
      images = [{ imageBase64: req.body.imageBase64, mimeType: req.body.mimeType || 'image/jpeg' }];
    }

    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'At least one photograph is required for AI visual analysis.' });
    }

    if (images.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 photographs are permitted per complaint.' });
    }

    for (let i = 0; i < images.length; i++) {
      const data = cleanBase64(images[i].imageBase64 || '');
      if (!data || data.length < 50) {
        return res.status(400).json({ error: `Photograph ${i + 1} contains invalid or empty image data.` });
      }
    }

    const analysisResult = await analyzeCivicImagesWithGemini(images);
    return res.json(analysisResult);
  } catch (error: any) {
    console.error('Gemini Vision multi-category analysis failed:', error?.message || error);
    return res.status(503).json({
      error:
        'Gemini Vision AI analysis is currently unavailable. You may retry AI analysis or manually select a category and enter a description.',
      code: error?.code || 'GEMINI_ANALYSIS_FAILED',
      details: error?.message || String(error),
    });
  }
}

app.post('/api/ai/analyze-leak', rateLimiter, handleAnalyzeCivicIssue);
app.post('/api/ai/analyze-issue', rateLimiter, handleAnalyzeCivicIssue);

/**
 * Unified WhatsApp Webhook Verification & Civic Issue Ingestion Endpoint
 * Note: Requires WHATSAPP_VERIFY_TOKEN & WHATSAPP_ACCESS_TOKEN environment variables for live Meta Cloud API.
 */
app.get('/api/whatsapp/webhook', (req: express.Request, res: express.Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return res.status(503).json({
      error: 'WHATSAPP_VERIFY_TOKEN is not configured on the server.',
      configured: false,
    });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return res.status(200).send(String(challenge || ''));
  }

  return res.sendStatus(403);
});

app.post('/api/whatsapp/webhook', rateLimiter, async (req: express.Request, res: express.Response) => {
  try {
    // Extract sender phone from Meta webhook format or direct test JSON payload
    const entryMessage = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const senderPhone = entryMessage?.from || req.body?.from || req.body?.senderPhone;

    if (!senderPhone) {
      return res.status(400).json({
        error: 'Missing sender phone number in WhatsApp webhook payload.',
      });
    }

    const locationText =
      req.body?.location ||
      entryMessage?.location?.address ||
      entryMessage?.text?.body ||
      req.body?.text ||
      'Submitted via WhatsApp';

    const imageBase64 = req.body?.imageBase64;
    const mimeType = req.body?.mimeType || 'image/jpeg';

    let aiAnalysis: any = null;
    if (imageBase64) {
      aiAnalysis = await analyzeCivicImagesWithGemini([{ imageBase64, mimeType }]);
    }

    return res.status(200).json({
      received: true,
      channel: 'whatsapp',
      contactNumber: String(senderPhone),
      location: String(locationText),
      aiAnalysis,
      whatsappLiveCredentialsConfigured: !!(
        process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN
      ),
    });
  } catch (error: any) {
    console.error('WhatsApp webhook processing error:', error);
    return res.status(500).json({
      error: 'Failed to process WhatsApp civic issue submission.',
      details: error?.message || String(error),
    });
  }
});

app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'LeakWatch Goa API',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasWhatsappConfig: !!(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN),
    timestamp: new Date().toISOString(),
  });
});

// Setup Vite in development or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`LeakWatch Goa server running on port ${PORT} (dev mode: ${!isProd})`);
  });
}

startServer();
