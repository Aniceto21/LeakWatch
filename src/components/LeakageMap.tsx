import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Complaint,
  ComplaintStatus,
  CIVIC_ISSUE_CATEGORIES,
  normalizeTopCategory,
} from '../types';
import { MapPin, Filter } from 'lucide-react';

interface LeakageMapProps {
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
}

export const LeakageMap: React.FC<LeakageMapProps> = ({ complaints, onSelectComplaint }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const getStatusMarkerColor = (status: ComplaintStatus | string) => {
    switch (status) {
      case 'Submitted':
      case 'Pending':
      case 'Under Review':
        return '#f59e0b'; // amber-500
      case 'Assigned':
      case 'In Progress':
        return '#2563eb'; // blue-600
      case 'Resolved':
        return '#10b981'; // emerald-500
      case 'Rejected':
        return '#f43f5e'; // rose-500
      default:
        return '#64748b';
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [15.3911, 73.98],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • LeakWatch Goa',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    const filtered = complaints.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      const topCat = normalizeTopCategory(
        c.userSelectedCategory || c.category || c.aiAnalysis?.category || c.leakageCategory
      );
      if (filterCategory !== 'all' && topCat !== filterCategory) return false;
      return true;
    });

    const bounds: L.LatLngExpression[] = [];

    filtered.forEach((c) => {
      const lat = c.latitude || 15.4989;
      const lng = c.longitude || 73.8278;

      bounds.push([lat, lng]);

      const pinColor = getStatusMarkerColor(c.status);
      const topCat = normalizeTopCategory(
        c.userSelectedCategory || c.category || c.aiAnalysis?.category || c.leakageCategory
      );
      const thumbUrl = c.imageUrls?.[0] || c.images?.[0] || c.imageUrl || '';
      const locLabel = c.landmark || c.location || (c as any).village || 'Goa';
      const confPct = c.aiConfidence ?? c.aiAnalysis?.confidenceScore ?? 0;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; background-color: ${pinColor}; opacity: 0.25; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 22px; height: 22px; background-color: ${pinColor}; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
              <div style="width: 6px; height: 6px; background-color: #ffffff; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; max-width: 260px; line-height: 1.4;">
          ${
            thumbUrl
              ? `<div style="width: 100%; height: 110px; border-radius: 8px; overflow: hidden; background: #0f172a; margin-bottom: 8px;">
                  <img src="${thumbUrl}" alt="Civic Issue" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>`
              : ''
          }
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
            ${topCat}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 700; font-family: monospace; color: #2563eb; font-size: 11px;">
              ${c.complaintId}
            </span>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 9999px; font-weight: 700; font-size: 10px; background-color: ${pinColor}20; color: ${pinColor}; border: 1px solid ${pinColor}40;">
              ${c.status}
            </span>
          </div>
          <div style="color: #475569; font-size: 11px; margin-bottom: 4px;">
            📍 <strong>${locLabel}</strong>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            🤖 AI: <strong>${c.aiVerificationStatus || 'Pending'}</strong> (${confPct}%)
          </div>
          <button id="btn-inspect-${c.complaintId}" style="width: 100%; padding: 6px 10px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer;">
            Inspect Full Grievance Record
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.getElementById(`btn-inspect-${c.complaintId}`);
          if (btn) {
            btn.onclick = () => onSelectComplaint(c);
          }
        }, 50);
      });

      markersGroup.addLayer(marker);
    });

    if (bounds.length > 0 && map) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 13 });
    }
  }, [complaints, filterStatus, filterCategory, onSelectComplaint]);

  return (
    <div className="bg-white rounded-3xl shadow-md border border-slate-200/90 overflow-hidden space-y-4 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Goa GIS Civic Issue Map (OpenStreetMap &amp; Leaflet)
            </h3>
            <p className="text-[11px] text-slate-500">
              Interactive spatial markers for water leaks, potholes, road damage, and public infrastructure
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
              <option value="Pending">Pending (Legacy)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 max-w-[180px]"
            >
              <option value="all">All Civic Categories</option>
              {CIVIC_ISSUE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[450px] rounded-2xl overflow-hidden border border-slate-200">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-slate-200/80 text-[11px] flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-700">Legend:</span>
          <span className="flex items-center gap-1 font-semibold text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Submitted / Review
          </span>
          <span className="flex items-center gap-1 font-semibold text-blue-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Assigned / In Progress
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Resolved
          </span>
          <span className="flex items-center gap-1 font-semibold text-rose-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rejected
          </span>
        </div>
      </div>
    </div>
  );
};
