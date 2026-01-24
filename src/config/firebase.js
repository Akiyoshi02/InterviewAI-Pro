import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  signInAnonymously as firebaseSignInAnonymously,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  throw new Error('Missing Firebase environment variables. Please check your .env file.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const realtimeDb = getDatabase(app);

// Auth helper functions (similar API to Supabase for easier migration)
export const authHelpers = {
  async signUp(email, password, metadata = {}) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update profile with metadata if provided
      if (metadata && Object.keys(metadata).length > 0) {
        await updateProfile(user, {
          displayName: metadata.fullName || metadata.displayName || null,
        });
      }
      
      // Get ID token
      const token = await user.getIdToken();
      
      return { 
        data: { 
          user: {
            id: user.uid,
            email: user.email,
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
            user_metadata: {
              fullName: metadata.fullName || user.displayName || null,
              ...metadata
            }
          }, 
          session: { 
            access_token: token,
            user: {
              id: user.uid,
              email: user.email,
              email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
              user_metadata: {
                fullName: metadata.fullName || user.displayName || null,
                ...metadata
              }
            }
          }
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const token = await user.getIdToken();
      
      return { 
        data: { 
          user: {
            id: user.uid,
            email: user.email,
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
            user_metadata: {
              fullName: user.displayName || null
            }
          }, 
          session: { 
            access_token: token,
            user: {
              id: user.uid,
              email: user.email,
              email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
              user_metadata: {
                fullName: user.displayName || null
              }
            }
          }
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signOut() {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  async getSession() {
    const user = auth.currentUser;
    if (!user) {
      return { data: { session: null }, error: null };
    }
    try {
      const token = await user.getIdToken();
      return { 
        data: { 
          session: { 
            access_token: token,
            user: {
              id: user.uid,
              email: user.email,
              email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
              user_metadata: {
                fullName: user.displayName || null
              }
            }
          } 
        }, 
        error: null 
      };
    } catch (error) {
      return { data: { session: null }, error };
    }
  },

  async getUser() {
    const user = auth.currentUser;
    if (!user) {
      return { data: { user: null }, error: null };
    }
    return { 
      data: { 
        user: {
          id: user.uid,
          email: user.email,
          email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
          user_metadata: {
            fullName: user.displayName || null
          }
        }
      }, 
      error: null 
    };
  },

  async reloadUser() {
    const user = auth.currentUser;
    if (!user) {
      return { data: { user: null }, error: null };
    }
    try {
      await user.reload();
      return {
        data: {
          user: {
            id: user.uid,
            email: user.email,
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
            user_metadata: {
              fullName: user.displayName || null
            }
          }
        },
        error: null
      };
    } catch (error) {
      return { data: { user: null }, error };
    }
  },

  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        callback('SIGNED_IN', {
          user: {
            id: user.uid,
            email: user.email,
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
            user_metadata: {
              fullName: user.displayName || null
            }
          },
          session: {
            access_token: token
          }
        });
      } else {
        callback('SIGNED_OUT', null);
      }
    });
  },

  async refreshAccessToken() {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    return await user.getIdToken(true);
  },

  async getAccessToken() {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }
  ,

  async sendEmailVerification(actionCodeSettings = undefined) {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: new Error('No authenticated user found.') };
    }
    try {
      await sendEmailVerification(user, actionCodeSettings);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const token = await user.getIdToken();

      return {
        data: {
          user: {
            id: user.uid,
            email: user.email,
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
            user_metadata: {
              fullName: user.displayName || null,
              photoURL: user.photoURL || null,
              providerId: result.providerId || 'google'
            }
          },
          session: {
            access_token: token,
            provider: 'google'
          }
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signInAnonymously() {
    try {
      const userCredential = await firebaseSignInAnonymously(auth);
      const user = userCredential.user;
      const token = await user.getIdToken();

      return {
        data: {
          user: {
            id: user.uid,
            email: user.email || null,
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
            user_metadata: {
              fullName: user.displayName || null,
              isAnonymous: user.isAnonymous || false
            }
          },
          session: {
            access_token: token
          }
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  async verifyPasswordResetCode(oobCode) {
    try {
      const email = await verifyPasswordResetCode(auth, oobCode);
      return { email, error: null };
    } catch (error) {
      return { email: null, error };
    }
  },

  async confirmPasswordReset(oobCode, newPassword) {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Export default for backward compatibility
export default { auth, authHelpers };
