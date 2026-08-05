const { memoryStore } = require('../config/db');

exports.getAIAnalytics = (req, res) => {
  try {
    const doctors = memoryStore.users.filter(u => u.role === 'DOCTOR');
    const phcs = memoryStore.phcs;
    const attendances = memoryStore.attendances;

    // AI Insight 1: Doctor compliance
    const doctorStats = doctors.map(d => {
      const docAtts = attendances.filter(a => String(a.doctor) === String(d._id));
      const presentCount = docAtts.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
      const rate = docAtts.length > 0 ? Math.round((presentCount / docAtts.length) * 100) : 0;
      return { id: d._id, name: d.name, specialization: d.specialization, rate, total: docAtts.length };
    });

    const lowComplianceDocs = doctorStats.filter(d => d.total > 0 && d.rate < 85);

    // AI Insight 2: PHC Compliance ranking
    const phcStats = phcs.map(p => {
      const pAtts = attendances.filter(a => String(a.phc) === String(p._id));
      const pPresent = pAtts.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
      const compliance = pAtts.length > 0 ? Math.round((pPresent / pAtts.length) * 100) : 0;
      return { id: p._id, name: p.name, district: p.district, compliance };
    });

    const totalRecords = attendances.length;
    const presentCountTotal = attendances.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const overallScore = totalRecords > 0 ? Math.round((presentCountTotal / totalRecords) * 100) : 100;

    const recommendations = [];

    if (lowComplianceDocs.length > 0) {
      recommendations.push({
        id: 'rec_1',
        severity: 'HIGH',
        category: 'Doctor Compliance Alert',
        title: `${lowComplianceDocs.length} Doctor(s) flagged for Low Attendance Compliance (<85%)`,
        description: `Doctors like ${lowComplianceDocs[0]?.name} show repeated missed checkpoint windows. Recommended action: Issue administrative reminder or adjust duty shift allocation.`
      });
    } else {
      recommendations.push({
        id: 'rec_1',
        severity: 'LOW',
        category: 'Doctor Compliance',
        title: 'Duty Compliance Status Normal',
        description: 'No physician accounts currently flagged for low attendance compliance.'
      });
    }

    recommendations.push({
      id: 'rec_2',
      severity: 'MEDIUM',
      category: 'Geofence Radius Optimization',
      title: 'Geofence Calibration Audit',
      description: 'GPS geofence radius settings are active across all registered Primary Health Centers.'
    });

    recommendations.push({
      id: 'rec_3',
      severity: 'INFO',
      category: 'Shift Timing Analysis',
      title: 'Automated Checkpoint Duty Engine',
      description: 'Hourly duty checkpoint reminders are operating with 1-minute ticker schedule.'
    });

    res.json({
      success: true,
      aiSummary: {
        overallScore,
        riskLevel: lowComplianceDocs.length > 0 ? 'MODERATE' : 'LOW',
        recommendations,
        doctorStats,
        phcStats
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error running AI analytics' });
  }
};
