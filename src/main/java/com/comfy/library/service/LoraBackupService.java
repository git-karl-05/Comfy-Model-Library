package com.comfy.library.service;


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

}
