import React, { useState } from 'react';
import {
  Shield,
  Lock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Database,
  UserCheck,
  RefreshCw,
  LogOut,
  ExternalLink,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminLoginPageProps {
  onNavigateToDashboard: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onNavigateToDashboard }) => {
  const {
    user,
    userProfile,
    role,
    loading,
    isAdmin,
    signInWithGoogle,
    signOut,
    authError,
    clearAuthError,
    refreshUserProfile,
  } = useAuth();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshNotice(null);
    await refreshUserProfile();
    setIsRefreshing(false);
    setRefreshNotice('Profile refreshed from Firestore.');
    setTimeout(() => setRefreshNotice(null), 3500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          <Shield className="w-3.5 h-3.5" />
          <span>PWD Executive & Field Officer Access</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          LeakWatch Goa – Admin Portal
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Protected management interface for Public Works Department engineers to inspect, dispatch, and resolve reported water leaks across Goa.
        </p>
      </div>

      {authError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <span className="font-bold">Authentication Notice</span>
            <p>{authError}</p>
          </div>
          <button
            onClick={clearAuthError}
            className="text-xs text-rose-600 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Login Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Firebase Authentication Guard</h2>
              <p className="text-[11px] text-slate-400">ABAC with Firestore users collection roles</p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-400/30">
            SSL Encrypted
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-10 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Checking Firebase credentials...</p>
            </div>
          ) : !user ? (
            /* Not logged in: Show Google sign in button */
            <div className="space-y-6 text-center py-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  Sign in with your Google Account
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Signing in automatically creates your profile in the Firestore <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">users/{'{uid}'}</code> collection with role: "citizen".
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={signInWithGoogle}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl font-bold text-sm bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 hover:border-slate-400 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </button>
              </div>
            </div>
          ) : (
            /* Logged In */
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg overflow-hidden shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-12 h-12 object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm truncate">
                      {userProfile?.name || user.displayName || user.email}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isAdmin
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                      }`}
                    >
                      ROLE: {role.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">UID: {user.uid}</p>
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {refreshNotice && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{refreshNotice}</span>
                </div>
              )}

              {/* Status outcome */}
              {isAdmin ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-blue-900 font-bold">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span>Authorized Administrator Access Granted</span>
                    </div>
                    <p className="text-blue-800 leading-relaxed">
                      You are recognized as an authorized PWD Administrator. You have permissions to query all complaints, update resolution status, and add official remarks.
                    </p>
                  </div>

                  <button
                    onClick={onNavigateToDashboard}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <span>Launch Admin Dispatch Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Current Role: "citizen"</span>
                    </div>
                    <p className="leading-relaxed">
                      Your profile document exists in Firestore at <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">users/{user.uid}</code> with role <span className="font-bold">"citizen"</span>.
                      Under security policies, citizens cannot self-promote to admin.
                    </p>
                  </div>

                  {/* Manual Assignment Guide */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-amber-500" />
                      How the Project Owner Assigns the Admin Role:
                    </span>
                    <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                      <li>
                        Open the <strong>Firebase Console</strong> for project <code>stalwart-slice-zt8c4</code>.
                      </li>
                      <li>
                        Navigate to <strong>Cloud Firestore</strong> → <strong>users</strong> collection.
                      </li>
                      <li>
                        Locate document: <code className="bg-white px-1 py-0.5 rounded border font-mono font-bold text-blue-700">{user.uid}</code>.
                      </li>
                      <li>
                        Edit the field <code className="font-mono">role</code> and change value from <code className="font-mono">"citizen"</code> to <code className="font-mono text-emerald-700 font-bold">"admin"</code>.
                      </li>
                      <li>
                        Click Save, then click the button below to refresh your access.
                      </li>
                    </ol>

                    <div className="pt-2">
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Check Admin Status / Refresh Profile</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Security Architecture Documentation Card */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Security Rules & ABAC Architecture</span>
        </div>

        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
          <p>
            <strong>Phase 2 Zero-Trust Firestore Security:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>
              <strong>No Self-Promotion:</strong> Firestore rules mandate <code className="text-blue-700 bg-white px-1 py-0.5 rounded font-mono border">incoming().role == 'citizen'</code> when users create their profile, and prohibit users from modifying their own <code className="font-mono">role</code>.
            </li>
            <li>
              <strong>Citizen-Scoped Reads:</strong> Citizens can only view complaints matching their UID (<code className="font-mono">resource.data.citizenUid == request.auth.uid</code>).
            </li>
            <li>
              <strong>Admins View & Update:</strong> Admins verified via <code className="font-mono">users/{'{uid}'}.role == 'admin'</code> can query all complaints and update <code className="font-mono">status</code> and <code className="font-mono">adminRemarks</code>.
            </li>
            <li>
              <strong>Immutable Fields:</strong> <code className="font-mono">complaintId</code>, <code className="font-mono">citizenUid</code>, and <code className="font-mono">createdAt</code> cannot be altered after creation.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
