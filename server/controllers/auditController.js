const { memoryStore } = require('../config/db');

exports.getAuditLogs = (req, res) => {
  try {
    const { action, userId, limit = 100, page = 1 } = req.query;
    memoryStore.auditLogs = memoryStore.auditLogs || [];

    let filtered = [...memoryStore.auditLogs];

    if (action && action !== 'all') {
      filtered = filtered.filter(a => a.action === action);
    }

    if (userId) {
      filtered = filtered.filter(a => String(a.userId) === String(userId));
    }

    const total = filtered.length;
    const startIndex = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginated = filtered.slice(startIndex, startIndex + parseInt(limit, 10));

    res.json({
      success: true,
      total,
      count: paginated.length,
      auditLogs: paginated
    });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    res.status(500).json({ success: false, message: 'Error retrieving audit logs' });
  }
};
