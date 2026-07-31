const { memoryStore } = require('../config/db');

exports.getSettings = (req, res) => {
  res.json({ success: true, settings: memoryStore.settings });
};

exports.updateSettings = (req, res) => {
  try {
    const { checkpointIntervalMinutes, windowDurationMinutes, requireProofForExplanation, systemName } = req.body;

    if (checkpointIntervalMinutes !== undefined) memoryStore.settings.checkpointIntervalMinutes = Number(checkpointIntervalMinutes);
    if (windowDurationMinutes !== undefined) memoryStore.settings.windowDurationMinutes = Number(windowDurationMinutes);
    if (requireProofForExplanation !== undefined) memoryStore.settings.requireProofForExplanation = Boolean(requireProofForExplanation);
    if (systemName) memoryStore.settings.systemName = systemName;

    res.json({ success: true, message: 'System geofence & shift settings updated successfully', settings: memoryStore.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating settings' });
  }
};
