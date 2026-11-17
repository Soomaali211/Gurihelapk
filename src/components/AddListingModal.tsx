import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { Listing, ListingPurpose, PropertyType } from '../types';
import { INITIAL_BROKERS } from '../data/mockData';

interface AddListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitListing: (listing: Listing) => void;
  isAdmin?: boolean;
}

export const AddListingModal: React.FC<AddListingModalProps> = ({
  isOpen,
  onClose,
  onSubmitListing,
  isAdmin = false,
}) => {
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState<ListingPurpose>('rent');
  const [propertyType, setPropertyType] = useState<PropertyType>('villa');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(500);
  const [areaM2, setAreaM2] = useState<number>(200);
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [livingRooms, setLivingRooms] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [district, setDistrict] = useState('Jigjiga Yar');
  const [address, setAddress] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'Parking',
    'Water Tank',
    'Generator',
  ]);
  const [imageUrls, setImageUrls] = useState<string[]>([
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
  ]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const AMENITIES_LIST = [
    'Parking',
    'Water Tank',
    'Generator',
    'Security Guard',
    'Solar Backup',
    'AC',
    'WiFi',
    'Garden',
    'Balcony',
    'Furnished',
  ];

  const DISTRICTS = [
    'Jigjiga Yar',
    'Ibraahim Koodbuur',
    '26 June',
    'Ahmed Dhagax',
    'Shacabka',
    'Masalaha',
    'Berbera',
    'Burco',
  ];

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const handleDeviceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setImageUrls((prev) => [...prev, uploadEvent.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddCustomImageUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customImageUrl.trim()) return;
    setImageUrls((prev) => [...prev, customImageUrl.trim()]);
    setCustomImageUrl('');
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalImages =
      imageUrls.length > 0
        ? imageUrls
        : ['https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80'];

    const newListing: Listing = {
      id: `hga-${Date.now().toString().slice(-4)}`,
      title: title || `${propertyType.toUpperCase()} Cusub oo ${purpose === 'rent' ? 'Kiro' : purpose === 'sale' ? 'Iib' : 'Ballan'} ah`,
      description: description || 'Guri hanti ah oo dhamaystiran oo ku yaal Hargeysa, sharcigiisu caddahay.',
      purpose,
      property_type: propertyType,
      price: Number(price) || 500,
      currency: 'USD',
      price_unit: purpose === 'rent' ? 'month' : purpose === 'booking' ? 'night' : 'total',
      area_m2: Number(areaM2) || 150,
      bedrooms: Number(bedrooms) || 0,
      living_rooms: Number(livingRooms) || 1,
      bathrooms: Number(bathrooms) || 1,
      city: district === 'Berbera' ? 'Berbera' : district === 'Burco' ? 'Burco' : 'Hargeisa',
      district,
      address: address || `Waddada Weyn ee ${district}, Hargeysa`,
      lat: 9.558 + (Math.random() - 0.5) * 0.02,
      lng: 44.068 + (Math.random() - 0.5) * 0.02,
      verified: isAdmin ? true : false, // Admin added listings can be auto-verified
      featured: false,
      status: isAdmin ? 'live' : 'pending', // Admin added listings go straight live or queue
      images: finalImages,
      amenities: selectedAmenities,
      broker: INITIAL_BROKERS[0],
      createdAt: new Date().toISOString(),
      views: 1,
    };

    onSubmitListing(newListing);
    setIsSubmitted(true);
  };

  const handleFinish = () => {
    setIsSubmitted(false);
    setStep(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#C9D2CD] my-auto max-h-[92dvh] overflow-y-auto animate-in zoom-in-95 duration-200 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-[#0F3D2A]">
              {isAdmin ? '🛡️ Admin: Ku Dar Guri / Hanti Cusub' : 'Soo Geli Hanti Cusub'}
            </h3>
            <p className="text-xs text-slate-500">Tallaabada {step} ee 4: Macluumaadka & Sawirrada Guriga</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0B7A3E] flex items-center justify-center mx-auto text-2xl shadow-inner">
              <Check className="w-8 h-8 stroke-3" />
            </div>
            <h3 className="text-lg font-black text-[#0F3D2A]">Hantida Waa La Diiwaangeliyay!</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">
              {isAdmin
                ? 'Gurgii si guul leh ayaa loogu daray suuqa GuriHel (Live waana la xaqiijiyay).'
                : 'Xayeysiiskaaga waxaa loo gudbiyay Safka Ansixinta Maamulka (Admin Approvals Queue).'}
            </p>
            <div className="pt-4">
              <button
                onClick={handleFinish}
                className="w-full py-3 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-2xl shadow-md transition-all"
              >
                Waayahay, Ku Laabo App-ka
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Step 1: Purpose & Type */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    1. Ujeedka Hantida (Purpose):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'rent', label: 'Kiro (Rent)' },
                      { id: 'sale', label: 'Iib (Sale)' },
                      { id: 'booking', label: 'Ballan (Stay)' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPurpose(p.id as ListingPurpose)}
                        className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                          purpose === p.id
                            ? 'bg-[#0B7A3E] text-white border-[#0B7A3E] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    2. Nooca Hantida (Property Type):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'villa', label: 'Villa' },
                      { id: 'apartment', label: 'Apartment' },
                      { id: 'land', label: 'Dhul Banaan' },
                      { id: 'commercial', label: 'Dukaan / Ganacsi' },
                      { id: 'building', label: 'Dabaq Dhammaystiran' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPropertyType(t.id as PropertyType)}
                        className={`p-2.5 text-left text-xs font-bold rounded-xl border transition-all ${
                          propertyType === t.id
                            ? 'bg-emerald-50 text-[#0B7A3E] border-[#0B7A3E] ring-1 ring-[#0B7A3E]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Soco Tallaabada 2</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Location & Address */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Degmada Hargeysa:
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0B7A3E] outline-none"
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cinwaanka Tooska ah ama Meesha u Dhow (Landmark / Address):
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="t.g. Waddada Mansoor Hotel u dhow, Jigjiga Yar"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0B7A3E] outline-none"
                  />
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 leading-relaxed">
                  📍 Gurigani waxaa si toos ah loogu heli doonaa Khariidadda OpenStreetMap iyadoo leh biinka qiimaha ee saxda ah.
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Dib u noqo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Soco Tallaabada 3</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Price, Specs, Amenities */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Qiimaha (USD):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#0B7A3E] outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Baaxadda (m²):
                    </label>
                    <input
                      type="number"
                      value={areaM2}
                      onChange={(e) => setAreaM2(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#0B7A3E] outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Qolalka Jiifka:
                    </label>
                    <input
                      type="number"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#0B7A3E] outline-none tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Fadhiga (Living):
                    </label>
                    <input
                      type="number"
                      value={livingRooms}
                      onChange={(e) => setLivingRooms(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#0B7A3E] outline-none tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Musqulaha:
                    </label>
                    <input
                      type="number"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#0B7A3E] outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Adeegyada Diyaarka ah (Amenities):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AMENITIES_LIST.map((amenity) => {
                      const isSelected = selectedAmenities.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-[#0B7A3E] text-white border-[#0B7A3E]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {amenity}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Dib u noqo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Soco Tallaabada 4</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Title, Description, Image Upload & Submit */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cinwaanka Xayeysiiska (Title):
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="t.g. Villa Casri ah oo 4 Qol leh ee Jigjiga Yar"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0B7A3E] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Faahfaahin Dheeraad ah (Description):
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Qor faahfaahinta guriga, jidka, biyaha, korontada..."
                    rows={3}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0B7A3E] outline-none resize-none"
                  />
                </div>

                {/* Comprehensive Image Upload Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Sawirrada Guriga (Upload from Device or URL):
                  </label>

                  {/* File Upload Input */}
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-[#0B7A3E] border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>Ka soo Upload garay Sawir Taleefanka / PC-ga</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleDeviceFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Add URL fallback */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      placeholder="Ama ku dar Image URL..."
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomImageUrl}
                      className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                    >
                      Ku Dar
                    </button>
                  </div>

                  {/* Image Previews Grid */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {imageUrls.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-slate-100">
                          <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-md opacity-80 hover:opacity-100"
                            title="Tirtir sawirka"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Dib u noqo
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    {isAdmin ? 'Gudbi oo Toos u Daabac (Live)' : 'Gudbi Xayeysiiska'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
