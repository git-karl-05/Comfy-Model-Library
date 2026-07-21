package com.comfy.library.dto;

import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;

import java.time.LocalDateTime;

public class LoraResponse {
    private Long id;

    private String loraName;
    private String version;
    private String creator;
    private String url;
    private LoraCategory category;
    private String subCategory;
    private String groupName;
    private String positivePrompt;
    private String negativePrompt;
    private Long seedNumber;
    private String notes;
    private boolean favorite;
    private String filePath;
    private LocalDateTime createdDate;
    private LocalDateTime lastUpdated;

    private String modelFilePath;
    private String sha256;
    private String baseModel;

    public LoraResponse(Long id, String loraName, String version, String creator, String url, LocalDateTime createdDate, LocalDateTime lastUpdated, LoraCategory category, String subCategory, String groupName, String positivePrompt, String negativePrompt, Long seedNumber, String notes, boolean favorite, String filePath, String modelFilePath, String sha256, String baseModel) {
    }

    public LoraResponse(LoraEntity loraEntity) {
        this.id = loraEntity.getId();
        this.loraName = loraEntity.getLoraName();
        this.version = loraEntity.getVersion();
        this.creator = loraEntity.getCreator();
        this.url = loraEntity.getUrl();
        this.category = loraEntity.getCategory();
        this.subCategory = loraEntity.getSubCategory();
        this.groupName = loraEntity.getGroupName();
        this.positivePrompt = loraEntity.getPositivePrompt();
        this.negativePrompt = loraEntity.getNegativePrompt();
        this.seedNumber = loraEntity.getSeedNumber();
        this.notes = loraEntity.getNotes();
        this.favorite = loraEntity.isFavorite();
        this.filePath = loraEntity.getFilePath();
        this.createdDate = loraEntity.getCreatedDate();
        this.lastUpdated = loraEntity.getLastUpdated();
        this.modelFilePath = loraEntity.getModelFilePath();
        this.sha256 = loraEntity.getSha256();
        this.baseModel = loraEntity.getBaseModel();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLoraName() {
        return loraName;
    }

    public void setLoraName(String loraName) {
        this.loraName = loraName;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public LoraCategory getCategory() {
        return category;
    }

    public void setCategory(LoraCategory category) {
        this.category = category;
    }

    public String getSubCategory() {
        return subCategory;
    }

    public void setSubCategory(String subCategory) {
        this.subCategory = subCategory;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public String getPositivePrompt() {
        return positivePrompt;
    }

    public void setPositivePrompt(String positivePrompt) {
        this.positivePrompt = positivePrompt;
    }

    public String getNegativePrompt() {
        return negativePrompt;
    }

    public void setNegativePrompt(String negativePrompt) {
        this.negativePrompt = negativePrompt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(LocalDateTime lastUpdated) {
        this.lastUpdated = lastUpdated;
    }

    public Long getSeedNumber() {
        return seedNumber;
    }

    public void setSeedNumber(Long seedNumber) {
        this.seedNumber = seedNumber;
    }

    public LocalDateTime getCreatedDate() {
        return createdDate;
    }

    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }

    public String getModelFilePath() {
        return modelFilePath;
    }

    public void setModelFilePath(String modelFilePath) {
        this.modelFilePath = modelFilePath;
    }

    public String getSha256() {
        return sha256;
    }

    public void setSha256(String sha256) {
        this.sha256 = sha256;
    }

    public String getBaseModel() {
        return baseModel;
    }

    public void setBaseModel(String baseModel) {
        this.baseModel = baseModel;
    }
}
