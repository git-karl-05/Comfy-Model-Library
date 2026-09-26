package com.comfy.library.dto;

public class BackupRestoreResponse {

    private int importedCount;
    private int skippedCount;

    public BackupRestoreResponse(
            int importedCount,
            int skippedCount
    ) {
        this.importedCount = importedCount;
        this.skippedCount = skippedCount;
    }

    public int getImportedCount() {
        return importedCount;
    }

    public int getSkippedCount() {
        return skippedCount;
    }
}