import React from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';

const doctorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hospitalCenterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export const DoctorLocationMap = ({ doctorLat, doctorLng, hospitalLat, hospitalLng, radius, distance, isInside }) => {
  const centerPos = [hospitalLat || 13.0827, hospitalLng || 80.2707];
  const docPos = doctorLat && doctorLng ? [doctorLat, doctorLng] : null;

  return (
    <div className="space-y-2">
      <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-xl relative">
        <MapContainer
          center={centerPos}
          zoom={16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Hospital Center Marker */}
          <Marker position={centerPos} icon={hospitalCenterIcon}>
            <Popup>
              <div className="text-xs font-bold text-slate-100">Hospital Geofence Center</div>
            </Popup>
          </Marker>

          {/* Geofence Boundary Circle */}
          <Circle
            center={centerPos}
            radius={Number(radius) || 100}
            pathOptions={{
              color: isInside ? '#10B981' : '#EF4444',
              fillColor: isInside ? '#10B981' : '#EF4444',
              fillOpacity: 0.2,
              weight: 2
            }}
          />

          {/* Doctor Marker */}
          {docPos && (
            <Marker position={docPos} icon={doctorIcon}>
              <Popup>
                <div className="text-xs">
                  <div className="font-bold text-slate-100">Your GPS Location</div>
                  <div>Distance: {distance}m</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        <div className="absolute top-3 right-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] shadow-lg flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isInside ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-medium text-slate-200">
            {isInside ? 'Inside Permitted Boundary' : 'Outside Geofence Limit'}
          </span>
        </div>
      </div>
    </div>
  );
};
