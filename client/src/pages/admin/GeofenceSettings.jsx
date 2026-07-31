import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { GeofenceMap } from '../../components/maps/GeofenceMap';
import { useNotification } from '../../context/NotificationContext';
import { MapPin, Save, Sliders, ShieldCheck } from 'lucide-react';

export const GeofenceSettings = () => {
  const [phc, setPhc] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();

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
        const first = res.data.phcs[0];
        setPhc(first);
        setFormData({
          latitude: first.latitude,
          longitude: first.longitude,
          radius: first.radius
        });
      }
    } catch (err) {
      addToast('Error fetching geofence configuration', 'danger');
    } finally {
      setLoading(false);
    }
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
          <p className="text-xs text-slate-400">Set hospital center point and allowed physical radius in meters.</p>
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
