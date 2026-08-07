const PDFDocument = require('pdfkit');
const { memoryStore } = require('../config/db');

exports.getReportSummary = (req, res) => {
  try {
    const totalPHCs = memoryStore.phcs.length;
    const totalAdmins = memoryStore.users.filter(u => u.role === 'ADMIN').length;
    const totalDoctors = memoryStore.users.filter(u => u.role === 'DOCTOR').length;

    const attendances = memoryStore.attendances;
    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT' || a.status === 'EXPLANATION_REJECTED').length;
    const pendingExplanations = memoryStore.explanations.filter(e => e.status === 'PENDING').length;

    const totalRecords = attendances.length || 0;
    const attendancePercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    // Monthly attendance breakdown for chart
    const monthlyTrends = [
      { month: 'Jan', percentage: 0 },
      { month: 'Feb', percentage: 0 },
      { month: 'Mar', percentage: 0 },
      { month: 'Apr', percentage: 0 },
      { month: 'May', percentage: 0 },
      { month: 'Jun', percentage: 0 },
      { month: 'Jul', percentage: attendancePercentage }
    ];

    // PHC performance breakdown
    const phcPerformance = memoryStore.phcs.map(p => {
      const pDocs = memoryStore.users.filter(u => u.role === 'DOCTOR' && String(u.assignedPHC) === String(p._id));
      const pAtts = memoryStore.attendances.filter(a => String(a.phc) === String(p._id));
      const pPresent = pAtts.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
      const rate = pAtts.length > 0 ? Math.round((pPresent / pAtts.length) * 100) : 0;
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
    const { doctorId, startDate, endDate } = req.query;

    let targetDoctor = null;
    if (doctorId && doctorId !== 'all') {
      targetDoctor = memoryStore.users.find(u => String(u._id) === String(doctorId));
    }

    let list = [...memoryStore.attendances];

    // Filter by doctor
    if (targetDoctor) {
      list = list.filter(a => String(a.doctor) === String(targetDoctor._id));
    }

    // Filter by date range
    if (startDate) {
      list = list.filter(a => a.date >= startDate);
    }
    if (endDate) {
      list = list.filter(a => a.date <= endDate);
    }

    // Calculate totals for report summary header
    const totalRecords = list.length;
    const presentCount = list.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const absentCount = list.filter(a => a.status === 'ABSENT' || a.status === 'EXPLANATION_REJECTED').length;
    const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 100;

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let filename = `Attendance_Report_${targetDoctor ? targetDoctor.name.replace(/\s+/g, '_') : 'All_Doctors'}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title Header Band
    doc.fillColor('#0F172A').rect(0, 0, 595, 80).fill();
    doc.fillColor('#38BDF8').fontSize(18).font('Helvetica-Bold').text('GOVT. PUBLIC HEALTH SERVICES GEOFENCE PORTAL', 40, 20);
    doc.fillColor('#F8FAFC').fontSize(11).font('Helvetica').text('Official Duty Attendance Performance Audit Report', 40, 48);

    doc.moveDown(3);

    // Summary Info Box
    const boxY = doc.y;
    doc.fillColor('#F1F5F9').rect(40, boxY, 515, 60).fill();
    doc.strokeColor('#CBD5E1').rect(40, boxY, 515, 60).stroke();

    doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold')
       .text(`Target Doctor: ${targetDoctor ? targetDoctor.name + ' (' + (targetDoctor.specialization || 'Medical Officer') + ')' : 'All Hospital Medical Officers'}`, 50, boxY + 10)
       .text(`Date Range: ${startDate || 'All Days'} to ${endDate || 'Present'}`, 50, boxY + 26)
       .text(`Total Checkpoints: ${totalRecords}   |   Verified Present: ${presentCount}   |   Absent: ${absentCount}   |   Compliance Score: ${rate}%`, 50, boxY + 42);

    doc.moveDown(4.5);

    // Table Header Band
    const tableHeaderY = doc.y;
    doc.fillColor('#1E293B').rect(40, tableHeaderY, 515, 22).fill();
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
       .text('Doctor Name', 45, tableHeaderY + 6)
       .text('Hospital (PHC)', 175, tableHeaderY + 6)
       .text('Duty Date', 310, tableHeaderY + 6)
       .text('Checkpoint Window', 390, tableHeaderY + 6)
       .text('Status', 490, tableHeaderY + 6);

    doc.moveDown(1.2);

    // Table Rows
    if (list.length === 0) {
      doc.fillColor('#64748B').fontSize(10).font('Helvetica').text('No attendance logs found for the selected criteria.', 45, doc.y + 10);
    } else {
      list.forEach((a, idx) => {
        // Page overflow protection
        if (doc.y > 750) {
          doc.addPage();
          // Re-draw table header on new page
          const newHeaderY = 40;
          doc.fillColor('#1E293B').rect(40, newHeaderY, 515, 22).fill();
          doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
             .text('Doctor Name', 45, newHeaderY + 6)
             .text('Hospital (PHC)', 175, newHeaderY + 6)
             .text('Duty Date', 310, newHeaderY + 6)
             .text('Checkpoint Window', 390, newHeaderY + 6)
             .text('Status', 490, newHeaderY + 6);
          doc.y = newHeaderY + 28;
        }

        const docUser = memoryStore.users.find(u => String(u._id) === String(a.doctor));
        const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));

        const y = doc.y;
        if (idx % 2 === 0) {
          doc.fillColor('#F8FAFC').rect(40, y - 2, 515, 20).fill();
        }

        doc.fillColor('#334155').fontSize(9).font('Helvetica')
          .text(docUser ? docUser.name.substring(0, 20) : 'Dr. Unknown', 45, y)
          .text(phc ? phc.name.substring(0, 20) : 'Assigned PHC', 175, y)
          .text(a.date || 'N/A', 310, y)
          .text(a.checkpointTime || a.windowLabel || '09:00 AM', 390, y);

        if (a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED') {
          doc.fillColor('#16A34A').font('Helvetica-Bold').text(a.status === 'EXPLANATION_APPROVED' ? 'APPROVED' : 'PRESENT', 490, y);
        } else if (a.status === 'PENDING_EXPLANATION') {
          doc.fillColor('#D97706').font('Helvetica-Bold').text('PENDING', 490, y);
        } else {
          doc.fillColor('#DC2626').font('Helvetica-Bold').text('ABSENT', 490, y);
        }

        doc.moveDown(0.85);
      });
    }

    doc.moveDown(2);
    doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('--- Department of Public Health Services • Confidential Governance Document ---', { align: 'center' });

    doc.end();

  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ success: false, message: 'PDF export failed' });
  }
};
