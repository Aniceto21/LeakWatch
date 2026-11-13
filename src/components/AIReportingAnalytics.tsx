import React, { useMemo } from 'react';
import { Complaint, normalizeTopCategory } from '../types';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  MapPin,
  Sparkles,
  CheckCircle2,
  Clock,
  Waves,
} from 'lucide-react';

interface AIReportingAnalyticsProps {
  complaints: Complaint[];
}

export const AIReportingAnalytics: React.FC<AIReportingAnalyticsProps> = ({ complaints }) => {
  const metrics = useMemo(() => {
    const total = complaints.length;
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    let rejected = 0;

    let verifiedAI = 0;
    let needsReviewAI = 0;
    let unrelatedAI = 0;
    let totalConfidence = 0;

    const categoryMap: Record<string, number> = {};
    const areaMap: Record<string, number> = {};
    const monthlyMap: Record<string, number> = {};

    complaints.forEach((c) => {
      const s = c.status as string;
      if (s === 'Submitted' || s === 'Under Review' || s === 'Pending') pending++;
      else if (s === 'Assigned' || s === 'In Progress') inProgress++;
      else if (s === 'Resolved') resolved++;
      else if (s === 'Rejected') rejected++;

      if (c.aiVerificationStatus === 'Verified') verifiedAI++;
      else if (c.aiVerificationStatus === 'Needs Admin Review') needsReviewAI++;
      else if (c.aiVerificationStatus === 'Unrelated') unrelatedAI++;

      const conf = c.aiConfidence ?? c.aiAnalysis?.confidenceScore ?? 0;
      totalConfidence += conf;

      const cat = normalizeTopCategory(
        c.userSelectedCategory || c.category || c.aiAnalysis?.category || c.leakageCategory
      );
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;

      const area = c.taluka || c.landmark?.split(',')[0]?.trim() || c.location?.split(',')[0]?.trim() || 'Goa';
      areaMap[area] = (areaMap[area] || 0) + 1;

      let monthKey = 'Current';
      if (c.timestamp?.toDate) {
        monthKey = c.timestamp.toDate().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      } else if (c.createdAt?.toDate) {
        monthKey = c.createdAt.toDate().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      } else {
        monthKey = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      }
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
    });

    const sortedCategories = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    const sortedAreas = Object.entries(areaMap)
      .map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const monthlyTrends = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }));
    const avgConfidence = total > 0 ? Math.round(totalConfidence / total) : 0;

    return {
      total,
      pending,
      inProgress,
      resolved,
      rejected,
      verifiedAI,
      needsReviewAI,
      unrelatedAI,
      avgConfidence,
      sortedCategories,
      sortedAreas,
      monthlyTrends,
    };
  }, [complaints]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Logged</span>
            <Waves className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-slate-900">{metrics.total}</div>
          <div className="mt-1 text-[11px] text-slate-500">Cloud Firestore records</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Submitted / Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-amber-600">{metrics.pending}</div>
          <div className="mt-1 text-[11px] text-amber-800">Awaiting engineer dispatch</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 text-xs font-semibold">
            <span>Assigned / Active</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-blue-600">{metrics.inProgress}</div>
          <div className="mt-1 text-[11px] text-blue-800">Field crews dispatched</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-emerald-600">{metrics.resolved}</div>
          <div className="mt-1 text-[11px] text-emerald-800">Issues repaired &amp; verified</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Most Reported Civic Issue Categories</h3>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Confirmed Categories
            </span>
          </div>

          {metrics.sortedCategories.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No complaints recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.sortedCategories.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span className="truncate pr-2">{item.name}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {item.count} ({item.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Highest Incident Areas in Goa</h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">Goa Divisions</span>
          </div>

          {metrics.sortedAreas.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No locations recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.sortedAreas.map((area) => (
                <div key={area.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{area.name}</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {area.count} report{area.count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, area.percent * 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Monthly Complaint Volume Trends</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700">Timeline Activity</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {metrics.monthlyTrends.map((t) => (
              <div key={t.month} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-xs text-slate-500 font-medium block">{t.month}</span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">{t.count}</span>
                <span className="text-[10px] text-slate-400">Total Complaints</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-3xl p-6 text-white space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold tracking-tight">Gemini AI Vision Audit</h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Multi-category visual classification and severity assessment powered by server-side Gemini Vision AI.
          </p>

          <div className="space-y-2 pt-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-blue-800/60">
              <span className="text-slate-300">AI Verified Civic Issues:</span>
              <span className="font-bold text-emerald-400 font-mono">{metrics.verifiedAI}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-blue-800/60">
              <span className="text-slate-300">Needs Human Review:</span>
              <span className="font-bold text-amber-400 font-mono">{metrics.needsReviewAI}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-blue-800/60">
              <span className="text-slate-300">Unsupported / Unrelated:</span>
              <span className="font-bold text-rose-400 font-mono">{metrics.unrelatedAI}</span>
            </div>
            <div className="flex justify-between items-center pt-2 font-semibold">
              <span className="text-sky-300">Avg AI Estimate:</span>
              <span className="font-extrabold text-white font-mono text-sm">{metrics.avgConfidence}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
