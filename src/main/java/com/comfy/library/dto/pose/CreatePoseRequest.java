package com.comfy.library.dto.pose;

import com.comfy.library.entity.PoseType;

public class CreatePoseRequest {

    private String name;
    private String category;
    private String filePath;
    private boolean favorite;
    private Integer seed;
    private String lora;
    private String prompt;
    private PoseType type;

    public CreatePoseRequest(){}

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

    public Integer getSeed() {
        return seed;
    }

    public void setSeed(Integer seed) {
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
