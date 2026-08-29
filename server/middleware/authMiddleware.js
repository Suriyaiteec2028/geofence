const jwt = require('jsonwebtoken');
const { memoryStore } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_geofence_super_secret_jwt_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Attach workspace isolation ID
    const user = memoryStore.users.find(u => 
      String(u._id) === String(decoded.id) || 
      (decoded.email && u.email.toLowerCase() === decoded.email.toLowerCase())
    );

    if (user) {
      req.userDetails = user;
      req.user.workspaceId = user.workspaceId || (user.email && user.email.toLowerCase() === 'suriyachandru2006@gmail.com' ? 'workspace_master_suriyachandru' : 'workspace_demo_public');
    } else {
      req.user.workspaceId = (decoded.email && decoded.email.toLowerCase() === 'suriyachandru2006@gmail.com') ? 'workspace_master_suriyachandru' : 'workspace_demo_public';
    }

    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden. Required role: [${allowedRoles.join(', ')}]. Your role: ${req.user ? req.user.role : 'None'}` 
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
