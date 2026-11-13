import React from 'react';
import {
  FilePlus2,
  Search,
  Shield,
  Activity,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Waves,
} from 'lucide-react';
import { SAMPLE_STATISTICS } from '../utils/demoData';

interface HomePageProps {
  onNavigate: (page: 'home' | 'report' | 'track' | 'admin-login' | 'admin-dashboard') => void;
  isAdmin: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, isAdmin }) => {
  return (
    <div className="space-y-14 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-slate-900 to-slate-950 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
        <div className="absolute top-1/4 right-5 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-5 left-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-700/60 text-sky-300 text-xs font-medium tracking-wide shadow-xs">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
            <span>Government of Goa • Public Works &amp; Civic Infrastructure Monitoring</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Every Drop Matters.{' '}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-200">
              Every Civic Issue Counts.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            The official community-driven public infrastructure reporting portal for Goa.
            Report water leakage, potholes, road damage, and damaged civic assets directly to field engineers across North &amp; South Goa.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={() => onNavigate('report')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <FilePlus2 className="w-5 h-5" />
              <span>Report a Civic Issue</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => onNavigate('track')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Search className="w-4 h-4 text-sky-400" />
              <span>Track Complaint Status</span>
            </button>

            <button
              onClick={() => onNavigate(isAdmin ? 'admin-dashboard' : 'admin-login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-medium text-sm text-slate-300 hover:text-white bg-transparent hover:bg-slate-800/50 border border-transparent hover:border-slate-700 transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>{isAdmin ? 'Open Admin Dashboard' : 'PWD Officer Login'}</span>
            </button>
          </div>

          <div className="pt-2 text-xs text-slate-400 flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> AI-Powered Issue Categorisation
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sky-400" /> GPS Auto-Location
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Instant Tracking ID
            </span>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/90 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Goa Infrastructure &amp; Water Conservation Impact</h2>
              </div>
              <p className="text-xs text-slate-500">
                Aggregated civic intervention metrics across North Goa &amp; South Goa divisions
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Sample Benchmark Data
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issues Resolved</div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                {SAMPLE_STATISTICS.totalLeaksReported.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span>↑ 94.1% resolution rate</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Potable Water Saved</div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono">
                {SAMPLE_STATISTICS.litersSavedMillions} M
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Liters of treated drinking water</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Response Time</div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                {SAMPLE_STATISTICS.avgResponseHours} hrs
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">From report to crew dispatch</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Coverage Across Goa</div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-indigo-700 font-mono">
                {SAMPLE_STATISTICS.talukasActive} / 12
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Talukas across North &amp; South Goa</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2 mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Citizen Action Protocol
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            How LeakWatch Works in 4 Simple Steps
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Reporting water leaks, potholes, road damage, or civic problems takes under 60 seconds with automated AI analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base mb-4">
              1
            </div>
            <h3 className="font-bold text-slate-900 mb-1.5 text-base">Spot &amp; Snap</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              See a leaking pipe, deep pothole, damaged road, or open manhole? Capture 1 to 5 photos for AI inspection.
            </p>
          </div>

          <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-base mb-4">
              2
            </div>
            <h3 className="font-bold text-slate-900 mb-1.5 text-base">Pin Location &amp; Review AI</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Capture GPS coordinates, confirm or edit the AI-suggested category, and refine the issue description.
            </p>
          </div>

          <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base mb-4">
              3
            </div>
            <h3 className="font-bold text-slate-900 mb-1.5 text-base">Get Complaint ID</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instantly receive your tracking ID (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-blue-700">LW-GOA-2026-XXXXXX</code>) to monitor status.
            </p>
          </div>

          <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base mb-4">
              4
            </div>
            <h3 className="font-bold text-slate-900 mb-1.5 text-base">PWD &amp; Civic Action</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The assigned engineering squad is dispatched to resolve the problem and update the public resolution timeline.
            </p>
          </div>
        </div>
      </section>

      {/* Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-sky-300 text-xs font-medium border border-blue-400/30">
              <Waves className="w-3.5 h-3.5" /> Priority Infrastructure Routing
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Reported Civic Issues Receive Priority Field Routing
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Whether it is treated potable water wastage, hazardous monsoon potholes, or damaged public footpaths across Goa,
              citizen photo reports route directly to engineers for faster action.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('report')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs tracking-wide shadow-md transition-all cursor-pointer"
              >
                <span>Submit Civic Issue Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
