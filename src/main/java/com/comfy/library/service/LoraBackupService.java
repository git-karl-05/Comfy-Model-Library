package com.comfy.library.service;

import com.comfy.library.dto.lora.BackupRestoreResponse;
import com.comfy.library.dto.lora.LoraBackup;
import com.comfy.library.dto.lora.LoraBackupItem;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.entity.LoraImageEntity;
import com.comfy.library.repository.LoraImageRepository;
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
    private final LoraImageRepository imageRepository;

    public LoraBackupService(
            LoraRepository loraRepository, LoraImageRepository imageRepository
    ) {
        this.loraRepository = loraRepository;
        this.imageRepository = imageRepository;
    }

    @Transactional
    public LoraBackup exportBackup() {

        List<LoraEntity> entities =
                loraRepository.findAll();

        List<LoraBackupItem> backupItems =
                new ArrayList<>();

        for (LoraEntity entity : entities) {

            LoraBackupItem item =
                    new LoraBackupItem();

            item.setLoraName(entity.getLoraName());
            item.setCreator(entity.getCreator());
            item.setVersion(entity.getVersion());
            item.setCategory(entity.getCategory());
            item.setSubCategory(entity.getSubCategory());
            item.setBaseModel(entity.getBaseModel());
            item.setGroupName(entity.getGroupName());

            item.setPositivePrompt(entity.getPositivePrompt());
            item.setPrompt(entity.getPrompt());
            item.setNegativePrompt(entity.getNegativePrompt());
            item.setSeedNumber(entity.getSeedNumber());
            item.setNotes(entity.getNotes());
            item.setFavorite(entity.isFavorite());
            item.setUrl(entity.getUrl());
            item.setFilePath(entity.getFilePath());
            item.setModelFilePath(entity.getModelFilePath());
            item.setSha256(entity.getSha256());
            item.setCreatedDate(entity.getCreatedDate());
            item.setLastUpdated(entity.getLastUpdated());
            item.setImages(imageRepository.findByLoraIdOrderByIdAsc(entity.getId()).stream()
                    .map(LoraImageEntity::getFilePath).toList());

            backupItems.add(item);
        }

        LoraBackup backup = new LoraBackup();

        backup.setBackupVersion(CURRENT_BACKUP_VERSION);
        backup.setExportedAt(LocalDateTime.now());
        backup.setLoras(backupItems);

        return backup;
    }

    @Transactional
    public BackupRestoreResponse restoreBackup(
            LoraBackup backup
    ) {

        validateBackup(backup);

        int importedCount = 0;
        int updatedCount = 0;

        for (LoraBackupItem item : backup.getLoras()) {
            LoraEntity existing = findExisting(item);
            LoraEntity entity = existing == null ? new LoraEntity() : existing;
            // Supplied values win, including null/false; omitted legacy fields stay intact.
            if (item.hasField("loraName")) entity.setLoraName(item.getLoraName());
            if (item.hasField("creator")) entity.setCreator(item.getCreator());
            if (item.hasField("version")) entity.setVersion(item.getVersion());
            if (item.hasField("category")) entity.setCategory(item.getCategory());
            if (item.hasField("subCategory")) entity.setSubCategory(item.getSubCategory());
            if (item.hasField("baseModel")) entity.setBaseModel(item.getBaseModel());
            if (item.hasField("groupName")) entity.setGroupName(item.getGroupName());
            if (item.hasField("prompt")) entity.setPrompt(item.getPrompt());
            if (item.hasField("positivePrompt")) entity.setPositivePrompt(item.getPositivePrompt());
            if (item.hasField("negativePrompt")) entity.setNegativePrompt(item.getNegativePrompt());
            if (item.hasField("seedNumber")) entity.setSeedNumber(item.getSeedNumber());
            if (item.hasField("notes")) entity.setNotes(item.getNotes());
            if (item.hasField("favorite")) entity.setFavorite(Boolean.TRUE.equals(item.getFavorite()));
            if (item.hasField("url")) entity.setUrl(item.getUrl());
            if (item.hasField("filePath")) entity.setFilePath(item.getFilePath());
            if (item.hasField("modelFilePath")) entity.setModelFilePath(item.getModelFilePath());
            if (item.hasField("sha256")) entity.setSha256(item.getSha256());
            if (item.hasField("createdDate")) entity.setCreatedDate(item.getCreatedDate());
            if (item.hasField("lastUpdated")) entity.setLastUpdated(item.getLastUpdated());

            loraRepository.save(entity);
            if (item.hasField("images")) {
                imageRepository.deleteAll(imageRepository.findByLoraIdOrderByIdAsc(entity.getId()));
                if (item.getImages() != null) {
                    for (String path : item.getImages()) {
                        imageRepository.save(new LoraImageEntity(path, entity));
                    }
                }
            }
            if (existing == null) importedCount++;
            else updatedCount++;
        }
        loraRepository.flush();
        imageRepository.flush();
        return new BackupRestoreResponse(importedCount, 0, updatedCount);
    }

    private LoraEntity findExisting(LoraBackupItem item) {
        // Stable file/source identity survives name and creator edits after metadata import.
        List<LoraEntity> matches = List.of();
        if (item.getSha256() != null && !item.getSha256().isBlank()) {
            matches = loraRepository.findAllBySha256(item.getSha256());
        }
        if (matches.isEmpty() && item.getUrl() != null && !item.getUrl().isBlank()) {
            matches = loraRepository.findAllByUrl(item.getUrl());
        }
        if (matches.isEmpty()) {
            matches = loraRepository.findAllByLoraNameAndVersionAndCreator(
                    item.getLoraName(), item.getVersion(), item.getCreator());
        }
        if (matches.size() > 1) {
            throw new IllegalArgumentException("Multiple existing LoRAs match backup record '"
                    + item.getLoraName() + "'. Resolve the duplicates before restoring. No records were changed.");
        }
        return matches.isEmpty() ? null : matches.getFirst();
    }

    private void validateBackup(
            LoraBackup backup
    ) {

        if (backup == null) {
            throw new IllegalArgumentException(
                    "Backup file is empty."
            );
        }

        if (
                backup.getBackupVersion()
                        != CURRENT_BACKUP_VERSION
        ) {
            throw new IllegalArgumentException(
                    "Unsupported backup version: "
                            + backup.getBackupVersion()
            );
        }

        if (backup.getLoras() == null) {
            throw new IllegalArgumentException(
                    "Backup does not contain LoRA data."
            );
        }
        for (int i = 0; i < backup.getLoras().size(); i++) {
            LoraBackupItem item = backup.getLoras().get(i);
            String prefix = "loras[" + i + "]";
            if (item == null || item.getLoraName() == null || item.getLoraName().isBlank()) {
                throw new IllegalArgumentException(prefix + ".loraName is required.");
            }
            validateLength(prefix + ".loraName", item.getLoraName(), 255);
            validateLength(prefix + ".creator", item.getCreator(), 255);
            validateLength(prefix + ".version", item.getVersion(), 255);
            validateLength(prefix + ".subCategory", item.getSubCategory(), 255);
            validateLength(prefix + ".baseModel", item.getBaseModel(), 255);
            validateLength(prefix + ".groupName", item.getGroupName(), 255);
            validateLength(prefix + ".prompt", item.getPrompt(), 5000);
            validateLength(prefix + ".positivePrompt", item.getPositivePrompt(), 5000);
            validateLength(prefix + ".negativePrompt", item.getNegativePrompt(), 5000);
            validateLength(prefix + ".notes", item.getNotes(), 5000);
            validateLength(prefix + ".url", item.getUrl(), 255);
            validateLength(prefix + ".filePath", item.getFilePath(), 255);
            validateLength(prefix + ".modelFilePath", item.getModelFilePath(), 255);
            validateLength(prefix + ".sha256", item.getSha256(), 255);
            if (item.getImages() != null) {
                for (String path : item.getImages()) {
                    if (path == null) throw new IllegalArgumentException(prefix + ".images must not contain null.");
                    validateLength(prefix + ".images", path, 255);
                }
            }
        }
    }

    private void validateLength(String field, String value, int maximum) {
        if (value != null && value.length() > maximum) {
            throw new IllegalArgumentException(field + " exceeds " + maximum + " characters.");
        }
    }
}
