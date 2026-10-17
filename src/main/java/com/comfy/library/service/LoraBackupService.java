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
        int skippedCount = 0;

        for (LoraBackupItem item : backup.getLoras()) {

            boolean alreadyExists =
                    loraRepository
                            .existsByLoraNameAndVersionAndCreator(
                                    item.getLoraName(),
                                    item.getVersion(), item.getCreator()
                            );

            if (alreadyExists) {
                skippedCount++;
                continue;
            }

            LoraEntity entity = new LoraEntity();

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

            entity.setFavorite(
                    Boolean.TRUE.equals(
                            item.getFavorite()
                    )
            );

            entity.setUrl(item.getUrl());
            entity.setFilePath(item.getFilePath());
            entity.setModelFilePath(item.getModelFilePath());
            entity.setSha256(item.getSha256());
            entity.setCreatedDate(item.getCreatedDate());
            entity.setLastUpdated(item.getLastUpdated());

            loraRepository.save(entity);
            if (item.getImages() != null) {
                for (String path : item.getImages()) imageRepository.save(new LoraImageEntity(path, entity));
            }

            importedCount++;
        }

        loraRepository.flush();
        return new BackupRestoreResponse(
                importedCount,
                skippedCount
        );
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
