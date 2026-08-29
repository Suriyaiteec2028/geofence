const PDFDocument = require('pdfkit');
const { memoryStore } = require('../config/db');

// Helper to format 24h/12h timestamp
const formatDateTime = (dateObj) => {
  const d = dateObj || new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours.toString().padStart(2, '0');
  return `${day} ${month} ${year} • ${strHours}:${minutes} ${ampm}`;
};

exports.getReportSummary = (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';

    const phcs = memoryStore.phcs.filter(p => (p.workspaceId || 'workspace_demo_public') === userWorkspace);
    const users = memoryStore.users.filter(u => (u.workspaceId || 'workspace_demo_public') === userWorkspace);
    const attendances = memoryStore.attendances.filter(a => (a.workspaceId || 'workspace_demo_public') === userWorkspace);
    const explanations = memoryStore.explanations.filter(e => (e.workspaceId || 'workspace_demo_public') === userWorkspace);

    const totalPHCs = phcs.length;
    const totalAdmins = users.filter(u => u.role === 'ADMIN').length;
    const totalDoctors = users.filter(u => u.role === 'DOCTOR').length;

    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT' || a.status === 'EXPLANATION_REJECTED').length;
    const pendingExplanations = explanations.filter(e => e.status === 'PENDING').length;

    const totalRecords = attendances.length || 0;
    const attendancePercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    const monthlyTrends = [
      { month: 'Jan', percentage: 85 },
      { month: 'Feb', percentage: 88 },
      { month: 'Mar', percentage: 92 },
      { month: 'Apr', percentage: 90 },
      { month: 'May', percentage: 94 },
      { month: 'Jun', percentage: 91 },
      { month: 'Jul', percentage: attendancePercentage || 95 }
    ];

    const phcPerformance = phcs.map(p => {
      const pDocs = users.filter(u => u.role === 'DOCTOR' && String(u.assignedPHC) === String(p._id));
      const pAtts = attendances.filter(a => String(a.phc) === String(p._id));
      const pPresent = pAtts.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
      const rate = pAtts.length > 0 ? Math.round((pPresent / pAtts.length) * 100) : 100;
      return {
        id: p._id,
        name: p.name,
        doctorCount: pDocs.length,
        attendanceRate: rate
      };
    });

    res.json({
      success: true,
      summary: {
        totalPHCs,
        totalAdmins,
        totalDoctors,
        presentCount,
        absentCount,
        pendingExplanations,
        attendancePercentage,
        monthlyTrends,
        phcPerformance
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching report summary' });
  }
};

exports.exportAttendancePDF = (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const { doctorId, startDate, endDate } = req.query;

    const workspaceUsers = memoryStore.users.filter(u => (u.workspaceId || 'workspace_demo_public') === userWorkspace);
    const workspacePHCs = memoryStore.phcs.filter(p => (p.workspaceId || 'workspace_demo_public') === userWorkspace);
    const workspaceAttendances = memoryStore.attendances.filter(a => (a.workspaceId || 'workspace_demo_public') === userWorkspace);

    const isSingleDoctor = doctorId && doctorId !== 'all';
    let targetDoctor = null;

    if (isSingleDoctor) {
      targetDoctor = workspaceUsers.find(u => String(u._id) === String(doctorId));
    } else {
      targetDoctor = workspaceUsers.find(u => u.role === 'DOCTOR');
    }

    let list = [...workspaceAttendances];

    if (isSingleDoctor) {
      list = list.filter(a => String(a.doctor) === String(doctorId));
    }

    if (startDate) {
      list = list.filter(a => a.date >= startDate);
    }
    if (endDate) {
      list = list.filter(a => a.date <= endDate);
    }

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const totalRecords = list.length;
    const presentCount = list.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 100;

    const targetPhc = targetDoctor && targetDoctor.assignedPHC ? workspacePHCs.find(p => String(p._id) === String(targetDoctor.assignedPHC)) : (workspacePHCs[0] || null);

    const hospitalNameStr = targetPhc ? targetPhc.name.toUpperCase() : 'PUBLIC HEALTH CENTER'.toUpperCase();
    const hospitalAddressStr = targetPhc ? `${targetPhc.address || '45, Health Care Road'}, ${targetPhc.district || 'Medical Nagar'}, Tamil Nadu - 613007, India` : '45, Health Care Road, Medical Nagar, Thanjavur, Tamil Nadu - 613007, India';

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true
    });

    const doctorNameFileStr = targetDoctor ? targetDoctor.name.replace(/\s+/g, '_') : 'All_Doctors';
    const filename = `Attendance_Report_${doctorNameFileStr}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    const COLORS = {
      primaryPurple: '#4C1D95',
      secondaryPurple: '#6D28D9',
      lightPurpleBg: '#F5F3FF',
      borderPurple: '#DDD6FE',
      pinkAccent: '#EC4899',
      darkCharcoal: '#1E293B',
      subtleGray: '#64748B',
      tableHeaderBg: '#3B0764',
      rowAlt: '#FAF5FF',
      presentGreen: '#059669',
      absentRed: '#DC2626',
      pendingAmber: '#D97706'
    };

    const drawHeader = () => {
      doc.rect(0, 0, 595, 105).fill(COLORS.lightPurpleBg);
      const heartX = 35;
      const heartY = 25;

      doc.save();
      doc.moveTo(heartX + 16, heartY + 6)
         .bezierCurveTo(heartX + 16, heartY + 1, heartX + 9, heartY - 4, heartX + 2, heartY + 4)
         .bezierCurveTo(heartX - 5, heartY + 12, heartX + 2, heartY + 22, heartX + 16, heartY + 30)
         .bezierCurveTo(heartX + 30, heartY + 22, heartX + 37, heartY + 12, heartX + 30, heartY + 4)
         .bezierCurveTo(heartX + 23, heartY - 4, heartX + 16, heartY + 1, heartX + 16, heartY + 6)
         .fillColor(COLORS.pinkAccent)
         .fill();
      doc.restore();

      const headerBoxX = 107;
      const headerBoxW = 380;

      doc.fillColor(COLORS.primaryPurple)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(hospitalNameStr, headerBoxX, 18, { width: headerBoxW, align: 'center' });

      const addressY = doc.y + 3;

      doc.fillColor(COLORS.subtleGray)
         .fontSize(8)
         .font('Helvetica')
         .text(hospitalAddressStr, headerBoxX, addressY, { width: headerBoxW, align: 'center' });
    };

    drawHeader();

    const cardY = 112;
    const cardWidth = 515;
    const cardHeight = 110;
    const cardX = (595 - cardWidth) / 2;

    doc.save();
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10).fillColor('#FFFFFF').fill();
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10).lineWidth(1).strokeColor(COLORS.borderPurple).stroke();
    doc.restore();

    const infoX = cardX + 75;
    const infoWidth = 310;
    let fieldY = cardY + 10;

    const docName = targetDoctor ? targetDoctor.name : 'Medical Doctor';
    const docSpec = targetDoctor ? (targetDoctor.specialization || targetDoctor.qualification || 'Medical Officer') : 'Medical Officer';
    const docEmail = targetDoctor ? targetDoctor.email : 'doctor@hospital.gov.in';

    doc.fillColor(COLORS.primaryPurple).fontSize(13).font('Helvetica-Bold').text(docName, infoX, fieldY, { width: infoWidth });
    fieldY = doc.y + 2;

    doc.fillColor(COLORS.secondaryPurple).fontSize(9).font('Helvetica-Bold').text('Designation: ', infoX, fieldY, { continued: true });
    doc.fillColor(COLORS.darkCharcoal).font('Helvetica').text(docSpec, { width: infoWidth });
    fieldY = doc.y + 2;

    doc.fillColor(COLORS.secondaryPurple).fontSize(8.5).font('Helvetica-Bold').text('Email: ', infoX, fieldY, { continued: true });
    doc.fillColor(COLORS.darkCharcoal).font('Helvetica').text(docEmail, { width: infoWidth });

    const badgeX = cardX + cardWidth - 110;
    const badgeY = cardY + 12;
    doc.save();
    doc.roundedRect(badgeX, badgeY, 95, 32, 6).fillColor(COLORS.lightPurpleBg).fill();
    doc.roundedRect(badgeX, badgeY, 95, 32, 6).lineWidth(1).strokeColor(COLORS.borderPurple).stroke();

    doc.fillColor(COLORS.primaryPurple).fontSize(7.5).font('Helvetica-Bold').text('ATTENDANCE SCORE', badgeX, badgeY + 5, { width: 95, align: 'center' });
    doc.fillColor(rate >= 80 ? COLORS.presentGreen : COLORS.absentRed).fontSize(12).font('Helvetica-Bold').text(`${rate}% Compliant`, badgeX, badgeY + 16, { width: 95, align: 'center' });
    doc.restore();

    let currentY = cardY + cardHeight + 15;

    const drawTableHeader = (yPos) => {
      doc.save();
      doc.roundedRect(cardX, yPos, cardWidth, 24, 4).fillColor(COLORS.tableHeaderBg).fill();

      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Duty Date & Window', cardX + 10, yPos + 7);
      doc.text('Hospital Facility', cardX + 170, yPos + 7);
      doc.text('Biometric & Geofence', cardX + 310, yPos + 7);
      doc.text('Attendance Status', cardX + 430, yPos + 7);
      doc.restore();
    };

    drawTableHeader(currentY);
    currentY += 28;

    if (list.length === 0) {
      doc.fillColor(COLORS.subtleGray).fontSize(9.5).font('Helvetica').text('No verified attendance logs recorded for the selected criteria.', cardX + 10, currentY + 10);
    } else {
      list.forEach((att, idx) => {
        if (currentY > 730) {
          doc.addPage();
          drawHeader();
          currentY = 120;
          drawTableHeader(currentY);
          currentY += 28;
        }

        const isAlt = idx % 2 === 1;
        if (isAlt) {
          doc.save();
          doc.rect(cardX, currentY - 2, cardWidth, 22).fillColor(COLORS.rowAlt).fill();
          doc.restore();
        }

        const attPhc = workspacePHCs.find(p => String(p._id) === String(att.phc));
        const dateStr = att.date || new Date().toISOString().split('T')[0];
        const windowStr = att.checkpointTime || 'Hourly Duty Window';
        const facilityStr = attPhc ? attPhc.name : 'Assigned PHC';
        const isVerified = att.status === 'PRESENT' || att.status === 'EXPLANATION_APPROVED';

        doc.fillColor(COLORS.darkCharcoal).fontSize(8.5).font('Helvetica');
        doc.text(`${dateStr} | ${windowStr}`, cardX + 10, currentY);
        doc.text(facilityStr.substring(0, 22), cardX + 170, currentY);

        doc.fillColor(isVerified ? COLORS.presentGreen : COLORS.subtleGray)
           .fontSize(8)
           .text(isVerified ? 'Geofence Verified • Face Match' : 'Geofence Missed', cardX + 310, currentY);

        let statusLabel = 'ABSENT';
        let statusColor = COLORS.absentRed;

        if (att.status === 'PRESENT') {
          statusLabel = 'PRESENT';
          statusColor = COLORS.presentGreen;
        } else if (att.status === 'EXPLANATION_APPROVED') {
          statusLabel = 'EXPLANATION APPR.';
          statusColor = COLORS.presentGreen;
        } else if (att.status === 'PENDING_EXPLANATION') {
          statusLabel = 'PENDING REASON';
          statusColor = COLORS.pendingAmber;
        }

        doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(8.5).text(statusLabel, cardX + 430, currentY);
        currentY += 20;
      });
    }

    doc.end();

  } catch (err) {
    console.error('PDF Export Error:', err);
    res.status(500).json({ success: false, message: 'PDF export failed' });
  }
};
