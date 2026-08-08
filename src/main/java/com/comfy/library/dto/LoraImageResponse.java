package com.comfy.library.dto;

import com.comfy.library.entity.LoraImageEntity;
import com.comfy.library.repository.LoraImageRepository;

public class LoraImageResponse {

    private Long id;
    private String filePath;
    private boolean primary;

    public LoraImageResponse(Long id, String filePath, boolean primary) {
        this.id = id;
        this.filePath = filePath;
        this.primary = primary;
    }

    public LoraImageResponse(LoraImageEntity loraImageEntity) {
        this.id = loraImageEntity.getId();
        this.filePath = loraImageEntity.getFilePath();
        this.primary = false;
    }


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }
}
