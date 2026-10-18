package com.comfy.library.dto.lora;

public class BackupRestoreResponse {

    private int importedCount;
    private int skippedCount;
    private int updatedCount;

    public BackupRestoreResponse(
            int importedCount,
            int skippedCount
    ) {
        this.importedCount = importedCount;
        this.skippedCount = skippedCount;
    }

    public BackupRestoreResponse(int importedCount, int skippedCount, int updatedCount) {
        this(importedCount, skippedCount);
        this.updatedCount = updatedCount;
    }

    public int getUpdatedCount() {
        return updatedCount;
    }

    public int getImportedCount() {
        return importedCount;
    }

    public int getSkippedCount() {
        return skippedCount;
    }
}