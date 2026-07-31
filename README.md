# Hospital Geofence Attendance Management System

An enterprise-grade full-stack Hospital Geofence Attendance Management System built with **React**, **Tailwind CSS**, **Framer Motion**, **Node.js**, **Express**, **MongoDB** (with built-in seamless mock fallback), **JWT Authentication**, **Leaflet OpenStreetMap**, **Chart.js**, **Multer**, and **PDF report generation**.

---

## Key Features & Role Architecture

### 1. Chief Medical Officer (CMO) Portal
- **Executive Analytics**: Total PHCs, Admins, Doctors, Today's Compliance %, and Monthly Trends.
- **PHC Management**: Create & edit Primary Health Centers with OpenStreetMap latitude, longitude, geofence radius (meters), and admin assignment.
- **Admin Account Management**: Create and assign PHC Administrators.
- **AI Compliance & Governance**: AI insights detecting low compliance doctors and shift optimization recommendations.

### 2. Admin Portal
- **Doctor Registration**: Create doctor accounts with shift start & end timings (e.g. `11:15 AM - 4:15 PM`), qualifications, and profile photos.
- **Interactive OpenStreetMap Geofence Settings**: Drag/click marker on map, auto-detect browser GPS coordinates, set radius slider, and preview circular boundary overlay.
- **Absence Explanation Review Console**: Review doctor absent explanations with uploaded proof images/PDF documents. **Approve** automatically converts status from `ABSENT` to `EXPLANATION_APPROVED` (Present).
- **PDF Attendance Reports**: Download formatted official PDF reports.

### 3. Doctor Portal
- **Dynamic Shift Checkpoint Engine**: Automatically splits doctor's duty shift (e.g. `11:15 AM - 4:15 PM`) into 5-minute attendance windows every hour.
- **Live 1-Second Countdown Timer**: Displays real-time countdown to next window opening or seconds remaining in active window.
- **Geofence Check & Haversine Distance Verification**: HTML5 Geolocation API compares doctor's location against PHC coordinates. Marks `PRESENT` if within radius, or displays rejection with exact distance feedback if outside.
- **Absence Explanation Submission**: Submit reason + upload proof for missed windows.

---

## Quick Start Guide

### Prerequisites
- Node.js (v16+) and npm installed.

### 1. Start Backend API Server
```bash
cd server
npm install
npm start
```
*Backend server runs on `http://localhost:5000`*

### 2. Start React Frontend Application
```bash
cd client
npm install
npm run dev
```
*Frontend app runs on `http://localhost:3000`*

---

## Pre-Seeded Demo Login Credentials

| Role | Username | Email | Password |
| :--- | :--- | :--- | :--- |
| **CMO** | `cmo` | `cmo@hospital.gov.in` | `password123` |
| **Admin** | `admin` | `admin.central@hospital.gov.in` | `password123` |
| **Doctor** | `doctor` | `doctor@hospital.gov.in` | `password123` |

---

## Business Logic - Dynamic Shift Checkpoint Windows

Attendance windows open automatically every hour during duty shift for 5 minutes:
- Shift `11:15 AM – 4:15 PM` -> Windows: `11:15-11:20`, `12:15-12:20`, `1:15-1:20`, `2:15-2:20`, `3:15-3:20`, `4:15-4:20`.
- Shift `12:00 PM – 6:00 PM` -> Windows: `12:00-12:05`, `1:00-1:05`, `2:00-2:05`, `3:00-3:05`, `4:00-4:05`, `5:00-5:05`, `6:00-6:05`.
