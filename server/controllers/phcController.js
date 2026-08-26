const bcrypt = require('bcryptjs');
const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.getAllPHCs = (req, res) => {
  try {
    // Resilient fallback: ensure default PHC exists if list is empty
    if (memoryStore.phcs.length === 0) {
      memoryStore.phcs.push({
        _id: 'phc_001',
        name: 'City Care Hospital & Central PHC',
        code: 'PHC-THANJAVUR-01',
        address: '45, Health Care Road, Medical Nagar, Thanjavur, Tamil Nadu - 613007, India',
        district: 'Thanjavur',
        state: 'Tamil Nadu',
        pincode: '613007',
        latitude: 10.7870,
        longitude: 79.1378,
        radius: 200,
        assignedAdmin: 'admin_001',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });
      saveMemoryStoreToDisk();
    }

    const { search, district, status } = req.query;
    let list = [...memoryStore.phcs];

    if (search) {
      const query = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query) || p.district.toLowerCase().includes(query));
    }
    if (district) {
      list = list.filter(p => p.district.toLowerCase() === district.toLowerCase());
    }
    if (status) {
      list = list.filter(p => p.status === status);
    }

    // Attach admin details & total doctor count
    const enriched = list.map(p => {
      const admin = memoryStore.users.find(u => u._id === p.assignedAdmin);
      const doctorCount = memoryStore.users.filter(u => u.role === 'DOCTOR' && u.assignedPHC === p._id).length;
      return {
        ...p,
        adminName: admin ? admin.name : 'Unassigned',
        adminEmail: admin ? admin.email : '',
        doctorCount
      };
    });

    res.json({ success: true, count: enriched.length, phcs: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch PHCs' });
  }
};

exports.getPHCById = (req, res) => {
  const phc = memoryStore.phcs.find(p => p._id === req.params.id);
  if (!phc) return res.status(404).json({ success: false, message: 'PHC not found' });
  
  const admin = memoryStore.users.find(u => u._id === phc.assignedAdmin);
  const doctors = memoryStore.users.filter(u => u.role === 'DOCTOR' && u.assignedPHC === phc._id);
  
  res.json({ success: true, phc: { ...phc, admin, doctors } });
};

exports.createPHC = async (req, res) => {
  try {
    const { name, code, address, district, latitude, longitude, radius, assignedAdmin, createNewAdmin, adminData } = req.body;

    if (!name || !address || !district) {
      return res.status(400).json({ success: false, message: 'Please provide required PHC details (Name, Address, District).' });
    }

    let finalAdminId = assignedAdmin || null;

    if (createNewAdmin && adminData) {
      const { adminName, adminEmail, adminUsername, adminPassword, adminMobile, adminQualification } = adminData;
      if (!adminName || !adminEmail || !adminUsername || !adminPassword) {
        return res.status(400).json({ success: false, message: 'Admin Name, Email, Username, and Password are required when creating a new Admin.' });
      }

      const existingUser = memoryStore.users.find(u => u.email === adminEmail || u.username === adminUsername);
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'An account with this Admin email or username already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      const newAdmin = {
        _id: 'admin_' + Date.now(),
        name: adminName,
        email: adminEmail,
        username: adminUsername,
        password: hashedPassword,
        role: 'ADMIN',
        mobile: adminMobile || '',
        qualification: adminQualification || 'MBBS, MHA',
        assignedPHC: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };

      memoryStore.users.push(newAdmin);
      finalAdminId = newAdmin._id;
    }

    const newPhc = {
      _id: 'phc_' + Date.now(),
      name,
      code: code || ('PHC-' + Math.floor(100 + Math.random() * 900)),
      address,
      district,
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : 13.0827,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : 80.2707,
      radius: Number(radius) || 150,
      assignedAdmin: finalAdminId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    memoryStore.phcs.push(newPhc);

    if (finalAdminId) {
      const admin = memoryStore.users.find(u => u._id === finalAdminId);
      if (admin) admin.assignedPHC = newPhc._id;
    }

    saveMemoryStoreToDisk();

    res.status(201).json({ success: true, message: 'Primary Health Center created successfully', phc: newPhc });
  } catch (err) {
    console.error('Error creating PHC:', err);
    res.status(500).json({ success: false, message: 'Error creating PHC' });
  }
};

exports.updatePHC = (req, res) => {
  try {
    const { id } = req.params;
    const phcIndex = memoryStore.phcs.findIndex(p => p._id === id);
    if (phcIndex === -1) return res.status(404).json({ success: false, message: 'PHC not found' });

    const updated = {
      ...memoryStore.phcs[phcIndex],
      ...req.body,
      latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : memoryStore.phcs[phcIndex].latitude,
      longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : memoryStore.phcs[phcIndex].longitude,
      radius: req.body.radius !== undefined ? Number(req.body.radius) : memoryStore.phcs[phcIndex].radius
    };

    memoryStore.phcs[phcIndex] = updated;
    saveMemoryStoreToDisk();

    res.json({ success: true, message: 'PHC updated successfully', phc: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating PHC' });
  }
};

exports.togglePHCStatus = (req, res) => {
  const phc = memoryStore.phcs.find(p => p._id === req.params.id);
  if (!phc) return res.status(404).json({ success: false, message: 'PHC not found' });

  phc.status = phc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  saveMemoryStoreToDisk();
  res.json({ success: true, message: `PHC status changed to ${phc.status}`, phc });
};

exports.deletePHC = (req, res) => {
  const phcIndex = memoryStore.phcs.findIndex(p => p._id === req.params.id);
  if (phcIndex === -1) return res.status(404).json({ success: false, message: 'PHC not found' });

  memoryStore.phcs.splice(phcIndex, 1);
  saveMemoryStoreToDisk();
  res.json({ success: true, message: 'PHC deleted successfully' });
};
