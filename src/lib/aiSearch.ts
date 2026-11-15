export interface AiSearchCriteria {
  purpose?: 'rent' | 'sale' | 'booking' | 'any';
  property_type?: 'villa' | 'apartment' | 'land' | 'commercial' | 'building' | 'all';
  district?: string;
  maxPrice?: number | null;
  minBedrooms?: number | null;
  explanation?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function parseAiSearchLocally(query: string): AiSearchCriteria {
  const q = query.toLowerCase();
  const result: AiSearchCriteria = {
    purpose: 'any',
    property_type: 'all',
    district: '',
    maxPrice: null,
    minBedrooms: null,
    explanation: `Natiijada baadhitaanka AI: "${query}"`,
  };

  if (q.includes('kiro') || q.includes('rent') || q.includes('kirays')) {
    result.purpose = 'rent';
  } else if (q.includes('iib') || q.includes('sale') || q.includes('buy') || q.includes('gadan')) {
    result.purpose = 'sale';
  } else if (q.includes('ballan') || q.includes('book') || q.includes('habeen')) {
    result.purpose = 'booking';
  }

  if (q.includes('villa') || q.includes('fillo')) result.property_type = 'villa';
  else if (q.includes('apartment') || q.includes('qol') || q.includes('flat')) result.property_type = 'apartment';
  else if (q.includes('dhul') || q.includes('land') || q.includes('boos')) result.property_type = 'land';
  else if (q.includes('dukaan') || q.includes('commercial') || q.includes('xafiis')) result.property_type = 'commercial';
  else if (q.includes('dabaq') || q.includes('building')) result.property_type = 'building';

  const districts = ['Jigjiga Yar', 'Ibraahim Koodbuur', '26 June', 'Shacabka', 'Ahmed Dhagax', 'Masalaha', 'Berbera', 'Burco'];
  for (const d of districts) {
    if (q.includes(d.toLowerCase()) || (d === 'Jigjiga Yar' && q.includes('jigjiga'))) {
      result.district = d;
      break;
    }
  }

  const priceMatch = q.match(/\$?\s*(\d{2,6})\s*(k)?/);
  if (priceMatch) {
    let val = parseInt(priceMatch[1], 10);
    if (priceMatch[2] === 'k') val *= 1000;
    if (val >= 50) result.maxPrice = val;
  }

  const bedMatch = q.match(/(\d+)\s*(qol|bed|bedroom)/);
  if (bedMatch) {
    result.minBedrooms = parseInt(bedMatch[1], 10);
  }

  return result;
}

export async function executeAiSearch(query: string): Promise<AiSearchCriteria> {
  const endpoint = `${API_BASE}/api/ai/search`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      if (data?.result) return data.result;
    }
  } catch {
    // Fallback cleanly for offline/Capacitor standalone APK environments
  }

  return parseAiSearchLocally(query);
}
