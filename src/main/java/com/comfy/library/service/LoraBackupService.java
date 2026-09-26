package com.comfy.library.service;


import com.comfy.library.dto.BackupRestoreResponse;
import com.comfy.library.dto.LoraBackup;
import com.comfy.library.dto.LoraBackupItem;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class LoraBackupService {

    private static final int CURRENT_BACKUP_VERSION = 1;
    private final LoraRepository loraRepository;

    public LoraBackupService(LoraRepository loraRepository) {
        this.loraRepository = loraRepository;
    }


    @Transactional
    public LoraBackup exportBackup() {
        List<LoraEntity> entities = loraRepository.findAll();

        List<LoraBackupItem> backupItems = new ArrayList<>();

        for (LoraEntity entity : entities) {
            LoraBackupItem item = new LoraBackupItem();

            item.setLoraName(entity.getLoraName());
            item.setCreator(entity.getCreator());
            item.setVersion(entity.getVersion());
            item.setCategory(entity.getCategory());
            item.setSubCategory(entity.getSubCategory());
            item.setBaseModel(entity.getBaseModel());
            item.setGroupName(entity.getGroupName());

            item.setPositivePrompt(entity.getPositivePrompt());
            item.setNegativePrompt(entity.getNegativePrompt());
            item.setSeedNumber(entity.getSeedNumber());
            item.setNotes(entity.getNotes());
            item.setFavorite(entity.isFavorite());
            item.setUrl(entity.getUrl());
            item.setFilePath(entity.getFilePath());

            backupItems.add(item);
        }

        LoraBackup backup = new LoraBackup();

        backup.setBackupVersion(CURRENT_BACKUP_VERSION);
        backup.setExportedAt(LocalDateTime.now());
        backup.setLoras(backupItems);

        return backup;
    }

    @Transactional
    public BackupRestoreResponse restoreBackup(LoraBackup backup) {

        int importedCount = 0;
        int skippedCount = 0;

        for (LoraBackupItem item : backup.getLoras()) {
            boolean alreadyExists = loraRepository.existsByLoraNameAndVersion(item.getLoraName(), item.getVersion());

            if (alreadyExists) {
                skippedCount++;
                continue;
            }

            LoraEntity entity =
                    new LoraEntity();

            entity.setLoraName(item.getLoraName());
            entity.setCreator(item.getCreator());
            entity.setVersion(item.getVersion());
            entity.setCategory(item.getCategory());
            entity.setSubCategory(item.getSubCategory());
            entity.setBaseModel(item.getBaseModel());
            entity.setGroupName(item.getGroupName());

            entity.setPositivePrompt(item.getPositivePrompt());
            entity.setNegativePrompt(item.getNegativePrompt());
            entity.setSeedNumber(item.getSeedNumber());
            entity.setNotes(item.getNotes());
            entity.setFavorite(Boolean.TRUE.equals(item.getFavorite()));
            entity.setUrl(item.getUrl());
            entity.setFilePath(item.getFilePath());

            loraRepository.save(entity);

            importedCount++;


        }

        return new BackupRestoreResponse(importedCount, skippedCount);

    }

    private void validateBackup(LoraBackup backup) {

        if (backup == null) {
            throw new IllegalArgumentException("Backup file is empty.");
        }

        if (backup.getBackupVersion() != CURRENT_BACKUP_VERSION) {
            throw new IllegalArgumentException("Upsupported backup version: " + backup.getBackupVersion());
        }


    }
}
