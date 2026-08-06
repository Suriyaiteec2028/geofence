const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.getNotifications = (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const userEmail = (req.user.email || '').toLowerCase().trim();

    const list = memoryStore.notifications.filter(n => {
      const recEmail = (n.recipientEmail || '').toLowerCase().trim();
      return (
        (recEmail && recEmail === userEmail) ||
        String(n.user) === String(userId) ||
        n.targetRole === userRole ||
        n.targetRole === 'ALL' ||
        userRole === 'CMO' ||
        userRole === 'ADMIN'
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
