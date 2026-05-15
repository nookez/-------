import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Report } from '../types';

interface MapComponentProps {
  reports: Report[];
  height?: string;
  zoom?: number;
  onMarkerClick?: (report: Report) => void;
}

export default function MapComponent({
  reports,
  height = 'h-[500px]',
  zoom = 5,
  onMarkerClick,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Initialize map with Thailand center
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([13.7563, 100.5018], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    } else {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers with images
    reports.forEach((report) => {
      if (!report.lat || !report.lng) return;

      // Create custom icon with image
      const html = document.createElement('div');
      html.innerHTML = `
        <div class="relative group cursor-pointer">
          <div class="absolute -top-12 -left-8 w-16 h-16 rounded-lg overflow-hidden shadow-lg border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
            <img src="${report.images[0]}" alt="${report.title}" class="w-full h-full object-cover" />
          </div>
          <div class="w-12 h-12 rounded-full overflow-hidden border-3 border-white shadow-lg transform transition-transform hover:scale-110">
            <img src="${report.images[0]}" alt="${report.title}" class="w-full h-full object-cover" />
          </div>
          <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold" style="background: ${
            report.type === 'lost' ? '#ef4444' : '#22c55e'
          }; color: white;">
            ${report.type === 'lost' ? '•' : '✓'}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: html.innerHTML,
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -48],
        className: 'map-marker',
      });

      const marker = L.marker([report.lat, report.lng], { icon })
        .addTo(mapRef.current!)
        .on('click', () => {
          onMarkerClick?.(report);
          mapRef.current?.setView([report.lat, report.lng], 12, {
            animate: true,
            duration: 0.6,
          });
        });

      // Add popup
      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <div class="rounded-lg overflow-hidden mb-2 h-32">
            <img src="${report.images[0]}" alt="${report.title}" class="w-full h-full object-cover" />
          </div>
          <p class="text-xs font-bold text-orange-600 uppercase">${report.category}</p>
          <p class="font-semibold text-sm text-slate-900 mt-1">${report.title}</p>
          <p class="text-xs text-slate-600 mt-2">${report.address}</p>
          <div class="flex gap-2 mt-3">
            <span class="text-xs font-bold px-2 py-1 rounded-full ${
              report.type === 'lost'
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }">
              ${report.type === 'lost' ? 'ของหาย' : 'ของพบ'}
            </span>
            ${
              report.urgent
                ? '<span class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">ด่วน</span>'
                : ''
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 250,
        className: 'map-popup',
      });

      markersRef.current.push(marker);
    });

    // Auto fit bounds if multiple markers
    if (reports.length > 0 && zoom === 5) {
      const bounds = L.latLngBounds(
        reports
          .filter((r) => r.lat && r.lng)
          .map((r) => [r.lat, r.lng] as [number, number])
      );

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }
  }, [reports, onMarkerClick]);

  return (
    <div className={`${height} relative`}>
      <div id="map" className="w-full h-full rounded-2xl" />

      <style>{`
        #map {
          border-radius: 1rem;
        }

        .map-marker {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }

        .leaflet-popup-content-wrapper {
          background-color: white;
          border-radius: 1rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          border: 2px solid #f3f4f6;
        }

        .leaflet-popup-tip {
          background-color: white;
          border: 2px solid #f3f4f6;
          border-radius: 50%;
        }

        .leaflet-control-zoom-in,
        .leaflet-control-zoom-out {
          background-color: white !important;
          border-radius: 0.75rem;
          color: #334155;
          font-weight: bold;
          font-size: 18px;
          width: 40px !important;
          height: 40px !important;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0 !important;
        }

        .leaflet-control-zoom-in:hover,
        .leaflet-control-zoom-out:hover {
          background-color: #f1f5f9 !important;
        }

        .leaflet-control-zoom {
          border: none;
          box-shadow: none;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}