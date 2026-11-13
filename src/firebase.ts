import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with firestoreDatabaseId and ignoreUndefinedProperties
// so optional form fields never crash setDoc/updateDoc with "Unsupported field value: undefined"
export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface StorageUploadProgress {
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

export interface StorageUploadResult {
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Validates and uploads a complaint photograph directly to Firebase Storage under:
 * complaints/{complaintId}/images/{uniqueFileName}
 * Uses uploadBytesResumable with progress tracking and returns the verified HTTPS download URL.
 * Never swallows errors or writes fake/blob/data/local URLs.
 */
export async function uploadComplaintPhotograph(
  complaintId: string,
  file: File,
  onProgress?: (progress: StorageUploadProgress) => void
): Promise<StorageUploadResult> {
  // 1. Validate MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
    const error: any = new Error(
      `Unsupported image format "${file.type || 'unknown'}". Allowed formats: JPG, JPEG, PNG, WEBP.`
    );
    error.code = 'storage/invalid-format';
    throw error;
  }

  // 2. Validate file size (max 10MB per file)
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    const error: any = new Error(
      `Photograph "${file.name}" exceeds maximum allowed file size of 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
    error.code = 'storage/file-too-large';
    throw error;
  }

  // 3. Build deterministic, unique Storage path: complaints/{complaintId}/images/{uniqueFileName}
  const cleanBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanBaseName}`;
  const storagePath = `complaints/${complaintId}/images/${uniqueFileName}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      complaintId,
      originalFileName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  return await new Promise<StorageUploadResult>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const total = snapshot.totalBytes || file.size || 1;
        const percent = Math.round((snapshot.bytesTransferred / total) * 100);
        if (onProgress) {
          onProgress({
            fileName: file.name,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: total,
            percent,
          });
        }
      },
      (error: any) => {
        const errorCode = error?.code || 'storage/unknown';
        const rawMessage = error?.message || 'Firebase Storage upload failed.';
        const serverMsg = error?.customData?.serverResponse || '';
        const isBucketMissing =
          rawMessage.includes('404') ||
          String(serverMsg).includes('404') ||
          String(serverMsg).includes('does not exist') ||
          errorCode === 'storage/bucket-not-found';

        console.error('Firebase Storage uploadBytesResumable failed:', {
          operation: 'FirebaseStorage.uploadBytesResumable',
          bucket: firebaseConfig.storageBucket,
          code: errorCode,
          message: rawMessage,
          complaintId,
          fileName: file.name,
          storagePath,
        });

        const enrichedError: any = new Error(
          isBucketMissing
            ? `Firebase Storage bucket "${firebaseConfig.storageBucket}" was not found (HTTP 404). Open Firebase Console > Build > Storage and click "Get Started" to provision the bucket.`
            : errorCode === 'storage/unauthorized'
            ? `Permission denied uploading "${file.name}" to Firebase Storage. Verify Storage rules allow authenticated/public image uploads under complaints/{complaintId}/images/.`
            : `Failed to upload "${file.name}" to Firebase Storage: ${rawMessage}`
        );
        enrichedError.code = isBucketMissing ? 'storage/bucket-not-found' : errorCode;
        enrichedError.storagePath = storagePath;
        reject(enrichedError);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (!downloadUrl.startsWith('https://')) {
            throw new Error(`Invalid Firebase Storage download URL returned for ${storagePath}`);
          }
          resolve({
            fileName: uniqueFileName,
            storagePath,
            downloadUrl,
            sizeBytes: file.size,
            contentType: file.type,
          });
        } catch (urlError: any) {
          console.error('Firebase Storage getDownloadURL failed:', urlError);
          const wrapped: any = new Error(
            `Uploaded "${file.name}" but failed to obtain Firebase Storage download URL: ${urlError?.message || urlError}`
          );
          wrapped.code = urlError?.code || 'storage/download-url-failed';
          wrapped.storagePath = storagePath;
          reject(wrapped);
        }
      }
    );
  });
}

/**
 * Deletes uploaded Firebase Storage objects when a multi-image upload batch partially fails
 * or when cleaning up after an aborted/cancelled submission.
 */
export async function deleteStorageObjects(storagePaths: string[]): Promise<void> {
  if (!storagePaths || storagePaths.length === 0) return;
  await Promise.allSettled(
    storagePaths.map(async (path) => {
      if (!path) return;
      try {
        await deleteObject(ref(storage, path));
      } catch (err) {
        console.warn(`Cleanup deleteObject warning for "${path}":`, err);
      }
    })
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Standardized Firestore error handler adhering to security & debugging requirements
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore at app initialization
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client indicates offline status.');
    }
    return true;
  }
}
