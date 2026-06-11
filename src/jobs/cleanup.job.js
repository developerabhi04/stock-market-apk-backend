export const runCleanupJob = async () => {
    try {
        console.log(`🧹 [CleanupJob] Started at ${new Date().toISOString()}`);

        // TODO: add real cleanup logic here
        // Example:
        // - remove expired OTPs
        // - clean temp uploads
        // - archive old logs
        // - delete stale sessions

        console.log(`✅ [CleanupJob] Completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('❌ [CleanupJob] Failed:', error.message);
    }
};

export default runCleanupJob;