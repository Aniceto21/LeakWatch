import React from 'react';
import { Droplets, Phone, MapPin, Mail, ShieldAlert, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: 'home' | 'report' | 'track' | 'admin-login') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 text-sm">
      {/* Emergency Strip */}
      <div className="bg-gradient-to-r from-blue-900/90 to-indigo-950 py-3 px-4 border-b border-blue-800/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-sky-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-white">Emergency Main Pipe Burst?</span>
            <span className="text-slate-300">Contact PWD 24/7 Water Control Room immediately:</span>
          </div>
          <div className="flex items-center gap-4 font-mono font-bold text-sky-300">
            <span>📞 1800-233-1244</span>
            <span className="hidden md:inline text-slate-500">|</span>
            <span className="hidden md:inline">0832-2419400 (Panaji)</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: About */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shadow-xs">
                <Droplets className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">LeakWatch Goa</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every drop matters. Every leak counts. A community-powered water leak reporting and rapid-response grievance redressal initiative for Goa.
            </p>
            <div className="inline-block px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-[11px] text-amber-300">
              ⚡ Goa Gov-Tech Hackathon Prototype
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Quick Services</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('report')}
                  className="hover:text-sky-400 transition-colors text-left"
                >
                  Report a Water Leak
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('track')}
                  className="hover:text-sky-400 transition-colors text-left"
                >
                  Track Existing Complaint
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin-login')}
                  className="hover:text-sky-400 transition-colors text-left"
                >
                  PWD Officer / Admin Login
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-sky-400 transition-colors text-left"
                >
                  LeakWatch Portal Home
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Key Divisions */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Operational Divisions</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Division III (Water Works) - Altinho, Panaji</li>
              <li>• Division XVII (PHE) - Porvorim, North Goa</li>
              <li>• Division XII (Water Works) - Pajifond, Margao</li>
              <li>• Sub-Division Vasco, Daibal & Ponda</li>
              <li>• Salaulim & Opa Water Treatment Plants</li>
            </ul>
          </div>

          {/* Col 4: Contact & Office */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Headquarters</h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <span>Public Works Department, Altinho, Panaji, Goa 403001</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>0832-2224000 / 2224011</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>water-grievance@pwd.goa.gov.in</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} LeakWatch Goa • Public Works Department, Government of Goa.</p>
          <div className="flex items-center gap-1">
            <span>Built for Goa water conservation with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" />
          </div>
        </div>
      </div>
    </footer>
  );
};
