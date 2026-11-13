import React, { createContext, useContext, useState } from 'react';
import { SupportedLanguage } from '../types';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    'app.title': 'LeakWatch Goa',
    'app.tagline': 'Every Drop Matters. Every Leak Counts.',
    'nav.home': 'Home',
    'nav.report': 'Report a Complaint',
    'nav.track': 'Track Complaint',
    'nav.admin': 'Admin Portal',
    'nav.dashboard': 'Dashboard',
    'hero.badge': 'Government of Goa • Public Works Department (Water Division)',
    'hero.heading': 'Every Drop Matters. Every Leak Counts.',
    'hero.subheading': 'Empowering citizens across North and South Goa to instantly report drinking water pipe bursts, valve damage, and public leakages for rapid repair.',
    'btn.reportLeak': 'Report a Leak Now',
    'btn.trackComplaint': 'Track Complaint Status',
    'btn.adminLogin': 'PWD Admin Login',
  },
  gom: {
    // Konkani (Devanagari)
    'app.title': 'LeakWatch गोंय',
    'app.tagline': 'दर एक थेंब मोलादीक. दर एक गळती हिशोबांत.',
    'nav.home': 'घर',
    'nav.report': 'तक्रार नोंद करा',
    'nav.track': 'तक्रार तपासा',
    'nav.admin': 'प्रशासक पोर्टल',
    'nav.dashboard': 'डॅशबोर्ड',
    'hero.badge': 'गोंय सरकार • भौशीक बांदकाम खातें (उदक विभाग)',
    'hero.heading': 'दर एक थेंब मोलादीक. दर एक गळती हिशोबांत.',
    'hero.subheading': 'उत्तर आनी दक्षिण गोंयांतल्या नागरिकांक पिण्याच्या उदकाच्यो नळ गळत्यो बेगोबेग नोंद करून दुरुस्त करपाखातीर अधिकार.',
    'btn.reportLeak': 'आताच गळती नोंद करा',
    'btn.trackComplaint': 'तक्रारीची स्थिती तपासा',
    'btn.adminLogin': 'PWD प्रशासक लॉगिन',
  },
  mr: {
    // Marathi
    'app.title': 'LeakWatch गोवा',
    'app.tagline': 'प्रत्येक थेंब मौल्यवान. प्रत्येक गळती मोजली जाते.',
    'nav.home': 'मुख्यपृष्ठ',
    'nav.report': 'तक्रार नोंदवा',
    'nav.track': 'तक्रार मागोवा',
    'nav.admin': 'प्रशासक लॉगिन',
    'nav.dashboard': 'डॅशबोर्ड',
    'hero.badge': 'गोवा शासन • सार्वजनिक बांधकाम विभाग (जल विभाग)',
    'hero.heading': 'प्रत्येक थेंब मौल्यवान. प्रत्येक गळती मोजली जाते.',
    'hero.subheading': 'उत्तर व दक्षिण गोव्यातील नागरिकांना पिण्याच्या पाण्याच्या पाईपलाईन गळतीची तात्काळ तक्रार नोंदवून जलद दुरुस्तीसाठी सहाय्य.',
    'btn.reportLeak': 'आताच गळती नोंदवा',
    'btn.trackComplaint': 'तक्रार स्थिती तपासा',
    'btn.adminLogin': 'PWD ॲडमिन लॉगिन',
  },
  hi: {
    // Hindi
    'app.title': 'LeakWatch गोवा',
    'app.tagline': 'हर बूँद कीमती है। हर रिसाव मायने रखता है।',
    'nav.home': 'होम',
    'nav.report': 'शिकायत दर्ज करें',
    'nav.track': 'शिकायत ट्रैक करें',
    'nav.admin': 'एडमिन पोर्टल',
    'nav.dashboard': 'डैशबोर्ड',
    'hero.badge': 'गोवा सरकार • लोक निर्माण विभाग (जल प्रभाग)',
    'hero.heading': 'हर बूँद कीमती है। हर रिसाव मायने रखता है।',
    'hero.subheading': 'उत्तर और दक्षिण गोवा के नागरिकों को पेयजल पाइपलाइन रिसाव की त्वरित रिपोर्टिंग और समाधान हेतु सशक्त मंच।',
    'btn.reportLeak': 'अभी रिसाव दर्ज करें',
    'btn.trackComplaint': 'शिकायत की स्थिति देखें',
    'btn.adminLogin': 'PWD एडमिन लॉगिन',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<SupportedLanguage>('en');

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
