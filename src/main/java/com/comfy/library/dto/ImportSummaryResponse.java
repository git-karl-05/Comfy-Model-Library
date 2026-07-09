package com.comfy.library.dto;

public class ImportSummaryResponse {

    private int scannedFiles;
    private int importedCount;
    private int skippedCount;
    private int failedCount;

    public ImportSummaryResponse(int scannedFiles, int importedCount, int skippedCount, int failedCount) {
        this.scannedFiles = scannedFiles;
        this.importedCount = importedCount;
        this.skippedCount = skippedCount;
        this.failedCount = failedCount;
    }

    public int getScannedFiles() {
        return scannedFiles;
    }

    public void setScannedFiles(int scannedFiles) {
        this.scannedFiles = scannedFiles;
    }

    public int getImportedCount() {
        return importedCount;
    }

    public void setImportedCount(int importedCount) {
        this.importedCount = importedCount;
    }

    public int getSkippedCount() {
        return skippedCount;
    }

    public void setSkippedCount(int skippedCount) {
        this.skippedCount = skippedCount;
    }

    public int getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(int failedCount) {
        this.failedCount = failedCount;
    }
}
