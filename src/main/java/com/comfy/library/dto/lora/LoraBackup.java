package com.comfy.library.dto.lora;

import java.time.LocalDateTime;
import java.util.List;

public class LoraBackup {

    private int backupVersion;
    private LocalDateTime exportedAt;
    private List<LoraBackupItem> loras;

    public int getBackupVersion() {
        return backupVersion;
    }

    public void setBackupVersion(int backupVersion) {
        this.backupVersion = backupVersion;
    }

    public LocalDateTime getExportedAt() {
        return exportedAt;
    }

    public void setExportedAt(LocalDateTime exportedAt) {
        this.exportedAt = exportedAt;
    }

    public List<LoraBackupItem> getLoras() {
        return loras;
    }

    public void setLoras(List<LoraBackupItem> loras) {
        this.loras = loras;
    }
}
