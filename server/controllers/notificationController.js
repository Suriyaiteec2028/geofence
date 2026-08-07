const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.getNotifications = (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const userEmail = (req.user.email || '').toLowerCase().trim();

    // Strict Security Filtering: Never expose OTPs, Passwords, or Usernames in the Notifications Panel
    const list = memoryStore.notifications.filter(n => {
      const recEmail = (n.recipientEmail || '').toLowerCase().trim();
      const msgLower = (n.message || '').toLowerCase();
      const titleLower = (n.title || '').toLowerCase();

      // Filter out any notification containing sensitive OTPs or raw passwords
      if (titleLower.includes('otp') || msgLower.includes('otp code:') || msgLower.includes('password:') || msgLower.includes('username:')) {
        return false;
      }

      if (userRole === 'DOCTOR') {
        // Doctor Notification Panel: Duty Shift Updates, Checkpoint Reminders, Warnings, and Absence Explanation Approval/Rejection
        return (
          String(n.user) === String(userId) ||
          (recEmail && recEmail === userEmail) ||
          n.targetRole === 'DOCTOR' ||
          n.targetRole === 'ALL'
        );
      }

      // Admin & CMO Notification Panel: Duty Schedule Updates, New Doctor Absence Explanations, and Official Warnings
      return (
        String(n.user) === String(userId) ||
        (recEmail && recEmail === userEmail) ||
        n.targetRole === userRole ||
        n.targetRole === 'ADMIN' ||
        n.targetRole === 'CMO' ||
        n.targetRole === 'ALL'
      );
    });

    const unreadCount = list.filter(n => !n.read && !n.isRead).length;

    res.json({ success: true, count: list.length, unreadCount, notifications: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
};

exports.markAsRead = (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      memoryStore.notifications.forEach(n => {
        n.read = true;
        n.isRead = true;
      });
    } else {
      const notif = memoryStore.notifications.find(n => String(n._id) === String(id));
      if (notif) {
        notif.read = true;
        notif.isRead = true;
      }
    }
    saveMemoryStoreToDisk();
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating notifications' });
  }
};
