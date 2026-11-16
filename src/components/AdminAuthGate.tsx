import React, { useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  LogOut,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { AdminDevice, AdminRecord, AdminSessionState } from '../types';
import {
  isVerifiedAdmin,
  signInWithGoogleVerified,
  signOutFirebase,
  ensureSuperAdminRecord,
  saveSuperAdminMfaSetup,
  consumeRecoveryCodeHash,
  getAdminDeviceByFingerprint,
  registerOrTouchTrustedDevice,
  appendAuditLog,
} from '../lib/firestoreRepo';
import {
  getOrCreateDeviceFingerprint,
  request2FASetup,
  confirm2FASetup,
  verifyDaily2FA,
} from '../lib/adminSecurity';

interface AdminAuthGateProps {
  firebaseUser: FirebaseUser | null;
  onBackToApp: () => void;
  onAuthenticated: (ctx: {
    adminRecord: AdminRecord;
    session: AdminSessionState;
    device: AdminDevice;
  }) => void;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  firebaseUser,
  onBackToApp,
  onAuthenticated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminRecord, setAdminRecord] = useState<AdminRecord | null>(null);
  const [existingDevice, setExistingDevice] = useState<AdminDevice | null>(null);
  const [deviceInfo] = useState(() => getOrCreateDeviceFingerprint());

  // 2FA Setup State (first-time onboarding)
  const [setupData, setSetupData] = useState<{
    qrDataUrl: string;
    manualKey: string;
    encryptedSecret: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [recoveryCodesOnce, setRecoveryCodesOnce] = useState<string[] | null>(null);
  const [pendingSuccessCtx, setPendingSuccessCtx] = useState<{
    adminRecord: AdminRecord;
    session: AdminSessionState;
    device: AdminDevice;
  } | null>(null);

  // Code Input State
  const [totpCode, setTotpCode] = useState('');
  const [useRecoveryMode, setUseRecoveryMode] = useState(false);
  const [trustCurrentDevice, setTrustCurrentDevice] = useState(true);

  const isSuperAdminGoogleUser = isVerifiedAdmin(firebaseUser);

  // Load Super Admin Firestore record & device trust status whenever Google user changes
  useEffect(() => {
    let active = true;
    async function loadAdminContext() {
      if (!firebaseUser || !isSuperAdminGoogleUser) {
        setAdminRecord(null);
        setExistingDevice(null);
        setSetupData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const record = await ensureSuperAdminRecord(firebaseUser);
        if (!active) return;

        if (record.status === 'suspended') {
          setError('Xisaabtan Super Admin waa la hakiyay (Suspended).');
          setAdminRecord(record);
          return;
        }

        const dev = await getAdminDeviceByFingerprint(firebaseUser, deviceInfo.fingerprint);
        if (!active) return;

        setAdminRecord(record);
        setExistingDevice(dev);

        if (!record.mfaEnabled || !record.totpSecretEnc) {
          const idToken = await firebaseUser.getIdToken();
          const setup = await request2FASetup(idToken);
          if (!active) return;
          setSetupData(setup);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Khalad ayaa ka dhacay soo dejinta xogta Super Admin.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAdminContext();
    return () => {
      active = false;
    };
  }, [firebaseUser, isSuperAdminGoogleUser, deviceInfo.fingerprint]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogleVerified();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In lama dhammaystirin. Fadlan mar kale isku day.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !adminRecord || !setupData) return;

    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const confirmed = await confirm2FASetup({
        idToken,
        encryptedSecret: setupData.encryptedSecret,
        code: totpCode.trim(),
        deviceFp: deviceInfo.fingerprint,
        sessionEpoch: adminRecord.sessionEpoch,
      });

      await saveSuperAdminMfaSetup(
        firebaseUser,
        confirmed.encryptedSecret,
        confirmed.recoveryCodeHashes
      );

      const registeredDevice = await registerOrTouchTrustedDevice(
        firebaseUser,
        deviceInfo.fingerprint,
        deviceInfo.label,
        true
      );

      await appendAuditLog(firebaseUser, {
        action: 'super_admin.2fa_activated',
        target: firebaseUser.uid,
        details: `Super Admin 2FA Authenticator & Trusted Device (${deviceInfo.label}) waa la hawlgeliyay.`,
        deviceLabel: deviceInfo.label,
        stepUpUsed: true,
      });

      const updatedRecord: AdminRecord = {
        ...adminRecord,
        mfaEnabled: true,
        totpSecretEnc: confirmed.encryptedSecret,
        recoveryCodeHashes: confirmed.recoveryCodeHashes,
      };

      setRecoveryCodesOnce(confirmed.recoveryCodes);
      setPendingSuccessCtx({
        adminRecord: updatedRecord,
        session: confirmed.session,
        device: registeredDevice,
      });
      setTotpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xaqiijinta 2FA way fashilantay.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDailyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !adminRecord || !adminRecord.totpSecretEnc) return;

    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const result = await verifyDaily2FA({
        idToken,
        encryptedSecret: adminRecord.totpSecretEnc,
        code: totpCode.trim(),
        recoveryCodeHashes: adminRecord.recoveryCodeHashes || [],
        deviceFp: deviceInfo.fingerprint,
        sessionEpoch: adminRecord.sessionEpoch,
      });

      let updatedHashes = adminRecord.recoveryCodeHashes || [];
      if (result.usedRecoveryIndex >= 0) {
        updatedHashes = updatedHashes.filter((_, i) => i !== result.usedRecoveryIndex);
        await consumeRecoveryCodeHash(firebaseUser, updatedHashes);
      }

      const registeredDevice = await registerOrTouchTrustedDevice(
        firebaseUser,
        deviceInfo.fingerprint,
        deviceInfo.label,
        existingDevice?.trusted ? true : trustCurrentDevice
      );

      await appendAuditLog(firebaseUser, {
        action: result.usedRecoveryIndex >= 0 ? 'super_admin.recovery_login' : 'super_admin.login',
        target: firebaseUser.uid,
        details: existingDevice?.trusted
          ? `Super Admin login guulaystay (${deviceInfo.label})`
          : `Qalab cusub waa la ansixiyay laguna galay (${deviceInfo.label})`,
        deviceLabel: deviceInfo.label,
        stepUpUsed: true,
      });

      onAuthenticated({
        adminRecord: { ...adminRecord, recoveryCodeHashes: updatedHashes },
        session: result.session,
        device: registeredDevice,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xogtu waa khalad.');
    } finally {
      setLoading(false);
    }
  };

  // Recovery Codes One-Time Display Screen right after 2FA Activation
  if (recoveryCodesOnce && pendingSuccessCtx) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#EEF2F0] flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-3xl border border-[#C9D2CD] shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-[#0B7A3E] flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0F3D2A]">
                Kaydi Recovery Codes-ka (Hal Mar Keliya!)
              </h2>
              <p className="text-xs text-slate-500">
                Haddii taleefankaagu lumo, mid ka mid ah koodhadhan ayaad ku gali kartaa.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 font-mono text-xs font-bold text-[#0F3D2A]">
            {recoveryCodesOnce.map((code) => (
              <div
                key={code}
                className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-center tabular-nums"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Koodhadhan dib looma soo bandhigi doono mar labaad. Ku qoro meel ammaan ah ama password manager.
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(recoveryCodesOnce.join('\n'));
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              {copiedKey ? <Check className="w-4 h-4 text-[#0B7A3E]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedKey ? 'La Koobiyeeyay' : 'Koobiyee'}</span>
            </button>
            <button
              type="button"
              onClick={() => onAuthenticated(pendingSuccessCtx)}
              className="flex-1 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl shadow-sm"
            >
              Waan Kaydiyay — Fur Admin Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#EEF2F0] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-3xl border border-[#C9D2CD] shadow-xl overflow-hidden">
        {/* Top Security Banner */}
        <div className="bg-[#0F3D2A] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0B7A3E] flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">GURIHEL ADMIN PORTAL</h1>
              <p className="text-[11px] text-emerald-200 font-medium">
                Super Admin · Google Auth + 2FA + Device Binding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToApp}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Ku noqo App-ka"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* State 1: Not signed in OR signed in as non-admin Google user */}
          {!firebaseUser || !isSuperAdminGoogleUser ? (
            <div className="space-y-4">
              {firebaseUser && !isSuperAdminGoogleUser && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                  <div className="font-bold">
                    Xisaabtan ({firebaseUser.email}) ma laha fasaxa Super Admin.
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Fadlan ka bax oo ku gal akoonka rasmiga ah ee Super Admin-ka.
                  </p>
                  <button
                    type="button"
                    onClick={() => signOutFirebase()}
                    className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-[11px] font-bold text-amber-900 inline-flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ka Bax Akoonkan</span>
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <h2 className="text-sm font-bold text-[#0F3D2A]">
                  Tallaabada 1: Xaqiijinta Google Super Admin
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Gelitaanka Admin Web Panel-ku waa mid xaddidan. Ku gal Google Account-ka rasmiga ah kadibna geli koodhka 2FA.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-12 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 flex items-center justify-center gap-2.5 shadow-xs transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>{loading ? 'Waa la furayaa...' : 'Ku Gal Google Super Admin'}</span>
              </button>

              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-[11px] text-amber-900">
                Ma jiro badhan &ldquo;Diiwaangeli&rdquo; (Register). Super Admin waa mid la cayimay oo leh 2FA + Device Binding.
              </div>
            </div>
          ) : loading && !adminRecord ? (
            <div className="py-10 text-center space-y-2 text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0B7A3E] mx-auto" />
              <div>Waa la hubinayaa aqoonsiga Super Admin iyo 2FA...</div>
            </div>
          ) : adminRecord && !adminRecord.mfaEnabled && setupData ? (
            /* State 2A: First-Time Seed Super Admin 2FA Setup */
            <form onSubmit={handleConfirmSetup} className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0B7A3E] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  Dejinta 2FA Marka Ugu Horraysa
                </span>
                <span className="text-slate-500 truncate max-w-[180px]">{firebaseUser.email}</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Fur <strong>Google Authenticator</strong> ama <strong>Authy</strong>, scan-gareey QR code-ka hoose, kadibna geli koodhka 6-da god.
              </p>

              <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <img
                  src={setupData.qrDataUrl}
                  alt="Super Admin 2FA QR Code"
                  className="w-44 h-44 rounded-xl border border-slate-200 bg-white p-1"
                />
                <div className="w-full flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  <span className="font-mono text-[11px] font-bold text-slate-700 truncate">
                    {setupData.manualKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(setupData.manualKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 1800);
                    }}
                    className="text-[11px] font-bold text-[#0B7A3E] shrink-0"
                  >
                    {copiedKey ? 'Copied ✓' : 'Copy Key'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Geli koodhka 6-da god ee Authenticator-ka
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full h-12 text-center tracking-[0.4em] font-mono text-lg font-black bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:border-[#0B7A3E] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full h-11 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-2xl shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Waa la xaqiijinayaa...' : 'Hawlgeli 2FA & Trusted Device'}
              </button>
            </form>
          ) : adminRecord && adminRecord.mfaEnabled ? (
            /* State 2B: Daily 2FA + Device Check Login */
            <form onSubmit={handleVerifyDailyLogin} className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 px-3 py-2.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-4 h-4 text-[#0B7A3E] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{deviceInfo.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{firebaseUser.email}</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    existingDevice?.trusted
                      ? 'bg-emerald-100 text-[#0B7A3E]'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {existingDevice?.trusted ? 'Trusted Device ✓' : 'Qalab Cusub'}
                </span>
              </div>

              {!existingDevice?.trusted && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-2">
                  <div className="font-bold">
                    Qalab cusub ayaa laga soo galay ({deviceInfo.label}).
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trustCurrentDevice}
                      onChange={(e) => setTrustCurrentDevice(e.target.checked)}
                      className="accent-[#0B7A3E]"
                    />
                    <span>U diiwaangeli qalabkan Trusted Device (la diiwaan gelinayo Audit Log)</span>
                  </label>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0B7A3E]" />
                  <span>
                    {useRecoveryMode
                      ? 'Geli Recovery Code (tusaale GH-XXXX-XXXX)'
                      : 'Geli Koodhka 2FA (6-god Authenticator)'}
                  </span>
                </label>
                <input
                  type="text"
                  inputMode={useRecoveryMode ? 'text' : 'numeric'}
                  maxLength={useRecoveryMode ? 14 : 6}
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(
                      useRecoveryMode
                        ? e.target.value.toUpperCase()
                        : e.target.value.replace(/\D/g, '')
                    )
                  }
                  placeholder={useRecoveryMode ? 'GH-XXXX-XXXX' : '482196'}
                  autoFocus
                  className="w-full h-12 text-center tracking-[0.35em] font-mono text-lg font-black bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:border-[#0B7A3E] outline-none"
                />
                {!useRecoveryMode && (
                  <p className="text-[11px] text-slate-400 text-center">
                    Koodhku wuu is beddelaa 30-kii ilbiriqsiba · 5 khalad = xidhid 15 daqiiqo
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  (useRecoveryMode ? totpCode.trim().length < 8 : totpCode.length !== 6)
                }
                className="w-full h-11 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-2xl shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Waa la xaqiijinayaa...' : 'Xaqiiji 2FA & Fur Super Admin Console'}
              </button>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryMode((p) => !p);
                    setTotpCode('');
                    setError(null);
                  }}
                  className="font-bold text-[#0B7A3E] hover:underline"
                >
                  {useRecoveryMode ? '← Ku noqo 6-god Authenticator' : 'Isticmaal Recovery Code'}
                </button>
                <button
                  type="button"
                  onClick={() => signOutFirebase()}
                  className="font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Ka bax</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};
