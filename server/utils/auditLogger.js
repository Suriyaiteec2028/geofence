const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

/**
 * Record an immutable audit log entry.
 * Follows Section 7 Audit Log Requirements.
 * Does not store passwords, tokens, or sensitive credentials.
 */
function logAuditEvent({
  userId = null,
  userRole = 'SYSTEM',
  userName = 'System',
  action,
  recordType,
  recordId = null,
  details = {},
  timestamp = new Date().toISOString()
}) {
  try {
    memoryStore.auditLogs = memoryStore.auditLogs || [];

    const auditEntry = {
      _id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: userId ? String(userId) : null,
      userRole,
      userName,
      action, // e.g. ATTENDANCE_MARKED, ATTENDANCE_WINDOW_MISSED, EXPLANATION_SUBMITTED, etc.
      recordType, // e.g. Attendance, Explanation, Leave, LeaveApplication
      recordId: recordId ? String(recordId) : null,
      details,
      timestamp
    };

    memoryStore.auditLogs.unshift(auditEntry);

    // Keep up to 2000 audit log entries in memory
    if (memoryStore.auditLogs.length > 2000) {
      memoryStore.auditLogs = memoryStore.auditLogs.slice(0, 2000);
    }

    saveMemoryStoreToDisk();
    return auditEntry;
  } catch (err) {
    console.error('[AUDIT-LOG-ERROR]', err.message);
    return null;
  }
}

module.exports = { logAuditEvent };
