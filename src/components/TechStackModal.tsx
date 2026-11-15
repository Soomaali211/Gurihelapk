import React, { useState } from 'react';
import { X, Code2, Database, Smartphone, Server, Layers, Cpu, Check, Copy } from 'lucide-react';

interface TechStackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TechStackModal: React.FC<TechStackModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'stack' | 'database' | 'dart' | 'api' | 'monorepo'>('stack');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const DART_PRICE_MARKER_CODE = `// Section 10.5: Qeexidda Map Pin (price marker) - Flutter / Dart
Future<BitmapDescriptor> priceMarker(String label, {bool verified=false, bool featured=false}) async {
  final rec = ui.PictureRecorder();
  final c = Canvas(rec);
  final bg = Paint()..color = featured ? const Color(0xFFF5B800) : const Color(0xFF0B7A3E);
  final tp = TextPainter(
    text: TextSpan(
      text: label,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 28,
        fontWeight: FontWeight.w700,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  final w = tp.width + (verified ? 64 : 32), h = tp.height + 20;
  c.drawRRect(RRect.fromLTRBR(0, 0, w, h, const Radius.circular(14)), bg);

  if (verified) {
    // Draw white check icon badge at x=12
    final checkPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(14, 20)
      ..lineTo(22, 28)
      ..lineTo(36, 14);
    c.drawPath(path, checkPaint);
  }

  tp.paint(c, Offset(verified ? 48 : 16, 10));
  final img = await rec.endRecording().toImage(w.ceil(), (h + 12).ceil());
  final bytes = (await img.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
  return BitmapDescriptor.fromBytes(bytes);
}`;

  const POSTGIS_SCHEMA_SNIPPET = `-- Section 11: PostgreSQL 16 + PostGIS Schema (gurihel/db/schema.sql)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role AS ENUM ('seeker','owner','broker','developer','support','moderator','admin');
CREATE TYPE listing_purpose AS ENUM ('sale','rent','booking');
CREATE TYPE listing_status AS ENUM ('draft','pending','live','rejected','sold','expired');

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),
  purpose listing_purpose NOT NULL,
  property_type VARCHAR(20) NOT NULL, -- apartment|villa|big_flat|building|land|shop|office
  title TEXT, description TEXT,
  price NUMERIC(14,2) NOT NULL, currency CHAR(3) DEFAULT 'USD',
  price_unit VARCHAR(10) DEFAULT 'total',
  area_m2 NUMERIC(10,2), bedrooms SMALLINT, living_rooms SMALLINT, bathrooms SMALLINT,
  amenities JSONB DEFAULT '{}',
  city TEXT, district TEXT, address TEXT,
  geom GEOGRAPHY(Point,4326) NOT NULL,
  verified BOOLEAN DEFAULT false, featured_until TIMESTAMPTZ,
  status listing_status DEFAULT 'pending',
  views INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);

-- Spatial GIST Index for Viewport Queries
CREATE INDEX listings_geom_gix ON listings USING GIST (geom);

-- Double-Booking Prevention with GIST Range Exclude
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  guest_id UUID NOT NULL REFERENCES users(id),
  stay DATERANGE NOT NULL, -- [check_in, check_out)
  status VARCHAR(12) DEFAULT 'held',
  EXCLUDE USING GIST (listing_id WITH =, stay WITH &&) WHERE (status IN ('held','paid','confirmed'))
);`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0F172A] text-slate-100 rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-700 my-auto overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B7A3E] text-white flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Full Stack Blueprint Architecture (100% Aligned)</h3>
              <p className="text-xs text-slate-400">Verbatim Tech Stack, Code & Schemas ka soo xulay PDF Blueprint v1.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-3 bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setActiveTab('stack')}
            className={`px-3.5 py-1.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'stack' ? 'bg-[#0B7A3E] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tech Stack (Section 9)</span>
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3.5 py-1.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'database' ? 'bg-[#0B7A3E] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>PostGIS Schema (Section 11)</span>
          </button>
          <button
            onClick={() => setActiveTab('dart')}
            className={`px-3.5 py-1.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'dart' ? 'bg-[#0B7A3E] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Flutter / Dart Code (Section 10.5)</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3.5 py-1.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'api' ? 'bg-[#0B7A3E] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>REST API & WebSocket (Section 12)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs font-mono">
          {activeTab === 'stack' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-2xl overflow-hidden font-sans">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Lakab</th>
                      <th className="p-3">Doorasho (Recommended)</th>
                      <th className="p-3">Sababta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr className="bg-slate-900/40">
                      <td className="p-3 font-bold text-emerald-400">Mobile</td>
                      <td className="p-3 font-bold text-white">Flutter 3.x (Dart) + Riverpod</td>
                      <td className="p-3 text-slate-300">Hal code Android+iOS; UI isku mid ah; RTL fiican; performance khariidad.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-emerald-400">Admin Web</td>
                      <td className="p-3 font-bold text-white">Next.js (React, TypeScript) + Tailwind</td>
                      <td className="p-3 text-slate-300">Dashboard degdeg ah, SEO bogga dadweynaha.</td>
                    </tr>
                    <tr className="bg-slate-900/40">
                      <td className="p-3 font-bold text-emerald-400">Backend API</td>
                      <td className="p-3 font-bold text-white">NestJS / Node.js (TypeScript)</td>
                      <td className="p-3 text-slate-300">Qaab-dhismeed moduul; TypeScript hal luqad frontend+backend.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-emerald-400">Database</td>
                      <td className="p-3 font-bold text-white">PostgreSQL 16 + PostGIS</td>
                      <td className="p-3 text-slate-300">Geo-queries (ST_DWithin), transactions booking, JSONB.</td>
                    </tr>
                    <tr className="bg-slate-900/40">
                      <td className="p-3 font-bold text-emerald-400">Cache / Queue</td>
                      <td className="p-3 font-bold text-white">Redis (+ BullMQ)</td>
                      <td className="p-3 text-slate-300">Session, rate-limit, availability lock, jobs.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-emerald-400">Realtime Chat</td>
                      <td className="p-3 font-bold text-white">WebSocket (Socket.IO) + Redis pub/sub</td>
                      <td className="p-3 text-slate-300">Xakame buuxa + kharash la saadaalin karo.</td>
                    </tr>
                    <tr className="bg-slate-900/40">
                      <td className="p-3 font-bold text-emerald-400">Payments</td>
                      <td className="p-3 font-bold text-white">Local Wallets (Zaad, eDahab, EVC) + Stripe</td>
                      <td className="p-3 text-slate-300">Suuqa Soomaalida: mobile money ayaa ugu muhiimsan.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span>db/schema.sql (PostgreSQL 16 + PostGIS verbatim):</span>
                <button
                  onClick={() => copyToClipboard(POSTGIS_SCHEMA_SNIPPET)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
                {POSTGIS_SCHEMA_SNIPPET}
              </pre>
            </div>
          )}

          {activeTab === 'dart' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span>apps/mobile/lib/features/map/price_marker.dart (Dart verbatim):</span>
                <button
                  onClick={() => copyToClipboard(DART_PRICE_MARKER_CODE)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy Dart Code'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-amber-300 overflow-x-auto text-[11px] leading-relaxed">
                {DART_PRICE_MARKER_CODE}
              </pre>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-3 font-sans">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">REST Endpoints (/api/v1/)</h4>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="p-2 bg-slate-900 rounded-xl flex items-center justify-between border border-slate-800">
                  <span className="text-emerald-400 font-bold">GET /api/v1/listings/map</span>
                  <span className="text-slate-400">Viewport query (bbox, zoom, pins, clusters, cards)</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl flex items-center justify-between border border-slate-800">
                  <span className="text-blue-400 font-bold">POST /api/v1/auth/otp/request</span>
                  <span className="text-slate-400">Dir OTP (phone) — rate-limit 3/10min</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl flex items-center justify-between border border-slate-800">
                  <span className="text-amber-400 font-bold">POST /api/v1/bookings</span>
                  <span className="text-slate-400">Abuur hold (10 daqiiqo) + EXCLUDE lock</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl flex items-center justify-between border border-slate-800">
                  <span className="text-purple-400 font-bold">POST /api/ai/search</span>
                  <span className="text-slate-400">AI Natural Language Semantic Property Search</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
