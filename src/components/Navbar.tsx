import React, { useState } from 'react';
import { Droplets, Shield, Search, FilePlus2, Menu, X, LogOut, CheckCircle2, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SupportedLanguage } from '../types';

interface NavbarProps {
  currentPage: 'home' | 'report' | 'track' | 'admin-login' | 'admin-dashboard';
  onNavigate: (page: 'home' | 'report' | 'track' | 'admin-login' | 'admin-dashboard') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { user, isAdmin, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const navItems = [
    { id: 'home' as const, label: t('nav.home'), icon: null },
    { id: 'report' as const, label: t('nav.report'), icon: FilePlus2, highlight: true },
    { id: 'track' as const, label: t('nav.track'), icon: Search },
    {
      id: (isAdmin ? 'admin-dashboard' : 'admin-login') as 'admin-dashboard' | 'admin-login',
      label: isAdmin ? t('nav.dashboard') : t('nav.admin'),
      icon: Shield,
    },
  ];

  const languages: { code: SupportedLanguage; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'gom', label: 'Konkani', native: 'कोंकणी' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Government banner stripe */}
      <div className="bg-slate-900 text-white text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium tracking-wide">Government of Goa</span>
            <span className="text-slate-400 hidden sm:inline">• Public Works Department (Water Division)</span>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <span className="hidden md:inline text-[11px] text-cyan-300 font-mono">Toll-Free Helpline: 1800-233-1244</span>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded-full border border-blue-700">
                <CheckCircle2 className="w-3 h-3 text-blue-400" /> Authorized Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-17">
          {/* Logo & Branding */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 text-left group transition-transform focus:outline-hidden"
          >
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-800 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-all">
              <Droplets className="w-6 h-6 text-white" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                  Leak<span className="text-blue-600">Watch</span>
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-mono border border-amber-200">
                  GOA
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 leading-none tracking-tight">
                PWD Water Supply Monitoring Portal
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              if (item.highlight) {
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className="ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white shadow-sm shadow-blue-600/30 transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span>{item.label}</span>
                  </button>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Language Selector Dropdown */}
            <div className="relative ml-2">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
                title="Select Language"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="uppercase font-semibold">{language}</span>
              </button>

              {langMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setLangMenuOpen(false)}
                >
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Language
                  </div>
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLanguage(l.code)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
                        language === l.code
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{l.label}</span>
                      <span className="text-slate-400 text-[11px] font-normal">{l.native}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Signed-in user indicator & Sign out */}
            {user ? (
              <div className="flex items-center gap-2 pl-3 ml-2 border-l border-slate-200">
                <div
                  className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs border border-blue-200"
                  title={`${user.email} (${isAdmin ? 'Admin' : 'Citizen'})`}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
                  ) : (
                    user.email?.charAt(0).toUpperCase() || 'A'
                  )}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 max-w-[110px] truncate leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 capitalize">
                    {isAdmin ? 'Admin' : 'Citizen'}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('admin-login')}
                className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )}
          </nav>

          {/* Mobile hamburger button */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Quick language toggle on mobile */}
            <button
              onClick={() => {
                const nextLang: SupportedLanguage =
                  language === 'en' ? 'gom' : language === 'gom' ? 'mr' : language === 'mr' ? 'hi' : 'en';
                setLanguage(nextLang);
              }}
              className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md uppercase"
            >
              {language}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-xl animate-in slide-in-from-top-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.highlight
                    ? 'bg-blue-600 text-white font-semibold'
                    : isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{item.label}</span>
              </button>
            );
          })}

          {user && (
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="truncate max-w-[200px]">{user.email}</span>
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="text-rose-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
