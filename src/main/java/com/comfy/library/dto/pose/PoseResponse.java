package com.comfy.library.dto.pose;

import com.comfy.library.entity.PoseEntity;
import com.comfy.library.entity.PoseType;

public class PoseResponse {

    private Long id;
    private String name;
    private String category;
    private String baseModel;

    public String getBaseModel() { return baseModel; }
    public void setBaseModel(String baseModel) { this.baseModel = baseModel; }
    private String filePath;
    private boolean favorite;
    private Long seed;
    private String lora;
    private String prompt;
    private PoseType type;

    public PoseResponse(){}


    public PoseResponse(PoseEntity entity) {
        this.id = entity.getId();
        this.name = entity.getName();
        this.category = entity.getCategory();
        this.baseModel = entity.getBaseModel();
        this.filePath = entity.getFilePath();
        this.favorite = entity.isFavorite();
        this.seed = entity.getSeed();
        this.lora = entity.getLora();
        this.prompt = entity.getPrompt();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public Long getSeed() {
        return seed;
    }

    public void setSeed(Long seed) {
        this.seed = seed;
    }

    public String getLora() {
        return lora;
    }

    public void setLora(String lora) {
        this.lora = lora;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public PoseType getType() {
        return type;
    }

    public void setType(PoseType type) {
        this.type = type;
    }
}
