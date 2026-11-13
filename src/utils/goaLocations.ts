import { GoaDistrict, LeakCategory } from '../types';

export const GOA_DISTRICTS: GoaDistrict[] = ['North Goa', 'South Goa'];

export const GOA_TALUKAS: Record<GoaDistrict, string[]> = {
  'North Goa': ['Bardez', 'Bicholim', 'Pernem', 'Sattari', 'Tiswadi'],
  'South Goa': ['Canacona', 'Dharbandora', 'Mormugao', 'Ponda', 'Quepem', 'Salcete', 'Sanguem'],
};

export const POPULAR_VILLAGES: Record<string, string[]> = {
  // North Goa Talukas
  Bardez: ['Mapusa', 'Calangute', 'Candolim', 'Porvorim', 'Anjuna', 'Aldona', 'Guirim', 'Saligao', 'Siolim', 'Nagoa'],
  Tiswadi: ['Panaji', 'Santa Cruz', 'Ribandar', 'Taleigao', 'Merces', 'Corlim', 'Old Goa', 'Chimbel'],
  Pernem: ['Pernem Town', 'Mandrem', 'Morjim', 'Arambol', 'Dhargal', 'Tuem', 'Corgao'],
  Bicholim: ['Bicholim Town', 'Sanquelim', 'Mayem', 'Pale', 'Mulgao', 'Bordem'],
  Sattari: ['Valpoi', 'Honda', 'Pissurlem', 'Nagargao', 'Keri', 'Thane'],
  // South Goa Talukas
  Salcete: ['Margao', 'Colva', 'Benaulim', 'Fatorda', 'Navelim', 'Nuvem', 'Curtorim', 'Varca', 'Cavelossim', 'Loutolim'],
  Mormugao: ['Vasco da Gama', 'Dabolim', 'Chicalim', 'Cortalim', 'Bogmalo', 'Sancoale'],
  Ponda: ['Ponda Town', 'Farmagudi', 'Bandora', 'Shiroda', 'Usgao', 'Kavlem', 'Borim', 'Kundaim'],
  Canacona: ['Chaudi', 'Palolem', 'Agonda', 'Poinguinim', 'Loliem', 'Cotigao'],
  Quepem: ['Quepem Town', 'Curchorem', 'Tilamol', 'Balli', 'Ambaulim', 'Avedem'],
  Sanguem: ['Sanguem Town', 'Netravali', 'Rivona', 'Bhati', 'Curdi', 'Uguem'],
  Dharbandora: ['Dharbandora', 'Mollem', 'Collem', 'Kirlapal', 'Sacorda'],
};

export const LEAK_CATEGORIES: { label: LeakCategory; description: string; severity: 'High' | 'Medium' | 'Critical' }[] = [
  { label: 'Pipeline Leakage', description: 'Underground or surface main drinking water supply pipe rupture', severity: 'Critical' },
  { label: 'Broken Pipe', description: 'Cracked or severed distribution line gushing water', severity: 'Critical' },
  { label: 'Overflowing Water Tank', description: 'PWD overhead reservoir or public cistern continuous overflow', severity: 'High' },
  { label: 'Damaged Valve', description: 'Defective air valve, sluice gate or pressure release leaking water', severity: 'Medium' },
  { label: 'Public Water Leakage', description: 'Broken public tap standpost or community fountain running continuously', severity: 'Medium' },
  { label: 'Other', description: 'Subsurface seepage, meter connection leak, or unclassified water loss', severity: 'Medium' },
];
