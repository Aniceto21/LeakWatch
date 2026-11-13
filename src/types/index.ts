export type GoaDistrict = 'North Goa' | 'South Goa';

export type CivicIssueCategory =
  | 'Water Leakage'
  | 'Potholes'
  | 'Road Damage'
  | 'Public Infrastructure'
  | 'Other Civic Issues'
  | 'Unclear or Unsupported Image';

export const CIVIC_ISSUE_CATEGORIES: Exclude<CivicIssueCategory, 'Unclear or Unsupported Image'>[] = [
  'Water Leakage',
  'Potholes',
  'Road Damage',
  'Public Infrastructure',
  'Other Civic Issues',
];

export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type AIVisualDecision =
  | 'LEAKAGE_DETECTED'
  | 'ISSUE_DETECTED'
  | 'DAMAGE_DETECTED'
  | 'POSSIBLE_LEAKAGE'
  | 'POSSIBLE_ISSUE'
  | 'NO_LEAKAGE_VISIBLE'
  | 'UNRELATED_IMAGE'
  | 'UNCLEAR_IMAGE'
  | 'CONFLICTING_IMAGES';

export type AIProblemType =
  | CivicIssueCategory
  | 'Pipeline Leakage'
  | 'Broken or Damaged Water Pipeline'
  | 'Pipe Joint or Valve Leakage'
  | 'Overflowing Water Tank'
  | 'Public Water Supply Leakage'
  | 'Roadside Water Leakage'
  | 'Water Wastage'
  | 'Other Water Infrastructure Damage'
  | 'No Visible Leakage'
  | 'Unrelated Image'
  | 'Unclear Image'
  | 'Not Identified';

export type AIVerificationState =
  | 'AI_ANALYSED'
  | 'REQUIRES_HUMAN_REVIEW'
  | 'NOT_ENOUGH_EVIDENCE';

// Backward compatibility alias for earlier code
export type AILeakageCategory = AIProblemType;
export type AIVerificationStatus = 'Verified' | 'Needs Admin Review' | 'Unrelated';

export type ComplaintStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Rejected'
  | 'Pending';

export interface StatusHistoryEntry {
  status: ComplaintStatus;
  timestamp: any;
  updatedBy: string;
  remarks?: string;
}

export type UserRole = 'citizen' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

export type LeakCategory =
  | 'Pipeline Leakage'
  | 'Broken Pipe'
  | 'Overflowing Water Tank'
  | 'Damaged Valve'
  | 'Public Water Leakage'
  | 'Other';

export interface SingleImageAnalysis {
  imageIndex: number;
  category: CivicIssueCategory;
  detectedIssue: string;
  description: string;
  severity: IssueSeverity;
  confidence: number; // 0.0 to 1.0
  isCivicIssue: boolean;
  visualDecision: AIVisualDecision;
  visibleEvidence: string[];
  // Backward compatibility fields
  leakageCategory?: AIProblemType;
  problemDescription?: string;
  confidenceScore?: number;
}

export interface StructuredAIAnalysis {
  // Primary unified civic schema
  category: CivicIssueCategory;
  detectedIssue: string;
  description: string;
  severity: IssueSeverity;
  confidence: number; // 0.0 to 1.0 AI estimate
  isCivicIssue: boolean;
  needsHumanReview: boolean;
  hasUnrelatedMultipleIssues?: boolean;
  unrelatedIssuesReason?: string;

  // Supporting details & backward-compatible fields
  isWaterLeakRelated: boolean | null;
  visualDecision: AIVisualDecision;
  leakageCategory: AIProblemType;
  problemDescription: string;
  visibleEvidence: string[];
  confidenceScore: number; // 0 to 100
  verificationStatus: AIVerificationState;
  recommendedAction: string;
}

export interface Complaint {
  complaintId: string;
  reportId?: string;
  userId?: string | null;
  citizenUid?: string | null;

  fullName?: string;
  name: string;
  citizenName?: string;
  contactNumber: string;
  email?: string;
  personalAddress?: string;

  // Location fields
  district?: GoaDistrict;
  taluka?: string;
  landmark?: string;
  leakageLocation?: string;
  location: string;
  village?: string;
  latitude?: number;
  longitude?: number;

  // Unified multi-category & citizen confirmation fields
  category?: CivicIssueCategory | string;
  aiDetectedCategory?: CivicIssueCategory | string;
  userSelectedCategory?: CivicIssueCategory | string;
  detectedIssue?: string;
  aiGeneratedDescription?: string;
  finalDescription?: string;
  severity?: IssueSeverity;
  aiSeverity?: IssueSeverity;

  // Multiple photograph upload (1 to 5 images)
  imageUrls?: string[];
  imagePaths?: string[];
  images: string[];
  imageCount: number;

  // Comprehensive AI Analysis
  aiAnalysis: StructuredAIAnalysis;
  imageAnalysis?: SingleImageAnalysis[];

  source: 'website' | 'whatsapp';
  timestamp: any; // Firestore serverTimestamp
  createdAt?: any;
  updatedAt?: any;
  status: ComplaintStatus;
  adminRemarks?: string;
  statusHistory?: StatusHistoryEntry[];

  // Legacy compatibility fields
  imageUrl?: string;
  photoData?: string;
  leakageCategory?: AIProblemType;
  aiDescription?: string;
  aiConfidence?: number;
  aiConfidenceEstimate?: number;
  aiVerificationStatus?: AIVerificationStatus;
  description?: string;
}

export interface AIAnalysisResult extends StructuredAIAnalysis {
  imageAnalysis?: SingleImageAnalysis[];
}

export type SupportedLanguage = 'en' | 'gom' | 'mr' | 'hi';

/**
 * Helper to normalize legacy and new complaint categories into the 5 official top-level categories
 */
export function normalizeTopCategory(
  rawCategory?: string
): Exclude<CivicIssueCategory, 'Unclear or Unsupported Image'> | 'Unclear or Unsupported Image' {
  if (!rawCategory) return 'Water Leakage';
  const lower = rawCategory.toLowerCase();
  if (lower.includes('pothole')) return 'Potholes';
  if (lower.includes('road damage') || lower.includes('cracked road') || lower.includes('footpath') || lower.includes('uneven road')) {
    return 'Road Damage';
  }
  if (
    lower.includes('public infrastructure') ||
    lower.includes('manhole') ||
    lower.includes('drainage') ||
    lower.includes('street') ||
    lower.includes('facility') ||
    lower.includes('facilities')
  ) {
    return 'Public Infrastructure';
  }
  if (
    lower.includes('water') ||
    lower.includes('pipeline') ||
    lower.includes('pipe') ||
    lower.includes('valve') ||
    lower.includes('tank') ||
    lower.includes('leak')
  ) {
    return 'Water Leakage';
  }
  if (lower.includes('unclear') || lower.includes('unrelated') || lower.includes('unsupported') || lower.includes('not identified')) {
    return 'Unclear or Unsupported Image';
  }
  if (lower.includes('other civic')) return 'Other Civic Issues';
  return 'Other Civic Issues';
}
