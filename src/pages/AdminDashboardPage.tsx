import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Shield,
  Search,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ExternalLink,
  Eye,
  RefreshCw,
  Edit3,
  Phone,
  Image as ImageIcon,
  PlusCircle,
  X,
  Map as MapIcon,
  Layers,
  Check,
  Sparkles,
  BarChart3,
  Mail,
  Home,
  MessageSquare,
  Clock,
  History,
  AlertTriangle,
  Wrench,
  XCircle,
  Droplets,
  HelpCircle,
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  Complaint,
  ComplaintStatus,
  CIVIC_ISSUE_CATEGORIES,
  AIVisualDecision,
  StatusHistoryEntry,
  normalizeTopCategory,
} from '../types';
import { DEMO_COMPLAINTS } from '../utils/demoData';
import { LeakageMap } from '../components/LeakageMap';
import { AIReportingAnalytics } from '../components/AIReportingAnalytics';

interface AdminDashboardPageProps {
  onNavigateHome: () => void;
}

const ADMIN_STATUS_OPTIONS: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Rejected',
];

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'table' | 'map' | 'analytics'>('table');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedTaluka, setSelectedTaluka] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDecision, setSelectedDecision] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal & image load error state
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [modalActivePhotoIndex, setModalActivePhotoIndex] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [editStatus, setEditStatus] = useState<ComplaintStatus>('Submitted');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const [isSeeding, setIsSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // Real-time Firestore Listener
  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    const complaintsQuery = query(collection(db, 'complaints'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      complaintsQuery,
      (snapshot) => {
        const fetched: Complaint[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push(docSnap.data() as Complaint);
        });
        setComplaints(fetched);
        setLoading(false);
      },
      (error) => {
        console.warn('Firestore timestamp order failed, attempting fallback query:', error);
        const fallbackQuery = query(collection(db, 'complaints'));
        onSnapshot(
          fallbackQuery,
          (snap) => {
            const list: Complaint[] = [];
            snap.forEach((d) => list.push(d.data() as Complaint));
            setComplaints(list);
            setLoading(false);
          },
          (err) => {
            console.error('Firestore fallback error:', err);
            setFetchError('Failed to load complaints from Firestore. Verify network access and permissions.');
            setLoading(false);
            try {
              handleFirestoreError(err, OperationType.LIST, 'complaints');
            } catch {
              // logged
            }
          }
        );
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeComplaint) {
      setEditStatus(activeComplaint.status || 'Submitted');
      setEditRemarks(activeComplaint.adminRemarks || '');
      setModalActivePhotoIndex(0);
      setUpdateSuccess(false);
      setBrokenImages({});
    }
  }, [activeComplaint]);

  const getComplaintCategory = (c: Complaint) =>
    normalizeTopCategory(
      c.userSelectedCategory || c.category || c.aiAnalysis?.category || c.leakageCategory
    );

  const getComplaintPhotos = (c: Complaint): string[] => {
    if (c.imageUrls && c.imageUrls.length > 0) return c.imageUrls;
    if (c.images && c.images.length > 0) return c.images;
    return [c.imageUrl || c.photoData || (c as any).imageData].filter(Boolean);
  };

  // Status Metrics counts
  const counts = useMemo(() => {
    const res = {
      total: complaints.length,
      newOrReview: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
    };
    complaints.forEach((c) => {
      const s = c.status as string;
      if (s === 'Submitted' || s === 'Under Review' || s === 'Pending') {
        res.newOrReview++;
      } else if (s === 'Assigned' || s === 'In Progress') {
        res.inProgress++;
      } else if (s === 'Resolved') {
        res.resolved++;
      } else if (s === 'Rejected') {
        res.rejected++;
      }
    });
    return res;
  }, [complaints]);

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (selectedDistrict !== 'all' && c.district !== selectedDistrict) return false;
      if (selectedTaluka !== 'all' && c.taluka !== selectedTaluka) return false;

      const decision = c.aiAnalysis?.visualDecision || (c as any).visualDecision;
      if (selectedDecision !== 'all' && decision !== selectedDecision) return false;

      const topCat = getComplaintCategory(c);
      if (selectedCategory !== 'all' && topCat !== selectedCategory) return false;

      if (selectedStatus !== 'all') {
        const s = c.status as string;
        if (
          selectedStatus === 'SubmittedGroup' &&
          s !== 'Submitted' &&
          s !== 'Under Review' &&
          s !== 'Pending'
        ) {
          return false;
        }
        if (selectedStatus === 'ActiveGroup' && s !== 'Assigned' && s !== 'In Progress') {
          return false;
        }
        if (
          selectedStatus !== 'SubmittedGroup' &&
          selectedStatus !== 'ActiveGroup' &&
          s !== selectedStatus
        ) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = (c.complaintId || '').toLowerCase().includes(q);
        const matchName = (c.name || c.citizenName || '').toLowerCase().includes(q);
        const matchContact = (c.contactNumber || '').toLowerCase().includes(q);
        const matchLoc = (c.landmark || c.location || (c as any).village || '').toLowerCase().includes(q);
        const matchTaluka = (c.taluka || '').toLowerCase().includes(q);
        const matchCat = topCat.toLowerCase().includes(q);
        const matchDesc = (
          c.finalDescription ||
          c.aiAnalysis?.description ||
          c.aiDescription ||
          c.description ||
          ''
        )
          .toLowerCase()
          .includes(q);
        return matchId || matchName || matchContact || matchLoc || matchTaluka || matchCat || matchDesc;
      }

      return true;
    });
  }, [
    complaints,
    selectedDistrict,
    selectedTaluka,
    selectedCategory,
    selectedDecision,
    selectedStatus,
    searchQuery,
  ]);

  const handleUpdateComplaint = async () => {
    if (!activeComplaint) return;
    setIsUpdating(true);
    setUpdateSuccess(false);

    try {
      const complaintRef = doc(db, 'complaints', activeComplaint.complaintId);
      const currentUserEmail = auth.currentUser?.email || 'Admin PWD Officer';

      const newHistoryEntry: StatusHistoryEntry = {
        status: editStatus,
        timestamp: new Date().toISOString(),
        updatedBy: currentUserEmail,
        remarks: editRemarks.trim() || `Status updated to ${editStatus}`,
      };

      const existingHistory = activeComplaint.statusHistory || [];
      const updatedHistory = [...existingHistory, newHistoryEntry];

      const updatePayload: Record<string, any> = {
        status: editStatus,
        adminRemarks: editRemarks.trim(),
        statusHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(complaintRef, updatePayload);

      setActiveComplaint((prev) =>
        prev
          ? {
              ...prev,
              status: editStatus,
              adminRemarks: editRemarks.trim(),
              statusHistory: updatedHistory,
            }
          : null
      );
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3500);
    } catch (err: any) {
      console.error('Update error:', err);
      alert('Failed to update complaint status: ' + (err.message || 'Check permissions.'));
      try {
        handleFirestoreError(err, OperationType.UPDATE, `complaints/${activeComplaint.complaintId}`);
      } catch {
        // Logged
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSeedDemoRecords = async () => {
    if (
      !window.confirm(
        'Seed 4 sample Goa civic issue records into Firestore (Water Leakage, Potholes, Road Damage, Public Infrastructure)?'
      )
    ) {
      return;
    }

    setIsSeeding(true);
    setSeedNotice(null);

    try {
      const batch = writeBatch(db);
      for (const item of DEMO_COMPLAINTS) {
        const complaintRef = doc(db, 'complaints', item.complaintId);
        batch.set(complaintRef, {
          ...item,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setSeedNotice('Successfully seeded 4 sample multi-category Goa complaints into Firestore!');
      setTimeout(() => setSeedNotice(null), 5000);
    } catch (err: any) {
      console.error('Seed error:', err);
      setSeedNotice('Failed to seed complaints: ' + (err.message || 'Check Firestore rules.'));
    } finally {
      setIsSeeding(false);
    }
  };

  const getStatusBadge = (status: ComplaintStatus | string) => {
    switch (status) {
      case 'Submitted':
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Under Review':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'Assigned':
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getDecisionBadge = (decision?: AIVisualDecision | string) => {
    switch (decision) {
      case 'LEAKAGE_DETECTED':
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-300',
          icon: <Droplets className="w-3.5 h-3.5 text-blue-600" />,
          label: 'Water Leakage',
        };
      case 'ISSUE_DETECTED':
      case 'DAMAGE_DETECTED':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          icon: <Wrench className="w-3.5 h-3.5 text-amber-600" />,
          label: 'Issue Detected',
        };
      case 'CONFLICTING_IMAGES':
        return {
          bg: 'bg-rose-50 text-rose-900 border-rose-300',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
          label: 'Conflicting Photos',
        };
      case 'POSSIBLE_LEAKAGE':
      case 'POSSIBLE_ISSUE':
        return {
          bg: 'bg-sky-50 text-sky-900 border-sky-300',
          icon: <Search className="w-3.5 h-3.5 text-sky-600" />,
          label: 'Needs Review',
        };
      case 'UNRELATED_IMAGE':
        return {
          bg: 'bg-rose-50 text-rose-900 border-rose-300',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
          label: 'Unsupported Image',
        };
      case 'UNCLEAR_IMAGE':
        return {
          bg: 'bg-orange-50 text-orange-900 border-orange-300',
          icon: <Eye className="w-3.5 h-3.5 text-orange-600" />,
          label: 'Unclear Image',
        };
      default:
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-300',
          icon: <Sparkles className="w-3.5 h-3.5 text-blue-600" />,
          label: 'AI Analyzed',
        };
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (typeof timestamp === 'string') {
      try {
        return new Date(timestamp).toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return timestamp;
      }
    }
    return 'Recent';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  PWD Civic Issue Dispatch Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 uppercase tracking-wider border border-sky-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-600" />
                  Gemini Vision AI Engine
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Unified triage for water leakage, potholes, road damage, and public infrastructure across Goa
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSeedDemoRecords}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSeeding ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlusCircle className="w-3.5 h-3.5 text-amber-700" />
            )}
            <span>Seed Sample Records</span>
          </button>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Table View ({filteredComplaints.length})</span>
            </button>
            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Goa GIS Map</span>
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'analytics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {seedNotice && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
          <span className="font-medium">{seedNotice}</span>
          <button onClick={() => setSeedNotice(null)} className="text-amber-800 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Database Access Notice</span>
            <p>{fetchError}</p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Issues', count: counts.total, status: 'all', color: 'text-slate-900', border: 'hover:border-slate-400' },
          { label: 'Submitted / Review', count: counts.newOrReview, status: 'SubmittedGroup', color: 'text-amber-600', border: 'hover:border-amber-400' },
          { label: 'Assigned / Active', count: counts.inProgress, status: 'ActiveGroup', color: 'text-blue-600', border: 'hover:border-blue-400' },
          { label: 'Resolved', count: counts.resolved, status: 'Resolved', color: 'text-emerald-600', border: 'hover:border-emerald-400' },
          { label: 'Rejected / Invalid', count: counts.rejected, status: 'Rejected', color: 'text-rose-600', border: 'hover:border-rose-400' },
        ].map((item) => {
          const isSelected = selectedStatus === item.status;
          return (
            <button
              key={item.label}
              onClick={() => setSelectedStatus(item.status)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/60 shadow-sm'
                  : `border-slate-200/90 bg-white shadow-xs ${item.border}`
              }`}
            >
              <div className="text-[11px] font-medium text-slate-500 truncate">{item.label}</div>
              <div className={`text-2xl font-extrabold font-mono mt-1 ${item.color}`}>{item.count}</div>
            </button>
          );
        })}
      </div>

      {/* Category Filter Pills Bar (Part 8) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Issues ({complaints.length})
        </button>
        {CIVIC_ISSUE_CATEGORIES.map((cat) => {
          const catCount = complaints.filter((c) => getComplaintCategory(c) === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat} ({catCount})
            </button>
          );
        })}
      </div>

      {activeView === 'map' && (
        <LeakageMap complaints={filteredComplaints} onSelectComplaint={(c) => setActiveComplaint(c)} />
      )}

      {activeView === 'analytics' && <AIReportingAnalytics complaints={filteredComplaints} />}

      {activeView === 'table' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, filer name, phone, landmark, category, or description..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 text-xs bg-slate-50/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="w-full sm:w-40">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="all">All Statuses</option>
                  {ADMIN_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="Pending">Pending (Legacy)</option>
                </select>
              </div>

              <div className="w-full sm:w-44">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="all">All Categories</option>
                  {CIVIC_ISSUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-36">
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedTaluka('all');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="all">All Districts</option>
                  <option value="North Goa">North Goa</option>
                  <option value="South Goa">South Goa</option>
                </select>
              </div>

              {(selectedDistrict !== 'all' ||
                selectedTaluka !== 'all' ||
                selectedCategory !== 'all' ||
                selectedDecision !== 'all' ||
                selectedStatus !== 'all' ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedDistrict('all');
                    setSelectedTaluka('all');
                    setSelectedCategory('all');
                    setSelectedDecision('all');
                    setSelectedStatus('all');
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Loading complaints from Cloud Firestore...</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="py-16 text-center space-y-3 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">No Matching Complaints Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No civic issue records match your active category or search filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Complaint ID</th>
                      <th className="py-3.5 px-3">Photos</th>
                      <th className="py-3.5 px-4">Filer &amp; Contact</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Category &amp; Severity</th>
                      <th className="py-3.5 px-3">AI Confidence</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredComplaints.map((c) => {
                      const photoList = getComplaintPhotos(c);
                      const primaryPhoto = photoList[0];
                      const photoCount = c.imageCount || photoList.length;
                      const filerName = c.name || c.citizenName || 'Anonymous Citizen';
                      const finalCategory = getComplaintCategory(c);
                      const detectedIssue = c.detectedIssue || c.aiAnalysis?.detectedIssue;
                      const severity = c.severity || c.aiAnalysis?.severity || 'Medium';
                      const confidence = c.aiAnalysis?.confidenceScore || c.aiConfidence || 0;
                      const thumbKey = `thumb-${c.complaintId}`;

                      return (
                        <tr key={c.complaintId} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                            <div>{c.complaintId}</div>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-sans font-normal">
                              {c.source === 'whatsapp' ? (
                                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                  <MessageSquare className="w-2.5 h-2.5" /> WhatsApp
                                </span>
                              ) : (
                                <span>Web Portal</span>
                              )}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            {primaryPhoto && !brokenImages[thumbKey] ? (
                              <div
                                onClick={() => setActiveComplaint(c)}
                                className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer hover:scale-105 transition-transform"
                                title="Click to inspect photographs"
                              >
                                <img
                                  src={primaryPhoto}
                                  alt="Complaint thumbnail"
                                  onError={() => setBrokenImages((prev) => ({ ...prev, [thumbKey]: true }))}
                                  className="w-full h-full object-cover"
                                />
                                {photoCount > 1 && (
                                  <span className="absolute bottom-0.5 right-0.5 bg-slate-950/80 text-white font-mono text-[9px] px-1 rounded font-bold">
                                    {photoCount}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div
                                onClick={() => setActiveComplaint(c)}
                                className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 cursor-pointer"
                                title={primaryPhoto ? 'Thumbnail failed to load - click to open' : 'No image'}
                              >
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{filerName}</div>
                            {c.contactNumber ? (
                              <a
                                href={`tel:${c.contactNumber}`}
                                className="text-[11px] text-slate-500 font-mono flex items-center gap-1 hover:text-blue-600"
                              >
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{c.contactNumber}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No phone</span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div
                              className="font-medium text-slate-800 truncate"
                              title={c.landmark || c.location || (c as any).village}
                            >
                              {c.landmark || c.location || (c as any).village || 'Goa location'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {c.taluka ? `${c.taluka}, ` : ''}
                              {c.district || 'Goa'}
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                  {finalCategory}
                                </span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${getSeverityBadge(
                                    severity
                                  )}`}
                                >
                                  {severity}
                                </span>
                              </div>
                              {detectedIssue && (
                                <span className="text-[11px] text-slate-600 truncate" title={detectedIssue}>
                                  {detectedIssue}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${confidence >= 80 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(100, confidence)}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-[11px] text-slate-700">{confidence}%</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {formatDate(c.timestamp || c.createdAt)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadge(
                                c.status
                              )}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {c.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => setActiveComplaint(c)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Review &amp; Dispatch</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DETAIL & STATUS UPDATE MODAL */}
      {activeComplaint && (() => {
        const photoList = getComplaintPhotos(activeComplaint);
        const activePhotoUrl = photoList[modalActivePhotoIndex] || photoList[0];
        const modalImgKey = `modal-${activeComplaint.complaintId}-${modalActivePhotoIndex}`;
        const aiRes = activeComplaint.aiAnalysis;
        const decision = aiRes?.visualDecision || (activeComplaint as any).visualDecision || 'ISSUE_DETECTED';
        const finalCategory = getComplaintCategory(activeComplaint);
        const aiCategory = activeComplaint.aiDetectedCategory || aiRes?.category || finalCategory;
        const detectedIssue = activeComplaint.detectedIssue || aiRes?.detectedIssue || finalCategory;
        const severity = activeComplaint.severity || aiRes?.severity || 'Medium';
        const finalDesc =
          activeComplaint.finalDescription ||
          activeComplaint.description ||
          aiRes?.description ||
          activeComplaint.aiDescription ||
          'Visual analysis of civic infrastructure evidence.';
        const aiDesc = activeComplaint.aiGeneratedDescription || aiRes?.description;
        const confidence = aiRes?.confidenceScore || activeComplaint.aiConfidence || 0;
        const badge = getDecisionBadge(decision);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] overflow-y-auto overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-sky-300 block uppercase tracking-wider">
                    Goa PWD Civic Grievance Management &amp; Resolution
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <h3 className="text-xl font-mono font-bold">{activeComplaint.complaintId}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(
                        activeComplaint.status
                      )}`}
                    >
                      {activeComplaint.status}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(
                        severity
                      )}`}
                    >
                      {severity} Severity
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveComplaint(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {updateSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Status updated to <strong>{editStatus}</strong> and logged to audit history!
                    </span>
                  </div>
                )}

                {/* Photographs Gallery with Explicit Error Handling & Storage Links */}
                {photoList.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        Stored Photographs ({photoList.length} photo{photoList.length > 1 ? 's' : ''})
                      </span>
                      {activePhotoUrl && (
                        <a
                          href={activePhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Open Storage Image</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 min-h-48 max-h-80 flex items-center justify-center p-2">
                      {!brokenImages[modalImgKey] ? (
                        <img
                          src={activePhotoUrl}
                          alt={`Evidence ${modalActivePhotoIndex + 1}`}
                          onError={() => setBrokenImages((prev) => ({ ...prev, [modalImgKey]: true }))}
                          className="max-h-76 w-auto object-contain"
                        />
                      ) : (
                        <div className="text-center p-6 space-y-2 text-rose-200 text-xs">
                          <AlertCircle className="w-7 h-7 text-rose-400 mx-auto" />
                          <p className="font-bold">Image failed to render in preview</p>
                          <a
                            href={activePhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-sky-300 hover:underline"
                          >
                            <span>Open Direct Storage URL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {photoList.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {photoList.map((url, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => setModalActivePhotoIndex(i)}
                            className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                              modalActivePhotoIndex === i
                                ? 'border-blue-600 ring-2 ring-blue-500/40 shadow-sm'
                                : 'border-slate-200 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0.5 right-0.5 bg-slate-900/80 text-white font-mono text-[9px] px-1 rounded font-bold">
                              #{i + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Visual Analysis & Citizen Confirmation Comparison */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50/70 border border-sky-200 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-sky-200/80">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-950 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>AI Image Analysis &amp; Category Audit</span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white/85 p-3 rounded-xl border border-sky-100">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Confirmed Category
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">{finalCategory}</span>
                    </div>

                    <div className="bg-white/85 p-3 rounded-xl border border-sky-100">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        AI Detected Category
                      </span>
                      <span className="font-bold text-blue-800 text-xs">{aiCategory}</span>
                    </div>

                    <div className="bg-white/85 p-3 rounded-xl border border-sky-100">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        AI Estimate
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${confidence >= 80 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(100, confidence)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-800 text-xs">{confidence}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/90 p-3.5 rounded-xl border border-sky-100 space-y-1">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
                      Detected Issue: {detectedIssue}
                    </span>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">{finalDesc}</p>
                    {aiDesc && aiDesc !== finalDesc && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100 mt-1">
                        Original AI Draft: {aiDesc}
                      </p>
                    )}
                  </div>

                  {aiRes?.recommendedAction && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                      <Wrench className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Recommended Engineering Action:</span>
                        <span className="text-[11px]">{aiRes.recommendedAction}</span>
                      </div>
                    </div>
                  )}

                  {activeComplaint.imageAnalysis && activeComplaint.imageAnalysis.length > 1 && (
                    <div className="pt-2 border-t border-sky-200/80 space-y-1.5 text-xs">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Per-Photograph Analysis ({activeComplaint.imageAnalysis.length} photos):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeComplaint.imageAnalysis.map((obs) => (
                          <div
                            key={obs.imageIndex}
                            className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] space-y-0.5"
                          >
                            <span className="font-bold text-blue-700 block">
                              Photo #{obs.imageIndex}: {obs.category || obs.leakageCategory} — {obs.detectedIssue}
                            </span>
                            <p className="text-slate-600">{obs.description || obs.problemDescription}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Citizen & Location Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                      Filer Information
                    </span>
                    <p className="font-bold text-slate-800 text-sm">
                      {activeComplaint.name || activeComplaint.citizenName || 'Anonymous Citizen'}
                    </p>
                    {activeComplaint.contactNumber && (
                      <a
                        href={`tel:${activeComplaint.contactNumber}`}
                        className="text-blue-600 hover:underline flex items-center gap-1 font-mono pt-0.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-500" />
                        <span>{activeComplaint.contactNumber}</span>
                      </a>
                    )}
                    {activeComplaint.email && (
                      <div className="text-slate-600 flex items-center gap-1 pt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{activeComplaint.email}</span>
                      </div>
                    )}
                    {activeComplaint.personalAddress && (
                      <div className="text-slate-600 flex items-center gap-1 pt-0.5">
                        <Home className="w-3.5 h-3.5 text-slate-400" />
                        <span>{activeComplaint.personalAddress}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                      Issue Location
                    </span>
                    <p className="font-bold text-slate-800 text-sm">
                      {activeComplaint.landmark || activeComplaint.location || (activeComplaint as any).village}
                    </p>
                    <p className="text-slate-600">
                      {activeComplaint.taluka ? `${activeComplaint.taluka}, ` : ''}
                      {activeComplaint.district || 'Goa'}
                    </p>
                    {activeComplaint.latitude && activeComplaint.longitude && (
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-sky-700 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-sky-600" />
                          {activeComplaint.latitude.toFixed(4)}, {activeComplaint.longitude.toFixed(4)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${activeComplaint.latitude},${activeComplaint.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <span>Open Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Update Form */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Update Resolution Status &amp; Action Notes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Update Grievance Status
                      </label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as ComplaintStatus)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      >
                        {ADMIN_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Confirmed Issue Category
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={finalCategory}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-600 font-semibold cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Official Admin Remarks / Field Action Summary
                    </label>
                    <textarea
                      rows={3}
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      placeholder="e.g. PWD field crew dispatched. Excavation / repair work completed and verified."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveComplaint(null)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateComplaint}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isUpdating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating Firestore...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Status &amp; Audit Entry</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Timestamped Status History */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Timestamped Status History</span>
                  </div>

                  {activeComplaint.statusHistory && activeComplaint.statusHistory.length > 0 ? (
                    <div className="space-y-2.5">
                      {activeComplaint.statusHistory.map((hist, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(
                                  hist.status
                                )}`}
                              >
                                {hist.status}
                              </span>
                              <span className="font-semibold text-slate-800">{hist.updatedBy}</span>
                            </div>
                            {hist.remarks && <p className="text-slate-600 text-xs italic">{hist.remarks}</p>}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 whitespace-nowrap flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(hist.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
                      Initial submission logged. No subsequent modifications recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
