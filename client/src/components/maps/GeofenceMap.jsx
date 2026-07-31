import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Compass } from 'lucide-react';

// Custom Map Marker Icon
const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map click events
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? (
    <Marker
      position={position}
      icon={hospitalIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setPosition([pos.lat, pos.lng]);
        },
      }}
    />
  ) : null;
}

// Controller to dynamically pan map when position changes
function MapRecenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && position[0] && position[1]) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

export const GeofenceMap = ({ latitude, longitude, radius, onLocationChange }) => {
  const [position, setPosition] = useState([latitude || 13.0827, longitude || 80.2707]);

  useEffect(() => {
    if (latitude && longitude) {
      setPosition([Number(latitude), Number(longitude)]);
    }
  }, [latitude, longitude]);

  const handleSetPosition = (newPos) => {
    setPosition(newPos);
    if (onLocationChange) {
      onLocationChange({ latitude: newPos[0], longitude: newPos[1] });
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = [pos.coords.latitude, pos.coords.longitude];
          handleSetPosition(newPos);
        },
        (err) => {
          alert('Could not fetch GPS location: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-blue-400" /> Interactive OpenStreetMap Geofence Picker
        </label>
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-medium flex items-center gap-1.5 transition-all shadow-glow-blue"
        >
          <Navigation className="w-3.5 h-3.5" /> Fetch My GPS Location
        </button>
      </div>

      <div className="h-80 w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl relative">
        <MapContainer
          center={position}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={handleSetPosition} />
          {position && position[0] && (
            <Circle
              center={position}
              radius={Number(radius) || 100}
              pathOptions={{
                color: '#3B82F6',
                fillColor: '#3B82F6',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '5, 5'
              }}
            />
          )}
          <MapRecenter position={position} />
        </MapContainer>

        <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 shadow-xl flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>
            Lat: <strong className="text-white">{position[0].toFixed(5)}</strong> | Lng: <strong className="text-white">{position[1].toFixed(5)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
