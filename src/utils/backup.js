import { db } from '../db/database';

export const performAutoBackup = async () => {
    if (!window.__TAURI_INTERNALS__) return { success: false, reason: 'Not running in Tauri' };

    try {
        const { documentDir, join } = await import('@tauri-apps/api/path');
        const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

        const docsDir = await documentDir();
        const backupDir = await join(docsDir, 'SenbetBackups');

        const dirExists = await exists(backupDir);
        if (!dirExists) {
            await mkdir(backupDir, { recursive: true });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = await join(backupDir, `backup_${dateStr}.json`);

        // Check if today's backup already exists
        const fileExists = await exists(filename);
        if (fileExists) return { success: true, reason: 'Backup already exists for today' };

        const exportData = {};
        for (const table of db.tables) {
            exportData[table.name] = await table.toArray();
        }

        const jsonString = JSON.stringify(exportData, null, 2);
        await writeTextFile(filename, jsonString);

        return { success: true, path: filename };
    } catch (e) {
        console.error('Auto backup failed:', e);
        return { success: false, error: e };
    }
};

export const performManualBackup = async () => {
    const exportData = {};
    for (const table of db.tables) {
        exportData[table.name] = await table.toArray();
    }
    const jsonString = JSON.stringify(exportData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];

    if (!window.__TAURI_INTERNALS__) {
        // Fallback to web download if not Tauri
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Senbet_Backup_${dateStr}.json`;
        a.click();
        return { success: true };
    }

    try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        
        const filePath = await save({
            defaultPath: `Senbet_Backup_${dateStr}.json`,
            filters: [{ name: 'JSON Document', extensions: ['json'] }]
        });

        if (!filePath) return { success: false, reason: 'Cancelled' };

        await writeTextFile(filePath, jsonString);
        return { success: true, path: filePath };
    } catch (e) {
        console.error('Manual backup failed:', e);
        return { success: false, error: e };
    }
};
