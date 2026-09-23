import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { GeofenceMap } from '../../components/maps/GeofenceMap';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Save, Sliders, ShieldCheck, Navigation, Loader } from 'lucide-react';

export const GeofenceSettings = () => {
  const [phc, setPhc] = useState(null);
  const [allPhcs, setAllPhcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const { addToast } = useNotification();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    latitude: 13.0827,
    longitude: 80.2707,
    radius: 150
  });

  useEffect(() => {
    fetchPHC();
  }, []);

  const fetchPHC = async () => {
    try {
      const res = await axios.get('/api/phcs');
      if (res.data.success && res.data.phcs.length > 0) {
        setAllPhcs(res.data.phcs);

        // Find the PHC assigned to this admin, not just the first one
        let adminPhc = null;
        if (user && user.assignedPHC) {
          adminPhc = res.data.phcs.find(p => p._id === user.assignedPHC);
        }
        // Fallback to first if no assigned PHC found
        const selected = adminPhc || res.data.phcs[0];
        setPhc(selected);
        setFormData({
          latitude: selected.latitude,
          longitude: selected.longitude,
          radius: selected.radius
        });
      }
    } catch (err) {
      addToast('Error fetching geofence configuration', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // ── Use My Current GPS Location as PHC Center ──────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by this browser.', 'danger');
      return;
    }
    setFetchingLocation(true);
    addToast('Detecting your current GPS location...', 'info', 'GPS Locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setFetchingLocation(false);
        addToast(
          `Location captured! Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (±${Math.round(accuracy)}m accuracy). Click "Save Geofence Parameters" to apply.`,
          'success',
          '📍 Location Set'
        );
      },
      (error) => {
        setFetchingLocation(false);
        const messages = {
          1: 'Location permission denied. Please allow location access in browser settings.',
          2: 'GPS signal unavailable. Please try again outdoors or enable device GPS.',
          3: 'Location request timed out. Please try again.'
        };
        addToast(messages[error.code] || 'Failed to get location.', 'danger', 'GPS Error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!phc) return;
    try {
      const res = await axios.put(`/api/phcs/${phc._id}`, formData);
      if (res.data.success) {
        addToast('Hospital Geofence parameters saved successfully!', 'success');
        setPhc(res.data.phc);
      }
    } catch (err) {
      addToast('Failed to save geofence settings', 'danger');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Geofence Boundary Configuration</h2>
          <p className="text-xs text-slate-400">
            Set hospital center point and allowed physical radius in meters.
            {phc && <span className="ml-1 text-blue-400 font-medium">Configuring: {phc.name}</span>}
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-blue transition-all"
        >
          <Save className="w-4 h-4" /> Save Geofence Parameters
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
          <GeofenceMap
            latitude={formData.latitude}
            longitude={formData.longitude}
            radius={formData.radius}
            onLocationChange={({ latitude, longitude }) => {
              setFormData((prev) => ({ ...prev, latitude, longitude }));
            }}
          />
        </div>

        <div className="lg:col-span-4 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-5">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <Sliders className="w-4 h-4" /> Parameters Panel
          </div>

          <div className="space-y-4">

            {/* ── Use My Current Location button ── */}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={fetchingLocation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fetchingLocation
                ? <><Loader className="w-4 h-4 animate-spin" /> Detecting GPS...</>
                : <><Navigation className="w-4 h-4" /> 📍 Use My Current Location as PHC Center</>}
            </button>
            <p className="text-[11px] text-slate-500 -mt-2">
              Stand at the hospital entrance and click above to pin the exact GPS coordinates.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Center Latitude</label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Center Longitude</label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Permitted Radius (Meters)</label>
                <span className="text-xs font-mono text-blue-400 font-bold">{formData.radius}m</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={formData.radius}
                onChange={(e) => setFormData({ ...formData, radius: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>50 meters</span>
                <span>250m</span>
                <span>500 meters</span>
              </div>
            </div>

            {/* Current coordinates display */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/40 text-[11px] font-mono text-slate-300 space-y-1">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Current PHC Coordinates</div>
              <div>Lat: <span className="text-emerald-400">{formData.latitude.toFixed ? formData.latitude.toFixed(6) : formData.latitude}</span></div>
              <div>Lng: <span className="text-emerald-400">{formData.longitude.toFixed ? formData.longitude.toFixed(6) : formData.longitude}</span></div>
              <div>Radius: <span className="text-blue-400">{formData.radius}m</span></div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-blue-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Geofence Rule Engine
              </div>
              <p className="text-[11px] text-slate-400">
                Doctors attempting to check-in outside this radius will be rejected automatically with Haversine distance feedback.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
