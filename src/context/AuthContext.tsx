import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isCitizen: boolean;
  role: UserRole;
  isConfiguredAdminEmail: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const PROJECT_OWNER_EMAIL = 'anicetocunha21@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * Syncs user with users/{uid} document in Firestore.
   * If first-time sign-in, creates users/{uid} with role: 'citizen'.
   * Self-assignment of admin role is strictly disallowed.
   */
  const syncUserProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userDocRef);

      const isOwnerEmail = currentUser.email?.toLowerCase() === PROJECT_OWNER_EMAIL.toLowerCase();

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        // If it's the verified owner email, ensure they have admin access
        const effectiveRole: UserRole = (data.role === 'admin' || isOwnerEmail) ? 'admin' : 'citizen';
        setUserProfile({
          uid: currentUser.uid,
          name: data.name || currentUser.displayName || 'Citizen',
          email: data.email || currentUser.email || '',
          role: effectiveRole,
          createdAt: data.createdAt,
        });
      } else {
        // First-time sign-in: automatically create users/{uid} with role: "citizen"
        // Note: Project owner email gets bootstrapped as admin if defined in rules
        const assignedRole: UserRole = isOwnerEmail ? 'admin' : 'citizen';
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Citizen',
          email: currentUser.email || '',
          role: assignedRole,
          createdAt: serverTimestamp(),
        };

        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err: any) {
      console.error('Error syncing user profile with Firestore:', err);
      // Fallback local representation if network glitch
      const isOwnerEmail = currentUser.email?.toLowerCase() === PROJECT_OWNER_EMAIL.toLowerCase();
      setUserProfile({
        uid: currentUser.uid,
        name: currentUser.displayName || 'Citizen',
        email: currentUser.email || '',
        role: isOwnerEmail ? 'admin' : 'citizen',
        createdAt: null,
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(true);
      await syncUserProfile(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(result.user);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      let message = 'Failed to sign in with Google.';
      if (err.code === 'auth/popup-closed-by-user') {
        message = 'Sign-in window was closed before completion. Please try again.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Network connection error during sign-in.';
      } else if (err.message) {
        message = err.message;
      }
      setAuthError(message);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      await syncUserProfile(user);
    }
  };

  const isConfiguredAdminEmail = Boolean(
    user?.email && user.email.toLowerCase() === PROJECT_OWNER_EMAIL.toLowerCase()
  );

  const role: UserRole = userProfile?.role || 'citizen';
  const isAdmin = role === 'admin' || isConfiguredAdminEmail;
  const isCitizen = !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAdmin,
        isCitizen,
        role,
        isConfiguredAdminEmail,
        signInWithGoogle,
        signOut,
        authError,
        clearAuthError: () => setAuthError(null),
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
