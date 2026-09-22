const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.getSettings = (req, res) => {
  res.json({ success: true, settings: memoryStore.settings });
};

exports.updateSettings = (req, res) => {
  try {
    const { checkpointIntervalMinutes, windowDurationMinutes, requireProofForExplanation, systemName, globalBiometricRequired } = req.body;

    if (checkpointIntervalMinutes !== undefined) memoryStore.settings.checkpointIntervalMinutes = Number(checkpointIntervalMinutes);
    if (windowDurationMinutes !== undefined) memoryStore.settings.windowDurationMinutes = Number(windowDurationMinutes);
    if (requireProofForExplanation !== undefined) memoryStore.settings.requireProofForExplanation = Boolean(requireProofForExplanation);
    if (systemName) memoryStore.settings.systemName = systemName;
    // Global biometric toggle — controls whether any doctor must face-scan on login
    if (globalBiometricRequired !== undefined) memoryStore.settings.globalBiometricRequired = Boolean(globalBiometricRequired);

    saveMemoryStoreToDisk();
    res.json({ success: true, message: 'System settings updated successfully', settings: memoryStore.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating settings' });
  }
};
