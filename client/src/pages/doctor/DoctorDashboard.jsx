import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { DoctorLocationMap } from '../../components/maps/DoctorLocationMap';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Navigation, ShieldCheck, Calendar, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const padH = h < 10 ? `0${h}` : `${h}`;
  const padM = m < 10 ? `0${m}` : `${m}`;
  return `${padH}:${padM} ${period}`;
};

export const DoctorDashboard = () => {
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [marking, setMarking] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [countdownText, setCountdownText] = useState('00:00:00');

  const { addToast } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    fetchShiftStatus();
    const interval = setInterval(fetchShiftStatus, 10000); // Poll shift status
    return () => clearInterval(interval);
  }, []);

  // Live 1-second countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (!shiftData?.shiftState) return;

      const state = shiftData.shiftState;
      if (state.isWindowOpen && state.secondsRemainingInActiveWindow !== null) {
        state.secondsRemainingInActiveWindow = Math.max(0, state.secondsRemainingInActiveWindow - 1);
        setCountdownText(formatSeconds(state.secondsRemainingInActiveWindow));
      } else if (state.secondsToNextWindow !== null) {
        state.secondsToNextWindow = Math.max(0, state.secondsToNextWindow - 1);
        setCountdownText(formatSeconds(state.secondsToNextWindow));
      } else {
        setCountdownText('Shift Ended');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [shiftData]);

  const formatSeconds = (secs) => {
    if (!secs || secs < 0) return '00:00:00';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => (n < 10 ? `0${n}` : n);
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(s)}` : `${pad(mins)}:${pad(s)}`;
  };

  const fetchShiftStatus = async () => {
    try {
      setErrorMsg(null);
      const res = await axios.get('/api/attendance/shift-status');
      if (res.data.success) {
        setShiftData(res.data);
      }
    } catch (err) {
      console.error('Error fetching shift status:', err);
      setErrorMsg(err.response?.data?.message || 'Unable to connect to attendance server.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchGPS = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser', 'danger');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setGpsLocation(coords);
        addToast('GPS location updated accurately!', 'info');
      },
      (err) => {
        addToast(`GPS Error: ${err.message}`, 'warning');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleMarkAttendance = async () => {
    if (!navigator.geolocation) {
      addToast('Geolocation capability required.', 'danger');
      return;
    }

    setMarking(true);
    addToast('Acquiring high-precision GPS coordinates...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setGpsLocation({ latitude, longitude });

        try {
          const res = await axios.post('/api/attendance/mark', { latitude, longitude });
          if (res.data.success) {
            addToast(res.data.message, 'success', 'Attendance Marked!');
            setDistanceInfo({
              distance: res.data.attendance.distanceMeters,
              isInside: true
            });
            fetchShiftStatus();
          }
        } catch (err) {
          const errData = err.response?.data;
          addToast(errData?.message || 'Attendance mark failed', 'danger', 'Rejection Alert');
          if (errData?.distanceMeters !== undefined) {
            setDistanceInfo({
              distance: errData.distanceMeters,
              isInside: false
            });
          }
        } finally {
          setMarking(false);
        }
      },
      (err) => {
        setMarking(false);
        addToast(`GPS location failed: ${err.message}`, 'danger');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) return <LoadingSkeleton type="card" count={3} />;

  if (errorMsg) {
    return (
      <div className="space-y-6">
        <Breadcrumb />
        <div className="p-8 rounded-3xl bg-rose-950/30 border border-rose-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Shift Status Notice</h3>
            <p className="text-xs text-rose-300/80 mt-1">{errorMsg}</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchShiftStatus(); }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>
        </div>
      </div>
    );
  }

  const doctor = shiftData?.doctor;
  const phc = shiftData?.phc;
  const shiftState = shiftData?.shiftState;
  const isWindowOpen = shiftState?.isWindowOpen;
  const activeWin = shiftState?.activeWindow;
  const nextWin = shiftState?.nextWindow;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header Info */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Duty Officer Attendance Portal
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{doctor?.name}</h2>
          <p className="text-xs text-slate-400">
            Assigned Hospital: <strong className="text-slate-200">{phc?.name}</strong> | Shift: {formatTime12h(doctor?.shiftStart)} – {formatTime12h(doctor?.shiftEnd)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/doctor/explanation')}
            className="px-3.5 py-2 rounded-xl bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5"
          >
            Submit Absence Explanation
          </button>
        </div>
      </div>

      {/* Main Checkpoint Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div>
              <span className="text-[11px] font-extrabold text-blue-400 uppercase tracking-wider">Current Checkpoint Window</span>
              <h3 className="text-lg font-extrabold text-white mt-0.5">
                {isWindowOpen ? activeWin?.windowLabel : 'Window Currently Closed'}
              </h3>
            </div>

            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
              isWindowOpen
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {isWindowOpen ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {isWindowOpen ? 'ATTENDANCE WINDOW OPEN' : 'ATTENDANCE CLOSED'}
            </div>
          </div>

          {/* Countdown & Timer */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block">
                {isWindowOpen ? 'Time remaining in open window:' : 'Next Checkpoint Window Opens In:'}
              </span>
              <div className="text-2xl font-mono font-extrabold text-blue-400 mt-1">
                {countdownText}
              </div>
            </div>

            {nextWin && !isWindowOpen && (
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Next Checkpoint</span>
                <span className="text-xs font-bold text-slate-200">{nextWin.windowLabel}</span>
              </div>
            )}
          </div>

          {/* Mark Attendance Action Button */}
          <div className="space-y-3">
            <button
              onClick={handleMarkAttendance}
              disabled={!isWindowOpen || marking}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-2xl ${
                isWindowOpen
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Navigation className="w-5 h-5" />
              {marking ? 'Verifying Geofence & Marking...' : isWindowOpen ? 'MARK ATTENDANCE NOW' : 'Attendance Window Closed'}
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Requires physical presence within hospital radius ({phc?.radius || 150}m) during scheduled 5-minute checkpoint window.
            </p>
          </div>
        </div>

        {/* Real-time Map & Distance Panel */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" /> Geofence Distance Monitor
            </h3>
            <button
              onClick={handleFetchGPS}
              className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
            >
              Test GPS
            </button>
          </div>

          <DoctorLocationMap
            doctorLat={gpsLocation?.latitude}
            doctorLng={gpsLocation?.longitude}
            hospitalLat={phc?.latitude}
            hospitalLng={phc?.longitude}
            radius={phc?.radius}
            distance={distanceInfo?.distance || 0}
            isInside={distanceInfo?.isInside || false}
          />

          {distanceInfo && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              distanceInfo.isInside ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              Distance: {distanceInfo.distance}m from hospital center. Allowed: {phc?.radius}m.
            </div>
          )}
        </div>
      </div>

      {/* Today's Checkpoint Schedule */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" /> Shift Checkpoint Schedule (Every 60 Minutes)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {shiftState?.windows?.map((w) => {
            const att = shiftData?.todayAttendances?.find((a) => a.checkpointTime === w.windowStartFormatted);
            return (
              <div
                key={w.checkpointIndex}
                className={`p-3 rounded-2xl border text-xs space-y-1 ${
                  att?.status === 'PRESENT'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : att?.status === 'PENDING_EXPLANATION'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400">Checkpoint #{w.checkpointIndex}</div>
                <div className="font-bold text-white">{w.windowLabel}</div>
                <div className="text-[10px] font-semibold">
                  Status: {att ? att.status : 'Pending Window'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
