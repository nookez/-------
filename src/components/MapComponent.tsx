import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Report } from '../types';

interface Coords {
  lat: number;
  lng: number;
}

interface MapComponentProps {
  reports: Report[];
  height?: string;
  zoom?: number;
  center?: Coords | null;       // ✅ เพิ่ม: ให้ MapPage ควบคุม center
  selectedReport?: Report | null;
  userCoords?: Coords | null;
  onMarkerClick?: (report: Report) => void;
}

const PLACEHOLDER =
  'https://placehold.co/400x300/fff7ed/f97316?text=🐾+ไม่มีรูป&font=noto';

export default function MapComponent({
  reports,
  height = 'h-[500px]',
  zoom = 5,
  center,
  selectedReport,
  userCoords,
  onMarkerClick,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const mapId = useRef(`map-${Math.random().toString(36).slice(2, 11)}`);

  // ─────────────────────────────────────────────
  // INIT MAP
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(mapId.current, {
        zoomControl: true,
      }).setView([13.7563, 100.5018], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────
  // FLY TO CENTER + ZOOM  (province / district filter)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (center) {
      mapRef.current.flyTo([center.lat, center.lng], zoom, {
        animate: true,
        duration: 0.8,
      });
    } else {
      // ไม่มี center = reset → ซูมออกดู Thailand overview
      mapRef.current.flyTo([13.0, 101.5], zoom, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [center, zoom]);

  // ─────────────────────────────────────────────
  // USER LOCATION MARKER
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userCoords) return;

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute h-10 w-10 rounded-full bg-blue-500/20 animate-ping"></div>
          <div class="h-5 w-5 rounded-full border-4 border-white bg-blue-500 shadow-lg"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    userMarkerRef.current = L.marker(
      [userCoords.lat, userCoords.lng],
      { icon: userIcon }
    ).addTo(mapRef.current);

    mapRef.current.setView([userCoords.lat, userCoords.lng], 12, {
      animate: true,
      duration: 0.8,
    });
  }, [userCoords]);

  // ─────────────────────────────────────────────
  // REPORT MARKERS
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    reports.forEach((report) => {
      if (typeof report.lat !== 'number' || typeof report.lng !== 'number') return;

      const imageUrl = report.images?.[0] || PLACEHOLDER;

      const icon = L.divIcon({
        className: 'custom-marker-wrapper',
        html: `
          <div class="group relative cursor-pointer">
            <div class="
              w-14 h-14 rounded-full overflow-hidden
              border-4 border-white shadow-xl
              transition-transform duration-200 hover:scale-110
              ${report.type === 'lost' ? 'ring-4 ring-red-400/30' : 'ring-4 ring-emerald-400/30'}
            ">
              <img
                src="${imageUrl}"
                alt="${report.title}"
                class="w-full h-full object-cover"
                onerror="this.src='${PLACEHOLDER}'"
              />
            </div>
            <div class="
              absolute -bottom-1 left-1/2 -translate-x-1/2
              rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow
              ${report.type === 'lost' ? 'bg-red-500' : 'bg-emerald-500'}
            ">
              ${report.type === 'lost' ? 'หาย' : 'พบ'}
            </div>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 56],
      });

      const marker = L.marker([report.lat, report.lng], { icon });
      marker.addTo(mapRef.current!);

      marker.on('click', () => {
        onMarkerClick?.(report);
        mapRef.current?.flyTo([report.lat, report.lng], 14, { animate: true, duration: 0.8 });
      });

      marker.bindPopup(
        `
          <div class="w-[220px] overflow-hidden rounded-2xl">
            <div class="h-32 overflow-hidden rounded-xl">
              <img src="${imageUrl}" alt="${report.title}" class="w-full h-full object-cover" onerror="this.src='${PLACEHOLDER}'" />
            </div>
            <div class="p-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="rounded-full px-2 py-0.5 text-[10px] font-black text-white ${report.type === 'lost' ? 'bg-red-500' : 'bg-emerald-500'}">
                  ${report.type === 'lost' ? '🐕 สัตว์หาย' : '🐾 พบสัตว์'}
                </span>
                ${report.urgent ? `<span class="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-black">ด่วน</span>` : ''}
              </div>
              <p class="font-black text-slate-800 text-sm line-clamp-1">${report.title}</p>
              <p class="mt-1 text-xs text-slate-500 line-clamp-2">${report.description || '-'}</p>
              <div class="mt-2 text-[11px] text-slate-400">📍 ${report.district || ''} ${report.province || ''}</div>
            </div>
          </div>
        `,
        { maxWidth: 260, className: 'custom-popup' }
      );

      markersRef.current.push(marker);
    });

    // fit bounds เฉพาะตอนไม่มี filter center และไม่มี selectedReport
    if (reports.length > 0 && !selectedReport && !center) {
      const valid = reports.filter(
        (r) => typeof r.lat === 'number' && typeof r.lng === 'number'
      );
      if (valid.length > 1) {
        const bounds = L.latLngBounds(valid.map((r) => [r.lat, r.lng] as [number, number]));
        mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
      }
    }
  }, [reports, onMarkerClick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────
  // SELECTED REPORT
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (
      !mapRef.current ||
      !selectedReport ||
      typeof selectedReport.lat !== 'number' ||
      typeof selectedReport.lng !== 'number'
    ) return;

    mapRef.current.flyTo([selectedReport.lat, selectedReport.lng], 14, {
      animate: true,
      duration: 0.8,
    });
  }, [selectedReport]);

  return (
    <div className={`${height} relative overflow-hidden rounded-2xl`}>
      <div id={mapId.current} className="h-full w-full" />

      <style>{`
        .leaflet-container {
          font-family: inherit;
          z-index: 1;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,.15);
        }
        .custom-popup .leaflet-popup-content { margin: 0; }
        .custom-popup .leaflet-popup-tip { background: white; }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-control-zoom a {
          width: 42px !important;
          height: 42px !important;
          line-height: 42px !important;
          border-radius: 1rem !important;
          border: none !important;
          margin-bottom: 6px;
          background: white !important;
          color: #334155 !important;
          font-weight: bold;
          box-shadow: 0 10px 25px rgba(0,0,0,.12);
        }
        .leaflet-control-attribution { font-size: 10px !important; }
      `}</style>
    </div>
  );
}