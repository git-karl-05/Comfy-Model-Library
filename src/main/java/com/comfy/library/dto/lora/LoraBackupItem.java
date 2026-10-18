package com.comfy.library.dto.lora;

import com.comfy.library.entity.LoraCategory;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;


@JsonPropertyOrder({
        "loraName",
        "creator",
        "version",
        "category",
        "subCategory",
        "baseModel",
        "groupName",
        "positivePrompt",
        "negativePrompt",
        "seedNumber",
        "notes",
        "favorite",
        "url",
        "filePath"
})
public class LoraBackupItem {

    // Missing legacy fields must be distinguished from explicit null values.
    private final java.util.Set<String> providedFields = new java.util.HashSet<>();

    public boolean hasField(String field) {
        return providedFields.contains(field);
    }

    private String loraName;
    private String creator;
    private String version;
    private LoraCategory category;
    private String subCategory;
    private String baseModel;
    private String groupName;

    private String positivePrompt;
    private String negativePrompt;
    private Long seedNumber;

    private String notes;
    private Boolean favorite;

    private String url;
    private String filePath;
    private String modelFilePath;
    private String sha256;
    private java.time.LocalDateTime createdDate;
    private java.time.LocalDateTime lastUpdated;
    private java.util.List<String> images;

    public String getModelFilePath() { return modelFilePath; }
    public void setModelFilePath(String value) {
        providedFields.add("modelFilePath");
        modelFilePath = value;
    }
    public String getSha256() { return sha256; }
    public void setSha256(String value) {
        providedFields.add("sha256");
        sha256 = value;
    }
    public java.time.LocalDateTime getCreatedDate() { return createdDate; }
    public void setCreatedDate(java.time.LocalDateTime value) {
        providedFields.add("createdDate");
        createdDate = value;
    }
    public java.time.LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(java.time.LocalDateTime value) {
        providedFields.add("lastUpdated");
        lastUpdated = value;
    }
    public java.util.List<String> getImages() { return images; }
    public void setImages(java.util.List<String> value) {
        providedFields.add("images");
        images = value;
    }

    public String getLoraName() {
        return loraName;
    }

    public void setLoraName(String loraName) {
        providedFields.add("loraName");
        this.loraName = loraName;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        providedFields.add("creator");
        this.creator = creator;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        providedFields.add("version");
        this.version = version;
    }

    public LoraCategory getCategory() {
        return category;
    }

    public void setCategory(LoraCategory category) {
        providedFields.add("category");
        this.category = category;
    }

    public String getSubCategory() {
        return subCategory;
    }

    public void setSubCategory(String subCategory) {
        providedFields.add("subCategory");
        this.subCategory = subCategory;
    }

    public String getBaseModel() {
        return baseModel;
    }

    public void setBaseModel(String baseModel) {
        providedFields.add("baseModel");
        this.baseModel = baseModel;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        providedFields.add("groupName");
        this.groupName = groupName;
    }

    public String getPositivePrompt() {
        return positivePrompt;
    }

    public void setPositivePrompt(String positivePrompt) {
        providedFields.add("positivePrompt");
        this.positivePrompt = positivePrompt;
    }

    public String getNegativePrompt() {
        return negativePrompt;
    }

    public void setNegativePrompt(String negativePrompt) {
        providedFields.add("negativePrompt");
        this.negativePrompt = negativePrompt;
    }

    public Long getSeedNumber() {
        return seedNumber;
    }

    public void setSeedNumber(Long seedNumber) {
        providedFields.add("seedNumber");
        this.seedNumber = seedNumber;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        providedFields.add("notes");
        this.notes = notes;
    }

    public Boolean getFavorite() {
        return favorite;
    }

    public void setFavorite(Boolean favorite) {
        providedFields.add("favorite");
        this.favorite = favorite;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        providedFields.add("url");
        this.url = url;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        providedFields.add("filePath");
        this.filePath = filePath;
    }
}
