import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  User,
} from 'lucide-react';
import { AuthUser } from '../types';
import { requestEmailOtp, updateMyProfile, verifyEmailOtp } from '../lib/apiClient';

interface UnifiedLoginScreenProps {
  onAuthenticated: (user: AuthUser) => void;
  onBrowsePublic?: () => void;
  onBack?: () => void;
}

type AuthStep = 'email' | 'otp' | 'onboarding';

const EMPTY_DIGITS = ['', '', '', '', '', ''];

function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const UnifiedLoginScreen: React.FC<UnifiedLoginScreenProps> = ({
  onAuthenticated,
  onBrowsePublic,
  onBack,
}) => {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>([...EMPTY_DIGITS]);
  const [expirySecondsLeft, setExpirySecondsLeft] = useState(300);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);

  // Onboarding state for newly created accounts
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('Hargeisa');
  const [phoneE164, setPhoneE164] = useState('');

  const [busy, setBusy] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = window.setInterval(() => {
      setExpirySecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === 'otp') {
      const id = window.setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [step]);

  const trimmedEmail = email.trim().toLowerCase();
  const isEmailFormatValid =
    trimmedEmail.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const codeValue = digits.join('');

  const handleRequestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!isEmailFormatValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setVerifiedSuccess(false);

    try {
      const res = await requestEmailOtp(trimmedEmail);
      setDigits([...EMPTY_DIGITS]);
      setExpirySecondsLeft(res.expiresInSeconds || 300);
      setResendCooldownLeft(res.resendCooldownSeconds || 45);
      setStep('otp');
      setNotice(res.message);
    } catch (err) {
      const retrySec = (err as { retryAfterSeconds?: number })?.retryAfterSeconds;
      if (retrySec && retrySec > 0 && step === 'otp') {
        setResendCooldownLeft(retrySec);
      }
      setError(err instanceof Error ? err.message : 'Unable to send verification code.');
    } finally {
      setBusy(false);
    }
  };

  const submitOtpCode = async (codeToVerify: string) => {
    if (busy || !/^\d{6}$/.test(codeToVerify)) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await verifyEmailOtp({
        email: trimmedEmail,
        code: codeToVerify,
        deviceLabel: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'App',
      });

      setVerifiedSuccess(true);
      if (res.requiresProfileCompletion) {
        setPendingUser(res.user);
        setFullName(res.user.fullName || '');
        setCity(res.user.city || 'Hargeisa');
        setPhoneE164(res.user.phoneE164 || '');
        setStep('onboarding');
        setVerifiedSuccess(false);
      } else {
        onAuthenticated(res.user);
      }
    } catch (err) {
      setVerifiedSuccess(false);
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeValue.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }
    await submitOtpCode(codeValue);
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, '');
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      const next = [...digits];
      for (let i = 0; i < pasted.length && index + i < 6; i += 1) {
        next[index + i] = pasted[i];
      }
      setDigits(next);
      setError(null);
      const focusIdx = Math.min(5, index + pasted.length);
      inputRefs.current[focusIdx]?.focus();
      const joined = next.join('');
      if (joined.length === 6) {
        void submitOtpCode(joined);
      }
      return;
    }

    setError(null);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else {
      const joined = next.join('');
      if (joined.length === 6) {
        void submitOtpCode(joined);
      }
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedDigits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedDigits) return;
    e.preventDefault();
    const next = [...EMPTY_DIGITS];
    for (let i = 0; i < pastedDigits.length; i += 1) {
      next[i] = pastedDigits[i];
    }
    setDigits(next);
    setError(null);
    const focusIdx = Math.min(5, pastedDigits.length === 6 ? 5 : pastedDigits.length);
    inputRefs.current[focusIdx]?.focus();
    if (pastedDigits.length === 6) {
      void submitOtpCode(pastedDigits);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !pendingUser) return;
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await updateMyProfile({
        fullName: fullName.trim(),
        city,
        phoneE164: phoneE164.trim(),
      });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeEmail = () => {
    setStep('email');
    setDigits([...EMPTY_DIGITS]);
    setError(null);
    setNotice(null);
    setVerifiedSuccess(false);
  };

  return (
    <div className="bg-white min-h-full w-full flex flex-col justify-between px-5 pt-4 pb-8 font-sans overflow-y-auto">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        {/* Top Bar with Back + Official GuriHel Logo */}
        <div className="flex items-center justify-between gap-3">
          {step === 'otp' ? (
            <button
              type="button"
              onClick={handleChangeEmail}
              className="p-1.5 -ml-1.5 rounded-full text-[#0B7A3E] hover:bg-emerald-50 transition-colors"
              aria-label="Change email"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
          ) : step === 'email' && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-full text-[#0B7A3E] hover:bg-emerald-50 transition-colors"
              aria-label="Back to marketplace"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
          ) : (
            <div className="w-8" />
          )}

          <img
            src="/assets/aistudio/GuriHel-logo-primary_c2f3e626.png"
            alt="GuriHel"
            className="h-9 w-auto object-contain"
          />

          <div className="w-8" />
        </div>

        {/* Alerts */}
        {notice && (
          <div className="mt-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0B7A3E] shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mt-5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: EMAIL ENTRY */}
        {step === 'email' && (
          <div className="mt-8 space-y-6 flex-1 flex flex-col">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Welcome to GuriHel
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Enter your email address to sign in or create an account. We will send a 6-digit verification code to your inbox.
              </p>
            </div>

            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Email Address
                </label>
                <div className="flex items-center h-12 rounded-xl border border-slate-300 bg-[#F4F6F8] px-3.5 focus-within:border-[#0B7A3E] focus-within:bg-white transition-colors">
                  <Mail className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="name@example.com"
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !isEmailFormatValid}
                className="w-full h-12 rounded-xl text-sm font-bold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] disabled:bg-[#8CC2A3] flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <span>Continue</span>
                )}
              </button>
            </form>

            {onBrowsePublic && (
              <div className="pt-4 mt-auto text-center">
                <button
                  type="button"
                  onClick={onBrowsePublic}
                  className="text-xs font-bold text-[#0B7A3E] hover:underline"
                >
                  Browse Public Listings First →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: 6-DIGIT OTP VERIFICATION */}
        {step === 'otp' && (
          <div className="mt-8 space-y-6 flex-1 flex flex-col">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Check your email
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Enter the 6-digit verification code sent to{' '}
                <span className="font-bold text-slate-900 break-all">{trimmedEmail}</span>.
              </p>
            </div>

            <form onSubmit={handleVerifyForm} className="space-y-5">
              <div className="grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleDigitPaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Verification digit ${index + 1}`}
                    value={digit}
                    disabled={busy || verifiedSuccess}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`h-13 sm:h-14 w-full text-center text-xl font-extrabold font-mono rounded-xl border transition-all outline-none ${
                      digit
                        ? 'border-[#0B7A3E] bg-white text-[#0F3D2A] ring-2 ring-[#0B7A3E]/15'
                        : 'border-slate-300 bg-[#F4F6F8] text-slate-900 focus:border-[#0B7A3E] focus:bg-white focus:ring-2 focus:ring-[#0B7A3E]/20'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-semibold tabular-nums ${
                    expirySecondsLeft === 0 ? 'text-red-600' : 'text-slate-500'
                  }`}
                >
                  {expirySecondsLeft > 0
                    ? `Code expires in ${formatSeconds(expirySecondsLeft)}`
                    : 'Verification code expired'}
                </span>

                <button
                  type="button"
                  disabled={busy || resendCooldownLeft > 0}
                  onClick={() => void handleRequestCode()}
                  className="font-bold text-[#0B7A3E] hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldownLeft > 0
                      ? `Resend in ${resendCooldownLeft}s`
                      : 'Resend code'}
                  </span>
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || verifiedSuccess || codeValue.length !== 6}
                className="w-full h-12 rounded-xl text-sm font-bold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] disabled:bg-[#8CC2A3] flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                {verifiedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified!</span>
                  </>
                ) : busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify &amp; Continue</span>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={handleChangeEmail}
                className="text-xs font-bold text-slate-600 hover:text-[#0B7A3E] hover:underline"
              >
                Change email address
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: NEW ACCOUNT PROFILE COMPLETION */}
        {step === 'onboarding' && (
          <div className="mt-8 space-y-6 flex-1 flex flex-col">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Complete your profile
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your email <span className="font-semibold text-slate-900">{trimmedEmail}</span> is verified. Add your name to finish setting up your account.
              </p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Full Name *
                </label>
                <div className="flex items-center h-12 rounded-xl border border-slate-300 bg-[#F4F6F8] px-3.5 focus-within:border-[#0B7A3E] focus-within:bg-white">
                  <User className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Axmed Maxamed Xasan"
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">City</label>
                  <div className="flex items-center h-12 rounded-xl border border-slate-300 bg-[#F4F6F8] px-3 focus-within:border-[#0B7A3E] focus-within:bg-white">
                    <MapPin className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-900 outline-none"
                    >
                      <option value="Hargeisa">Hargeisa</option>
                      <option value="Berbera">Berbera</option>
                      <option value="Burco">Burco</option>
                      <option value="Borama">Borama</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Phone (Optional)
                  </label>
                  <div className="flex items-center h-12 rounded-xl border border-slate-300 bg-[#F4F6F8] px-3 focus-within:border-[#0B7A3E] focus-within:bg-white">
                    <Phone className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="tel"
                      value={phoneE164}
                      onChange={(e) => setPhoneE164(e.target.value)}
                      placeholder="+252..."
                      className="flex-1 min-w-0 bg-transparent text-xs font-medium text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || fullName.trim().length < 2}
                className="w-full h-12 rounded-xl text-sm font-bold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] disabled:bg-[#8CC2A3] flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Continue to GuriHel</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="pt-6 text-center text-[11px] text-slate-400">
        GuriHel Real Estate · Somaliland
      </div>
    </div>
  );
};
