import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Upload, Trash2, Loader2 } from 'lucide-react';
import { Listing, ListingPurpose, PropertyType } from '../types';
import { resolveApiUrl } from '../lib/apiClient';

interface AddListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitListing: (listing: Listing) => Promise<void> | void;
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const MAX_IMAGES = 10;

  const resetFormState = () => {
    setStep(1);
    setPurpose('rent');
    setPropertyType('villa');
    setTitle('');
    setDescription('');
    setPrice(500);
    setAreaM2(200);
    setBedrooms(3);
    setLivingRooms(1);
    setBathrooms(2);
    setDistrict('Jigjiga Yar');
    setAddress('');
    setSelectedAmenities(['Parking', 'Water Tank', 'Generator']);
    setImageUrls([]);
    setCustomImageUrl('');
    setImageError(null);
    setSubmitting(false);
    setIsSubmitted(false);
  };

  const handleCloseModal = () => {
    resetFormState();
    onClose();
  };

  const compressImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image format.'));
        img.onload = () => {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas unavailable.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });

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

  const handleDeviceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImageError(null);

    const remainingSlots = MAX_IMAGES - imageUrls.length;
    if (remainingSlots <= 0) {
      setImageError(`Maximum ${MAX_IMAGES} images allowed.`);
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    try {
      const compressed = await Promise.all(selectedFiles.map(compressImageFile));
      setImageUrls((prev) => [...prev, ...compressed].slice(0, MAX_IMAGES));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to process image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddCustomImageUrl = () => {
    const trimmed = customImageUrl.trim();
    if (!trimmed) return;
    setImageError(null);
    if (imageUrls.length >= MAX_IMAGES) {
      setImageError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }
    if (!/^(https?:\/\/|data:image\/)/i.test(trimmed)) {
      setImageError('Image URL must begin with https://, http://, or data:image/.');
      return;
    }
    setImageUrls((prev) => [...prev, trimmed]);
    setCustomImageUrl('');
  };

  const removeImage = (index: number) => {
    setImageError(null);
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setImageError(null);

    const newListing: Listing = {
      id: `hga-${Date.now().toString(36)}`,
      title:
        title.trim() ||
        `${propertyType.toUpperCase()} - ${district}`,
      description:
        description.trim() ||
        `Verified property in ${district}, Hargeisa.`,
      purpose,
      property_type: propertyType,
      price: Number(price) || 0,
      currency: 'USD',
      price_unit: purpose === 'rent' ? 'month' : purpose === 'booking' ? 'night' : 'total',
      area_m2: Number(areaM2) || 0,
      bedrooms: Number(bedrooms) || 0,
      living_rooms: Number(livingRooms) || 1,
      bathrooms: Number(bathrooms) || 1,
      city: district === 'Berbera' ? 'Berbera' : district === 'Burco' ? 'Burco' : 'Hargeisa',
      district,
      address: address.trim() || `${district}, Hargeisa`,
      lat: 9.558 + (Math.random() - 0.5) * 0.015,
      lng: 44.068 + (Math.random() - 0.5) * 0.015,
      verified: isAdmin,
      featured: false,
      status: isAdmin ? 'live' : 'pending',
      images: imageUrls,
      amenities: selectedAmenities,
      broker: {
        id: 'publisher',
        name: isAdmin ? 'GuriHel Admin' : 'Property Owner',
        agency: isAdmin ? 'GuriHel Official' : 'Private Owner',
        phone: '+252636786709',
        whatsapp: '252636786709',
        license: isAdmin ? 'GURIHEL-ADMIN' : 'VERIFIED-USER',
        district,
        avatar: '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png',
        rating: 5,
        activeListingsCount: 1,
        verified: isAdmin,
      },
      createdAt: new Date().toISOString(),
      views: 0,
    };

    try {
      await onSubmitListing(newListing);
      setIsSubmitted(true);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to save listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[550] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#C9D2CD] my-auto max-h-[92dvh] overflow-y-auto font-sans">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-[#0F3D2A]">
              {isAdmin ? 'Admin: Publish Property' : 'Submit New Property'}
            </h3>
            <p className="text-xs text-slate-500">
              Step {step} of 4 · Uploaded photos automatically receive the GuriHel watermark
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0B7A3E] flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 stroke-3" />
            </div>
            <h3 className="text-lg font-black text-[#0F3D2A]">Property Saved!</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">
              {isAdmin
                ? 'Published live on the marketplace with official GuriHel watermarking.'
                : 'Your property has been submitted for Admin review.'}
            </p>
            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full py-3 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-2xl"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Purpose</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'rent', label: 'Rent' },
                      { id: 'sale', label: 'Sale' },
                      { id: 'booking', label: 'Booking' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPurpose(p.id as ListingPurpose)}
                        className={`py-2.5 text-xs font-bold rounded-xl border ${
                          purpose === p.id
                            ? 'bg-[#0B7A3E] text-white border-[#0B7A3E]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Property Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'villa', label: 'Villa' },
                      { id: 'apartment', label: 'Apartment' },
                      { id: 'land', label: 'Land' },
                      { id: 'commercial', label: 'Commercial' },
                      { id: 'building', label: 'Building' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPropertyType(t.id as PropertyType)}
                        className={`p-2.5 text-left text-xs font-bold rounded-xl border ${
                          propertyType === t.id
                            ? 'bg-emerald-50 text-[#0B7A3E] border-[#0B7A3E]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
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
                    className="px-5 py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">District</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Address / Landmark</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Near Mansoor Hotel, Jigjiga Yar"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Price (USD)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Area (m²)</label>
                    <input
                      type="number"
                      value={areaM2}
                      onChange={(e) => setAreaM2(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Bedrooms</label>
                    <input
                      type="number"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Living</label>
                    <input
                      type="number"
                      value={livingRooms}
                      onChange={(e) => setLivingRooms(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Bathrooms</label>
                    <input
                      type="number"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Amenities</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AMENITIES_LIST.map((amenity) => {
                      const isSelected = selectedAmenities.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`px-2.5 py-1 text-xs rounded-lg border ${
                            isSelected
                              ? 'bg-[#0B7A3E] text-white border-[#0B7A3E]'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
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
                    className="px-4 py-2 text-xs font-medium text-slate-600 rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-5 py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Modern 4BR Villa in Jigjiga Yar"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Property highlights, access road, utilities..."
                    rows={3}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Property Photos (Automatically stamped with GuriHel watermark)
                  </label>

                  <label className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-[#0B7A3E] border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Upload Photos From Device</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleDeviceFileUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      placeholder="Or paste an image URL..."
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomImageUrl}
                      className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>

                  {imageError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-[11px] font-medium text-red-700">
                      {imageError}
                    </div>
                  )}

                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {imageUrls.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                        >
                          <img src={resolveApiUrl(img)} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full"
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
                    className="px-4 py-2 text-xs font-medium text-slate-600 rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isAdmin ? 'Publish Live' : 'Submit Listing'}</span>
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
