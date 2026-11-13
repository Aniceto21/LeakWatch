import React, { useState, useRef } from 'react';
import {
  FilePlus2,
  MapPin,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  RefreshCw,
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  HelpCircle,
  AlertTriangle,
  Eye,
  Wrench,
  XCircle,
  Droplets,
  RotateCw,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  uploadComplaintPhotograph,
  deleteStorageObjects,
  StorageUploadResult,
} from '../firebase';
import {
  GoaDistrict,
  CivicIssueCategory,
  CIVIC_ISSUE_CATEGORIES,
  IssueSeverity,
  AIVisualDecision,
  StructuredAIAnalysis,
  SingleImageAnalysis,
} from '../types';
import { GOA_DISTRICTS, GOA_TALUKAS } from '../utils/goaLocations';
import { generateComplaintId } from '../utils/complaintId';
import { compressImageToJPEG } from '../utils/imageCompressor';
import { useAuth } from '../context/AuthContext';

interface CitizenReportPageProps {
  onNavigateToTrack: (complaintId?: string) => void;
  onNavigateHome: () => void;
}

const MAX_IMAGES = 5;

interface SelectedPhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  base64DataUrl: string;
  sizeKB: number;
}

export const CitizenReportPage: React.FC<CitizenReportPageProps> = ({
  onNavigateToTrack,
  onNavigateHome,
}) => {
  const { user } = useAuth();

  // Required Citizen Info Fields
  const [fullName, setFullName] = useState(user?.displayName || '');
  const [contactNumber, setContactNumber] = useState('');
  const [issueLocation, setIssueLocation] = useState('');

  // Optional Citizen Info Fields
  const [email, setEmail] = useState(user?.email || '');
  const [personalAddress, setPersonalAddress] = useState('');

  // Goa Geographic / Spatial Fields
  const [district, setDistrict] = useState<GoaDistrict>('North Goa');
  const [taluka, setTaluka] = useState(GOA_TALUKAS['North Goa'][0]);
  const [latitude, setLatitude] = useState<string>('15.4989');
  const [longitude, setLongitude] = useState<string>('73.8278');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Photographs (1 to 5 images)
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhotoItem[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [photoValidationError, setPhotoValidationError] = useState<string | null>(null);

  // Gemini AI Analysis State
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<StructuredAIAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<SingleImageAnalysis[]>([]);
  const [selectedPhotoTab, setSelectedPhotoTab] = useState<number>(0);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Citizen Confirmation & Editing Controls (Part 3)
  const [userSelectedCategory, setUserSelectedCategory] = useState<
    Exclude<CivicIssueCategory, 'Unclear or Unsupported Image'> | ''
  >('');
  const [finalDescription, setFinalDescription] = useState('');
  const [hasUserEditedDescription, setHasUserEditedDescription] = useState(false);

  // Submission & Upload Progress State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string | null>(null);
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<{
    stage: 'VALIDATION' | 'STORAGE' | 'GEMINI' | 'FIRESTORE';
    message: string;
    details?: string;
    code?: string;
  } | null>(null);

  // Preserved state for retry if Firestore fails after image upload
  const [inFlightComplaintId, setInFlightComplaintId] = useState<string | null>(null);
  const [cachedUploadedUrls, setCachedUploadedUrls] = useState<string[] | null>(null);
  const [cachedStorageResults, setCachedStorageResults] = useState<StorageUploadResult[] | null>(null);

  // Success Confirmation State
  const [submittedComplaintId, setSubmittedComplaintId] = useState<string | null>(null);
  const [submittedCategory, setSubmittedCategory] = useState<string>('');
  const [submittedImages, setSubmittedImages] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleDistrictChange = (newDistrict: GoaDistrict) => {
    setDistrict(newDistrict);
    const newTalukas = GOA_TALUKAS[newDistrict];
    setTaluka(newTalukas[0]);
  };

  // GPS Auto-detect
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setIsDetectingLocation(false);
        setLocationStatus(`GPS Locked: ±${Math.round(position.coords.accuracy)}m accuracy`);
      },
      (error) => {
        setIsDetectingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('GPS permission denied. Please enter coordinates manually or allow location permission and retry.');
        } else {
          setLocationStatus('Unable to retrieve GPS signal. Adjust coordinates manually or retry.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Multi-Image Gemini Vision AI Trigger (Real server call, surfaces actual errors)
  const triggerMultiImageAnalysis = async (photosList: SelectedPhotoItem[]) => {
    if (photosList.length === 0) {
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
        aiAbortControllerRef.current = null;
      }
      setAiAnalysis(null);
      setAiError(null);
      setImageAnalysis([]);
      setIsAnalyzingAI(false);
      setConflictAcknowledged(false);
      return null;
    }

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    setIsAnalyzingAI(true);
    setAiError(null);
    setConflictAcknowledged(false);
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('/api/ai/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: photosList.map((p) => ({
            imageBase64: p.base64DataUrl,
            mimeType: p.file.type || 'image/jpeg',
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `AI service returned HTTP ${response.status}`);
      }

      const result = data as StructuredAIAnalysis & { imageAnalysis?: SingleImageAnalysis[] };
      setAiAnalysis(result);
      setImageAnalysis(Array.isArray(result.imageAnalysis) ? result.imageAnalysis : []);

      // Auto-populate suggested category only if valid civic category
      const validCivicCat = CIVIC_ISSUE_CATEGORIES.find((c) => c === result.category);
      if (validCivicCat) {
        setUserSelectedCategory(validCivicCat);
      }

      // Populate editable description unless user already wrote a custom edit
      if (!hasUserEditedDescription && result.description) {
        setFinalDescription(result.description);
      }

      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return null;
      }
      console.error('Gemini Vision analysis request failed:', err);
      setAiAnalysis(null);
      setImageAnalysis([]);
      setAiError(
        err.message ||
          'Gemini Vision AI analysis failed. You can retry AI analysis or manually choose the issue category and describe the problem below.'
      );
      return null;
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Image Selection & Client Validation (1 to 5 photos, max 10MB, JPG/JPEG/PNG/WEBP)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPhotoValidationError(null);
    setSubmitError(null);

    const totalCount = selectedPhotos.length + files.length;
    if (totalCount > MAX_IMAGES) {
      setPhotoValidationError(
        `Maximum ${MAX_IMAGES} photographs are permitted per complaint. You currently have ${selectedPhotos.length} selected and tried to add ${files.length}.`
      );
      e.target.value = '';
      return;
    }

    setIsProcessingPhotos(true);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const newItems: SelectedPhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!validTypes.includes(file.type.toLowerCase())) {
        setPhotoValidationError(
          `File "${file.name}" has an unsupported format (${file.type || 'unknown'}). Allowed formats: JPG, JPEG, PNG, WEBP.`
        );
        setIsProcessingPhotos(false);
        e.target.value = '';
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setPhotoValidationError(
          `File "${file.name}" exceeds the 10 MB size limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
        );
        setIsProcessingPhotos(false);
        e.target.value = '';
        return;
      }

      try {
        const compressed = await compressImageToJPEG(file, 200 * 1024);
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          previewUrl,
          base64DataUrl: compressed.dataUrl,
          sizeKB: compressed.sizeKB,
        });
      } catch (err: any) {
        console.error('Error preparing image preview/compression:', file.name, err);
        setPhotoValidationError(`Could not read photograph "${file.name}". Please select a valid image file.`);
      }
    }

    const updatedList = [...selectedPhotos, ...newItems];
    setSelectedPhotos(updatedList);
    setCachedUploadedUrls(null);
    setCachedStorageResults(null);
    setIsProcessingPhotos(false);
    e.target.value = '';

    if (updatedList.length > 0) {
      await triggerMultiImageAnalysis(updatedList);
    }
  };

  // Remove individual photograph
  const handleRemovePhoto = async (idToRemove: string) => {
    const photoToRemove = selectedPhotos.find((p) => p.id === idToRemove);
    if (photoToRemove?.previewUrl) {
      URL.revokeObjectURL(photoToRemove.previewUrl);
    }
    const updated = selectedPhotos.filter((p) => p.id !== idToRemove);
    setSelectedPhotos(updated);
    setPhotoValidationError(null);
    setSubmitError(null);
    setCachedUploadedUrls(null);
    setCachedStorageResults(null);
    setUploadProgressMap({});

    if (selectedPhotoTab >= updated.length) {
      setSelectedPhotoTab(Math.max(0, updated.length - 1));
    }
    await triggerMultiImageAnalysis(updated);
  };

  // Clean up orphaned Firebase Storage files if citizen cancels after a Firestore failure
  const handleDiscardFailedSubmission = async () => {
    if (cachedStorageResults && cachedStorageResults.length > 0) {
      await deleteStorageObjects(cachedStorageResults.map((r) => r.storagePath));
    }
    setCachedUploadedUrls(null);
    setCachedStorageResults(null);
    setInFlightComplaintId(null);
    setSubmitError(null);
    setUploadProgressMap({});
  };

  // Reliable Submission Sequence
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // 1. Validate required citizen and location fields
    if (!fullName.trim() || fullName.trim().length < 2) {
      setSubmitError({
        stage: 'VALIDATION',
        message: "Please enter the complaint filer's full name (minimum 2 characters).",
      });
      return;
    }
    if (!contactNumber.trim() || contactNumber.trim().length < 7) {
      setSubmitError({
        stage: 'VALIDATION',
        message: 'Please enter a valid contact telephone number (e.g., +91 98221 XXXXX).',
      });
      return;
    }
    if (!issueLocation.trim() || issueLocation.trim().length < 3) {
      setSubmitError({
        stage: 'VALIDATION',
        message: 'Please specify the issue location (landmark, road, or village).',
      });
      return;
    }
    if (selectedPhotos.length === 0) {
      setSubmitError({
        stage: 'VALIDATION',
        message: 'Please upload between 1 and 5 photographs of the civic issue.',
      });
      return;
    }
    if (selectedPhotos.length > MAX_IMAGES) {
      setSubmitError({
        stage: 'VALIDATION',
        message: `Maximum ${MAX_IMAGES} photographs are permitted.`,
      });
      return;
    }
    if (aiAnalysis?.hasUnrelatedMultipleIssues && !conflictAcknowledged) {
      setSubmitError({
        stage: 'VALIDATION',
        message:
          'Your uploaded photographs appear to show multiple unrelated civic issues. Please remove unrelated photos so each complaint covers one issue, or confirm below if all photos depict the same site.',
      });
      return;
    }
    if (!userSelectedCategory) {
      setSubmitError({
        stage: 'VALIDATION',
        message: 'Please select or confirm the civic issue category before submitting.',
      });
      return;
    }
    if (!finalDescription.trim() || finalDescription.trim().length < 8) {
      setSubmitError({
        stage: 'VALIDATION',
        message: 'Please review or enter a clear issue description (minimum 8 characters).',
      });
      return;
    }

    setIsSubmitting(true);

    // 2. Generate unique complaint ID (or reuse in-flight ID during Firestore retry)
    const complaintId = inFlightComplaintId || generateComplaintId();
    setInFlightComplaintId(complaintId);

    try {
      // 3. Upload all photos to Firebase Storage under complaints/{complaintId}/images/{uniqueFileName}
      let uploadedImageUrls: string[] = cachedUploadedUrls || [];
      let storageResults: StorageUploadResult[] = cachedStorageResults || [];

      if (!cachedUploadedUrls || cachedUploadedUrls.length !== selectedPhotos.length) {
        setSubmissionStep(`Uploading ${selectedPhotos.length} photograph(s) to Firebase Storage...`);
        storageResults = [];
        const uploadedPathsInBatch: string[] = [];

        for (let i = 0; i < selectedPhotos.length; i++) {
          const item = selectedPhotos[i];
          setSubmissionStep(`Uploading photograph ${i + 1} of ${selectedPhotos.length} (${item.file.name})...`);

          try {
            const uploadResult = await uploadComplaintPhotograph(complaintId, item.file, (p) => {
              setUploadProgressMap((prev) => ({
                ...prev,
                [item.id]: p.percent,
              }));
            });
            storageResults.push(uploadResult);
            uploadedPathsInBatch.push(uploadResult.storagePath);
          } catch (storageErr: any) {
            // Partial upload failure: clean up already-uploaded files from this batch
            if (uploadedPathsInBatch.length > 0) {
              setSubmissionStep('Cleaning up incomplete upload batch...');
              await deleteStorageObjects(uploadedPathsInBatch);
            }
            setUploadProgressMap({});
            setSubmitError({
              stage: 'STORAGE',
              code: storageErr.code || 'storage/upload-failed',
              message: storageErr.message || `Failed to upload photograph "${item.file.name}".`,
              details:
                storageErr.code === 'storage/bucket-not-found' || storageErr.code === 'storage/unknown'
                  ? 'Firebase Storage returned 404 (bucket not initialized). Enable Storage in Firebase Console > Build > Storage and deploy storage.rules, then click Submit again.'
                  : 'Please check your network connection or Storage permissions and try again.',
            });
            setIsSubmitting(false);
            setSubmissionStep(null);
            return;
          }
        }

        uploadedImageUrls = storageResults.map((r) => r.downloadUrl);
        if (uploadedImageUrls.some((u) => !u.startsWith('https://'))) {
          throw new Error('Aborting Firestore save: invalid Storage download URL detected.');
        }
        setCachedUploadedUrls(uploadedImageUrls);
        setCachedStorageResults(storageResults);
      }

      // 4. Prepare complete Firestore document without undefined fields
      setSubmissionStep('Saving civic issue report to Cloud Firestore...');

      const parsedLat = parseFloat(latitude) || 15.4989;
      const parsedLng = parseFloat(longitude) || 73.8278;

      const aiDetectedCategory = aiAnalysis?.category || userSelectedCategory;
      const aiGeneratedDescription = aiAnalysis?.description || '';
      const aiSeverity: IssueSeverity = aiAnalysis?.severity || 'Medium';
      const aiConfidencePct = aiAnalysis ? Math.round(aiAnalysis.confidence * 100) : 0;

      const effectiveAIAnalysis: StructuredAIAnalysis = aiAnalysis || {
        category: userSelectedCategory,
        detectedIssue: `${userSelectedCategory} (Citizen Selected)`,
        description: finalDescription.trim(),
        severity: 'Medium',
        confidence: 0,
        isCivicIssue: true,
        needsHumanReview: true,
        isWaterLeakRelated: userSelectedCategory === 'Water Leakage',
        visualDecision: userSelectedCategory === 'Water Leakage' ? 'POSSIBLE_LEAKAGE' : 'POSSIBLE_ISSUE',
        leakageCategory: userSelectedCategory,
        problemDescription: finalDescription.trim(),
        visibleEvidence: ['AI analysis unavailable during submission; manually categorized by citizen'],
        confidenceScore: 0,
        verificationStatus: 'REQUIRES_HUMAN_REVIEW',
        recommendedAction: 'Manual engineering verification required at reported site.',
      };

      const complaintDocData: Record<string, any> = {
        complaintId,
        reportId: complaintId,
        userId: user?.uid || null,
        citizenUid: user?.uid || null,

        fullName: fullName.trim(),
        name: fullName.trim(),
        citizenName: fullName.trim(),
        contactNumber: contactNumber.trim(),

        district,
        taluka,
        landmark: issueLocation.trim(),
        leakageLocation: issueLocation.trim(),
        location: issueLocation.trim(),
        village: issueLocation.trim(),
        latitude: parsedLat,
        longitude: parsedLng,

        // Unified multi-category & confirmation fields
        category: userSelectedCategory,
        aiDetectedCategory,
        userSelectedCategory,
        detectedIssue: effectiveAIAnalysis.detectedIssue,
        aiGeneratedDescription,
        finalDescription: finalDescription.trim(),
        description: finalDescription.trim(),
        severity: aiSeverity,
        aiSeverity,

        // Verified Firebase Storage references
        imageUrls: uploadedImageUrls,
        imagePaths: storageResults.map((r) => r.storagePath),
        images: uploadedImageUrls,
        imageCount: uploadedImageUrls.length,
        imageUrl: uploadedImageUrls[0] || '',

        // AI Analysis metadata
        aiAnalysis: effectiveAIAnalysis,
        leakageCategory: userSelectedCategory,
        aiDescription: aiGeneratedDescription || finalDescription.trim(),
        aiConfidence: aiConfidencePct,
        aiConfidenceEstimate: effectiveAIAnalysis.confidence,
        aiVerificationStatus:
          effectiveAIAnalysis.visualDecision === 'UNRELATED_IMAGE'
            ? 'Unrelated'
            : effectiveAIAnalysis.needsHumanReview
            ? 'Needs Admin Review'
            : 'Verified',

        source: 'website',
        status: 'Submitted',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        adminRemarks: '',
        statusHistory: [
          {
            status: 'Submitted',
            timestamp: new Date().toISOString(),
            updatedBy: 'Citizen Web Portal',
            remarks: `Submitted under category "${userSelectedCategory}" with ${uploadedImageUrls.length} photograph(s). AI suggestion: "${aiDetectedCategory}".`,
          },
        ],
      };

      if (email.trim()) {
        complaintDocData.email = email.trim();
      }
      if (personalAddress.trim()) {
        complaintDocData.personalAddress = personalAddress.trim();
      }
      if (imageAnalysis.length > 0) {
        complaintDocData.imageAnalysis = imageAnalysis;
      }

      const complaintDocRef = doc(db, 'complaints', complaintId);
      await setDoc(complaintDocRef, complaintDocData);

      // 5. Read-after-write verification in Cloud Firestore
      const verifySnap = await getDoc(complaintDocRef);
      if (!verifySnap.exists()) {
        throw new Error('Firestore write could not be confirmed upon read-after-write verification.');
      }

      // 6. Confirm success
      setSubmittedComplaintId(complaintId);
      setSubmittedCategory(userSelectedCategory);
      setSubmittedImages(uploadedImageUrls);
      setInFlightComplaintId(null);
      setCachedUploadedUrls(null);
      setCachedStorageResults(null);
      setUploadProgressMap({});
    } catch (firestoreErr: any) {
      console.error('Firestore submission error:', firestoreErr);
      setSubmitError({
        stage: 'FIRESTORE',
        code: firestoreErr.code || 'firestore/write-failed',
        message: `Failed to save complaint record in Cloud Firestore: ${firestoreErr.message}`,
        details:
          cachedUploadedUrls && cachedUploadedUrls.length > 0
            ? 'Your photographs were safely uploaded to Firebase Storage. Click "Retry Firestore Submission" to save the record without re-uploading, or "Cancel & Clean Up Photos" to delete the uploaded images.'
            : undefined,
      });
      try {
        handleFirestoreError(firestoreErr, OperationType.CREATE, `complaints/${complaintId}`);
      } catch {
        // Logged via handleFirestoreError
      }
    } finally {
      setIsSubmitting(false);
      setSubmissionStep(null);
    }
  };

  const handleCopyId = () => {
    if (!submittedComplaintId) return;
    navigator.clipboard.writeText(submittedComplaintId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getDecisionBadge = (decision: AIVisualDecision) => {
    switch (decision) {
      case 'LEAKAGE_DETECTED':
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-300',
          icon: <Droplets className="w-4 h-4 text-blue-600" />,
          label: 'Water Leakage Detected',
        };
      case 'ISSUE_DETECTED':
      case 'DAMAGE_DETECTED':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          icon: <Wrench className="w-4 h-4 text-amber-600" />,
          label: 'Civic Issue Detected',
        };
      case 'CONFLICTING_IMAGES':
        return {
          bg: 'bg-rose-50 text-rose-900 border-rose-300',
          icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
          label: 'Separate Issues Detected',
        };
      case 'POSSIBLE_LEAKAGE':
      case 'POSSIBLE_ISSUE':
        return {
          bg: 'bg-sky-50 text-sky-900 border-sky-300',
          icon: <Search className="w-4 h-4 text-sky-600" />,
          label: 'Needs Review',
        };
      case 'UNRELATED_IMAGE':
        return {
          bg: 'bg-rose-50 text-rose-900 border-rose-300',
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
          label: 'Unsupported / Unrelated Image',
        };
      case 'UNCLEAR_IMAGE':
        return {
          bg: 'bg-orange-50 text-orange-900 border-orange-300',
          icon: <Eye className="w-4 h-4 text-orange-600" />,
          label: 'Unclear Image',
        };
      default:
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-300',
          icon: <Sparkles className="w-4 h-4 text-blue-600" />,
          label: 'AI Analyzed',
        };
    }
  };

  const getSeverityBadgeClass = (sev?: IssueSeverity) => {
    switch (sev) {
      case 'Critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  // SUCCESS CONFIRMATION SCREEN
  if (submittedComplaintId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden text-center p-8 sm:p-10 space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Civic Issue Registered Successfully
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Complaint Submitted!</h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Your <strong>{submittedCategory}</strong> complaint and {submittedImages.length} photograph(s) have been
              saved to Firebase Storage and Cloud Firestore with status <strong>Submitted</strong>.
            </p>
          </div>

          {/* Complaint ID Display Box */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/90 max-w-md mx-auto space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Your Unique Complaint Tracking ID
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl sm:text-2xl font-mono font-bold text-blue-700 tracking-wider">
                {submittedComplaintId}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Copy Complaint ID"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <span className="text-[11px] text-emerald-600 font-semibold block">Copied to clipboard!</span>}
          </div>

          {/* Uploaded Photos Display */}
          {submittedImages.length > 0 && (
            <div className="space-y-2 text-left bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">
                Stored Photographs ({submittedImages.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {submittedImages.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xs relative block hover:ring-2 hover:ring-blue-500"
                    title="Open original Firebase Storage image"
                  >
                    <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 bg-slate-950/80 text-white font-mono text-[9px] px-1 rounded font-bold">
                      #{idx + 1}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Final Description Summary */}
          <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Confirmed Category: {submittedCategory}
              </span>
              {aiAnalysis && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-blue-700 border border-sky-200">
                  AI Estimate: {Math.round(aiAnalysis.confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-slate-700 text-xs leading-relaxed">{finalDescription}</p>
          </div>

          {/* Navigation Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onNavigateToTrack(submittedComplaintId)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Track Complaint Status</span>
            </button>
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* Page Header (Part 1) */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
          <FilePlus2 className="w-3.5 h-3.5" />
          <span>Goa Citizen Grievance Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Report a Civic Issue
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          Report water leakage, potholes, damaged roads and other public infrastructure problems. Our AI system analyses
          the photographs to identify and categorise the issue.
        </p>
      </div>

      {/* WhatsApp Channel Notice */}
      <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold block">Prefer Reporting via WhatsApp?</span>
            <span className="text-emerald-800 text-[11px]">
              Citizens can send photos of water leaks, potholes, road damage, or civic issues via WhatsApp. The
              sender&apos;s phone number and AI classification flow into the same Goa complaint pipeline.
            </span>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full self-start sm:self-auto border border-emerald-300 shrink-0">
          WhatsApp Channel
        </span>
      </div>

      {/* Submission / Storage / Firestore Error Diagnostic Alert */}
      {submitError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm space-y-2 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold uppercase tracking-wider text-[11px] text-rose-800">
                  {submitError.stage} Error {submitError.code ? `(${submitError.code})` : ''}
                </span>
                {cachedUploadedUrls && cachedUploadedUrls.length > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                    Photos Uploaded to Storage
                  </span>
                )}
              </div>
              <p className="font-medium text-rose-900">{submitError.message}</p>
              {submitError.details && (
                <p className="text-[11px] text-rose-800/90 bg-rose-100/70 p-2.5 rounded-lg mt-1 border border-rose-200">
                  {submitError.details}
                </p>
              )}
            </div>
          </div>

          {cachedUploadedUrls && cachedUploadedUrls.length > 0 && (
            <div className="pt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDiscardFailedSubmission}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancel &amp; Delete Uploaded Photos</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Firestore Submission (Skip Re-upload)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Unified Civic Reporting Form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white rounded-3xl shadow-lg border border-slate-200/90 p-6 sm:p-8 space-y-8"
      >
        {/* SECTION 1: FILER INFORMATION */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                1
              </span>
              <span>Filer Information</span>
            </h2>
            <span className="text-[11px] text-slate-400">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Fernandes"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 text-xs bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. +91 98221 XXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 text-xs bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Personal Residential Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={personalAddress}
                onChange={(e) => setPersonalAddress(e.target.value)}
                placeholder="e.g. House No. 142, Church Vaddo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 text-xs bg-white"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: ISSUE LOCATION (Part 4) */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                2
              </span>
              <span>Issue Location</span>
            </h2>
            <span className="text-[11px] text-slate-400">* Required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Goa District</label>
              <select
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value as GoaDistrict)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
              >
                {GOA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Taluka Division</label>
              <select
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
              >
                {GOA_TALUKAS[district].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Specific Location Landmark, Road or Village <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={issueLocation}
              onChange={(e) => setIssueLocation(e.target.value)}
              placeholder="e.g. Near Mapusa Market Junction, or St. Anthony Chapel Road, Calangute"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 text-xs bg-white font-medium"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Geotag Coordinates (Optional for Map Dispatch)</span>
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-blue-700 transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-60"
              >
                {isDetectingLocation ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>{isDetectingLocation ? 'Acquiring GPS...' : 'Auto-detect GPS'}</span>
              </button>
            </div>

            {locationStatus && <p className="text-[11px] font-mono text-blue-700">{locationStatus}</p>}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Latitude</label>
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Longitude</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: PHOTOGRAPHS & AI IMAGE ANALYSIS */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                3
              </span>
              <span>Photographs &amp; Gemini AI Visual Inspection</span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {selectedPhotos.length} of {MAX_IMAGES} photos selected
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Upload <strong>1 to 5 photographs</strong> (JPG, JPEG, PNG, or WEBP; max 10 MB per photo) showing the water
            leakage, pothole, road damage, or civic issue.
          </p>

          {selectedPhotos.length < MAX_IMAGES && (
            <label className="relative border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 hover:bg-blue-50/60 rounded-3xl p-6 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer group text-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                multiple
                onChange={handleImageChange}
                disabled={isProcessingPhotos || isSubmitting}
                className="sr-only"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                {isProcessingPhotos ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-950 block">
                  {selectedPhotos.length === 0 ? 'Click or Tap to Upload Issue Photos' : 'Add More Photographs'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  JPG, JPEG, PNG, WEBP • Up to 10 MB per file • 1 to 5 photos
                </span>
              </div>
            </label>
          )}

          {photoValidationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{photoValidationError}</span>
            </div>
          )}

          {/* Selected Photographs Grid with Individual Upload Progress */}
          {selectedPhotos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Selected Photographs ({selectedPhotos.length})</span>
                <span className="text-slate-400 text-[11px]">Click ✕ on any photo to remove or replace</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {selectedPhotos.map((item, idx) => {
                  const uploadPct = uploadProgressMap[item.id];
                  return (
                    <div
                      key={item.id}
                      className="relative group rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 aspect-square shadow-xs"
                    >
                      <img
                        src={item.previewUrl}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold">
                        #{idx + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        disabled={isSubmitting}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer disabled:opacity-50"
                        title="Remove this photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {typeof uploadPct === 'number' && uploadPct < 100 ? (
                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 space-y-1">
                          <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-sky-400 h-full transition-all"
                              style={{ width: `${uploadPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-sky-300 font-mono block text-center">
                            Uploading {uploadPct}%
                          </span>
                        </div>
                      ) : (
                        <div className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] font-mono px-1 rounded">
                          {Math.round(item.sizeKB)} KB
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Loading Banner */}
          {isAnalyzingAI && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-sky-50/80 border border-blue-200 flex items-center gap-3.5">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-blue-950 block">
                  Gemini Vision AI Analysing {selectedPhotos.length} Photograph{selectedPhotos.length > 1 ? 's' : ''}...
                </span>
                <p className="text-[11px] text-slate-600">
                  Identifying issue category (water leakage, potholes, road damage, or public infrastructure), severity,
                  and drafting an editable issue description.
                </p>
              </div>
            </div>
          )}

          {/* AI Failure Alert (Real fallback to manual selection without fake AI success) */}
          {aiError && !isAnalyzingAI && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block">AI Image Analysis Unavailable</span>
                    <p className="text-[11px] text-amber-900 leading-relaxed">{aiError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerMultiImageAnalysis(selectedPhotos)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Retry AI</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 4 (PART 3): AI IMAGE ANALYSIS RESULTS & CITIZEN CONFIRMATION */}
          {(aiAnalysis || selectedPhotos.length > 0) && !isAnalyzingAI && (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-sky-50/90 to-blue-50/60 border border-sky-200 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-sky-200/80 gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                      AI Image Analysis Results
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Review AI findings, confirm or change the category, and edit the description before submitting.
                    </p>
                  </div>
                </div>

                {aiAnalysis && (() => {
                  const badge = getDecisionBadge(aiAnalysis.visualDecision);
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getSeverityBadgeClass(
                          aiAnalysis.severity
                        )}`}
                      >
                        Severity: {aiAnalysis.severity}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Conflicting Multiple Unrelated Civic Issues Warning */}
              {aiAnalysis?.hasUnrelatedMultipleIssues && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 text-xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold block text-rose-900">
                        Multiple Unrelated Civic Issues Detected
                      </span>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        {aiAnalysis.unrelatedIssuesReason ||
                          'Your uploaded photographs appear to show unrelated civic problems. Please remove unrelated photographs and submit separate complaints for each issue.'}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-rose-900 bg-white/80 p-2 rounded-lg border border-rose-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conflictAcknowledged}
                      onChange={(e) => setConflictAcknowledged(e.target.checked)}
                      className="rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                    />
                    <span>I confirm all attached photographs depict the same civic issue at this single location</span>
                  </label>
                </div>
              )}

              {/* Unclear or Unsupported Image Callout */}
              {aiAnalysis && !aiAnalysis.isCivicIssue && !aiAnalysis.hasUnrelatedMultipleIssues && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block text-amber-900">
                      Unclear or Unsupported Photograph Detected
                    </span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      The AI could not verify a physical civic infrastructure problem in the uploaded photograph(s)
                      (flagged for human review). Please upload clear on-site photos or manually choose the accurate
                      category below if submitting for manual verification.
                    </p>
                  </div>
                </div>
              )}

              {/* AI Result Metrics Grid */}
              {aiAnalysis && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/90 p-3 rounded-xl border border-sky-100">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block font-semibold">
                      AI Suggested Category
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm block mt-0.5">{aiAnalysis.category}</span>
                    {aiAnalysis.category !== 'Unclear or Unsupported Image' &&
                      userSelectedCategory !== aiAnalysis.category && (
                        <button
                          type="button"
                          onClick={() =>
                            setUserSelectedCategory(
                              aiAnalysis.category as Exclude<CivicIssueCategory, 'Unclear or Unsupported Image'>
                            )
                          }
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Accept AI Category</span>
                        </button>
                      )}
                  </div>

                  <div className="bg-white/90 p-3 rounded-xl border border-sky-100">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block font-semibold">
                      Detected Issue
                    </span>
                    <span className="font-bold text-slate-800 text-xs block mt-0.5">{aiAnalysis.detectedIssue}</span>
                  </div>

                  <div className="bg-white/90 p-3 rounded-xl border border-sky-100">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block font-semibold">
                      Confidence (AI Estimate)
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${
                            aiAnalysis.confidence >= 0.8
                              ? 'bg-emerald-600'
                              : aiAnalysis.confidence >= 0.6
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.round(aiAnalysis.confidence * 100))}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {Math.round(aiAnalysis.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Visible Evidence Bullets */}
              {aiAnalysis?.visibleEvidence && aiAnalysis.visibleEvidence.length > 0 && (
                <div className="bg-white/75 p-3 rounded-xl border border-sky-100 space-y-1.5">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                    Supporting Visual Observations
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                    {aiAnalysis.visibleEvidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Per-Image Breakdown Tabs when multiple photos uploaded */}
              {imageAnalysis.length > 1 && (
                <div className="pt-2 border-t border-sky-200/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Individual Photograph Analysis ({imageAnalysis.length} photos)
                  </span>

                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {imageAnalysis.map((item, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSelectedPhotoTab(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                          selectedPhotoTab === idx
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>Photo #{item.imageIndex}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                            selectedPhotoTab === idx
                              ? 'bg-blue-800 text-white'
                              : item.isCivicIssue
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.category}
                        </span>
                      </button>
                    ))}
                  </div>

                  {imageAnalysis[selectedPhotoTab] && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {imageAnalysis[selectedPhotoTab].detectedIssue} ({imageAnalysis[selectedPhotoTab].category})
                        </span>
                        <span className="text-[10px] font-mono font-bold text-blue-600">
                          {Math.round(imageAnalysis[selectedPhotoTab].confidence * 100)}% est.
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{imageAnalysis[selectedPhotoTab].description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* CITIZEN CONFIRMATION & EDITING CONTROLS (PART 3) */}
              <div className="bg-white p-4 rounded-2xl border border-sky-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">
                    Confirm Category &amp; Issue Description <span className="text-rose-500">*</span>
                  </span>
                  {aiAnalysis && aiAnalysis.category !== 'Unclear or Unsupported Image' && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSelectedCategory(
                          aiAnalysis.category as Exclude<CivicIssueCategory, 'Unclear or Unsupported Image'>
                        );
                        setFinalDescription(aiAnalysis.description);
                        setHasUserEditedDescription(false);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 self-start sm:self-auto cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Use AI Suggestion</span>
                    </button>
                  )}
                </div>

                {/* Final Complaint Category Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Confirmed Issue Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={userSelectedCategory}
                    onChange={(e) =>
                      setUserSelectedCategory(
                        e.target.value as Exclude<CivicIssueCategory, 'Unclear or Unsupported Image'>
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="">-- Select Civic Issue Category --</option>
                    {CIVIC_ISSUE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                        {aiAnalysis?.category === cat ? ' (AI Suggested)' : ''}
                      </option>
                    ))}
                  </select>
                  {aiAnalysis &&
                    userSelectedCategory &&
                    userSelectedCategory !== aiAnalysis.category &&
                    aiAnalysis.category !== 'Unclear or Unsupported Image' && (
                      <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                        You changed the category from AI suggestion (&quot;{aiAnalysis.category}&quot;) to &quot;
                        {userSelectedCategory}&quot;. Your selection will be saved as the final complaint category.
                      </span>
                    )}
                </div>

                {/* Editable Final Issue Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Issue Description <span className="text-rose-500">*</span>
                    </label>
                    {hasUserEditedDescription && aiAnalysis?.description && (
                      <button
                        type="button"
                        onClick={() => {
                          setFinalDescription(aiAnalysis.description);
                          setHasUserEditedDescription(false);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Restore AI description
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={finalDescription}
                    onChange={(e) => {
                      setFinalDescription(e.target.value);
                      setHasUserEditedDescription(true);
                    }}
                    placeholder="Describe the water leak, pothole depth, road crack, or public infrastructure problem visible at this site..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 leading-relaxed"
                  />
                </div>
              </div>

              <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                <span>
                  AI analysis assists citizen reporting and engineering triage. Officers review both AI observations and
                  your confirmed category.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Photos stored in Firebase Storage • Reports persisted in Cloud Firestore</span>
          </div>

          <div className="w-full sm:w-auto flex flex-col items-end gap-1.5">
            {submissionStep && (
              <span className="text-[11px] text-blue-700 font-medium animate-pulse">{submissionStep}</span>
            )}
            <button
              type="submit"
              disabled={isSubmitting || isProcessingPhotos}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Complaint...</span>
                </>
              ) : (
                <>
                  <span>
                    Submit Complaint ({selectedPhotos.length} Photo{selectedPhotos.length !== 1 ? 's' : ''})
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
