const { memoryStore } = require('../config/db');

exports.getNotifications = (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    const list = memoryStore.notifications.filter(n => 
      n.user === userId || n.targetRole === userRole || n.targetRole === 'ALL'
    );

    const unreadCount = list.filter(n => !n.isRead).length;

    res.json({ success: true, count: list.length, unreadCount, notifications: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
};

exports.markAsRead = (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      memoryStore.notifications.forEach(n => n.isRead = true);
    } else {
      const notif = memoryStore.notifications.find(n => n._id === id);
      if (notif) notif.isRead = true;
    }
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating notifications' });
  }
};
