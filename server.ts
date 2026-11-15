import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { INITIAL_LISTINGS, INITIAL_PROJECTS, INITIAL_SEARCH_REQUESTS, INITIAL_LEASE_CONTRACTS, DISTRICT_PRICE_TRENDS } from './src/data/mockData';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  return eqArg ? eqArg.split('=')[1] : undefined;
}

const app = express();
const cliPort = getArgValue('--port');
const PORT = cliPort ? parseInt(cliPort, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
const HOST = getArgValue('--host') || '0.0.0.0';

app.use(express.json());

// Lazy-load Gemini SDK so server binds port 3000 immediately on cold start
const apiKey = process.env.GEMINI_API_KEY || '';
let cachedAi: any = null;
async function getAiClient() {
  if (!apiKey) return null;
  if (cachedAi) return cachedAi;
  const { GoogleGenAI } = await import('@google/genai');
  cachedAi = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedAi;
}

// In-memory data store reflecting PostgreSQL tables
let dbListings = [...INITIAL_LISTINGS];
let dbProjects = [...INITIAL_PROJECTS];
let dbSearchRequests = [...INITIAL_SEARCH_REQUESTS];
let dbLeaseContracts = [...INITIAL_LEASE_CONTRACTS];

// ============================================================================
// SECTION 12: API DESIGN (REST Endpoints under /api/v1)
// ============================================================================

// 12.1 Auth & Users
app.post('/api/v1/auth/otp/request', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: 'Phone number required' });
    return;
  }
  res.json({
    success: true,
    message: `OTP 6-digit code loo diray ${phone}`,
    expiresInSeconds: 300,
  });
});

app.post('/api/v1/auth/otp/verify', (req: Request, res: Response) => {
  const { phone, code } = req.body;
  res.json({
    success: true,
    accessToken: `jwt_access_${Date.now()}`,
    refreshToken: `jwt_refresh_${Date.now()}`,
    user: {
      id: 'u-user-01',
      phone,
      role: 'seeker',
      status: 'active',
    },
  });
});

// 12.2 & 12.4 Listings & Map Viewport Query
// Response format verbatim matching Blueprint Section 12.4 Page 25
app.get('/api/v1/listings/map', (req: Request, res: Response) => {
  const purpose = req.query.purpose as string;
  const type = req.query.type as string;
  const maxPrice = req.query.price_max ? parseFloat(req.query.price_max as string) : null;

  let filtered = dbListings.filter((l) => l.status === 'live');
  if (purpose && purpose !== 'all') {
    filtered = filtered.filter((l) => l.purpose === purpose);
  }
  if (type && type !== 'all') {
    filtered = filtered.filter((l) => l.property_type === type);
  }
  if (maxPrice) {
    filtered = filtered.filter((l) => l.price <= maxPrice);
  }

  const pins = filtered.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    price: l.price,
    label: l.price >= 1000000 ? `${(l.price / 1000000).toFixed(1)}M` : l.price >= 1000 ? `${Math.round(l.price / 1000)}K` : `$${l.price}`,
    verified: l.verified,
    featured: l.featured,
  }));

  res.json({
    total_matching: 23540,
    returned: filtered.length,
    pins,
    clusters: [
      { lat: 9.5600, lng: 44.0650, count: 18 },
      { lat: 9.5350, lng: 44.0850, count: 8 },
    ],
    cards: {
      broker: {
        name: 'District Broker',
        district: 'Jigjiga Yar',
        unread: true,
      },
      company: {
        name: 'Dahabshiil Real Estate',
        projects: 7,
      },
    },
  });
});

app.get('/api/v1/listings', (req: Request, res: Response) => {
  res.json({
    data: dbListings,
    total: dbListings.length,
  });
});

app.get('/api/v1/listings/:id', (req: Request, res: Response) => {
  const item = dbListings.find((l) => l.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }
  res.json(item);
});

app.post('/api/v1/listings', (req: Request, res: Response) => {
  const newListing = {
    ...req.body,
    id: `hga-${Date.now().toString().slice(-4)}`,
    status: 'pending', // Pending moderation
    createdAt: new Date().toISOString(),
  };
  dbListings.unshift(newListing);
  res.status(201).json(newListing);
});

// 12.3 Projects, Bookings, Analytics
app.get('/api/v1/projects', (_req: Request, res: Response) => {
  res.json(dbProjects);
});

app.get('/api/v1/stats/avg-prices', (_req: Request, res: Response) => {
  res.json(DISTRICT_PRICE_TRENDS);
});

app.get('/api/v1/search-requests', (_req: Request, res: Response) => {
  res.json(dbSearchRequests);
});

app.post('/api/v1/search-requests', (req: Request, res: Response) => {
  const newReq = {
    ...req.body,
    id: `SR-${Date.now().toString().slice(-4)}`,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  dbSearchRequests.unshift(newReq);
  res.status(201).json(newReq);
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(apiKey),
    techStack: {
      mobile: 'Flutter 3.x (Dart) + Riverpod',
      adminWeb: 'Next.js / React (TypeScript) + Tailwind',
      backendApi: 'NestJS / Express (TypeScript)',
      database: 'PostgreSQL 16 + PostGIS',
      cache: 'Redis 7',
    },
    timestamp: new Date().toISOString(),
  });
});

// AI Search endpoint
app.post('/api/ai/search', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  const ai = await getAiClient();
  if (ai) {
    try {
      const { Type } = await import('@google/genai');
      const prompt = `
Waxaad tahay kaaliyaha caqliga macmalka ah (AI Assistant) ee hantida ma-guurtada ah ee GuriHel, oo ka hawlgalaya magaalada Hargeysa, Somaliland.
Macaamiilku wuxuu raadinayaa hanti isagoo adeegsanaya af-Soomaali ama Ingiriisi.
Falanqee codsiga raadinta: "${query}"

Magaalooyinka iyo degmooyinka ugu caansan Hargeysa waa:
- Jigjiga Yar
- Ibraahim Koodbuur
- 26 June
- Ahmed Dhagax
- Shacabka
- Masalaha
- Madaarka Cigaal / Airport Road
- Berbera
- Burco

Kala saar ujeedka (purpose: rent, sale, booking, ama any), nooca hantida (property_type: villa, apartment, land, commercial, building, ama all), degmada (district), qiimaha ugu yar (minPrice) iyo kan ugu sarreeya (maxPrice) haddii la xusay (USD ahaan), qolalka (minBedrooms), iyo sharaxaad kooban oo af-Soomaali ah (explanation) oo ku saabsan waxa la helay.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              purpose: { type: Type.STRING },
              property_type: { type: Type.STRING },
              district: { type: Type.STRING },
              minPrice: { type: Type.NUMBER },
              maxPrice: { type: Type.NUMBER },
              minBedrooms: { type: Type.INTEGER },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
            },
            required: ['purpose', 'property_type', 'explanation'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        success: true,
        source: 'gemini-3.8-flash',
        result: parsed,
      });
      return;
    } catch (err: unknown) {
      console.warn('Gemini search encountered an error, falling back to local NLP heuristics:', err);
    }
  }

  // Graceful deterministic fallback parser
  const qLower = query.toLowerCase();
  let purpose = 'any';
  if (qLower.includes('kiro') || qLower.includes('kiraysan') || qLower.includes('rent')) purpose = 'rent';
  else if (qLower.includes('iib') || qLower.includes('iibin') || qLower.includes('sale') || qLower.includes('buy')) purpose = 'sale';
  else if (qLower.includes('ballan') || qLower.includes('habeen') || qLower.includes('book') || qLower.includes('hotel')) purpose = 'booking';

  let property_type = 'all';
  if (qLower.includes('villa') || qLower.includes('fila')) property_type = 'villa';
  else if (qLower.includes('apartment') || qLower.includes('abaartman') || qLower.includes('flat')) property_type = 'apartment';
  else if (qLower.includes('dhul') || qLower.includes('boos') || qLower.includes('land') || qLower.includes('plot')) property_type = 'land';
  else if (qLower.includes('dabaq') || qLower.includes('building')) property_type = 'building';
  else if (qLower.includes('dukaan') || qLower.includes('xafiis') || qLower.includes('commercial')) property_type = 'commercial';

  let district = '';
  if (qLower.includes('jigjiga') || qLower.includes('jigjigayari')) district = 'Jigjiga Yar';
  else if (qLower.includes('koodbuur') || qLower.includes('ibraahim')) district = 'Ibraahim Koodbuur';
  else if (qLower.includes('26') || qLower.includes('june')) district = '26 June';
  else if (qLower.includes('ahmed') || qLower.includes('dhagax')) district = 'Ahmed Dhagax';
  else if (qLower.includes('shacabka')) district = 'Shacabka';
  else if (qLower.includes('masalaha')) district = 'Masalaha';
  else if (qLower.includes('berbera')) district = 'Berbera';
  else if (qLower.includes('burco')) district = 'Burco';

  let maxPrice: number | null = null;
  const priceMatch = query.match(/(?:<|ka yar|dhan|illaa|\$)\s*(\d{2,6})/i);
  if (priceMatch) {
    maxPrice = parseInt(priceMatch[1], 10);
  }

  let minBedrooms: number | null = null;
  const bedMatch = query.match(/(\d+)\s*(?:qol|bed|jiif)/i);
  if (bedMatch) {
    minBedrooms = parseInt(bedMatch[1], 10);
  }

  const explanation = `Waxaan fahannay inaad raadinayso ${property_type !== 'all' ? property_type : 'hanti'} ${purpose !== 'any' ? (purpose === 'rent' ? 'kiro ah' : purpose === 'sale' ? 'iib ah' : 'ballan kireysi ah') : ''}${district ? ` oo ku taal degmada ${district}` : ''}${minBedrooms ? ` leh ugu yaraan ${minBedrooms} qol` : ''}${maxPrice ? ` qiimihiisuna gaarayo illaa $${maxPrice}` : ''}.`;

  res.json({
    success: true,
    source: 'local-semantic',
    result: {
      purpose,
      property_type,
      district,
      minPrice: null,
      maxPrice,
      minBedrooms,
      keywords: [],
      explanation,
    },
  });
});

async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
          watch: process.env.DISABLE_HMR === 'true' ? null : {},
        },
        appType: 'spa',
      })
    );

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`GuriHel Full-Stack Server running at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
