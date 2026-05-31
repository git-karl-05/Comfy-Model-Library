package com.comfy.library.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
public class LoraEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String loraName;
    private String version;
    private String creator;
    private String url;
    private LocalDateTime createdDate;
    private LocalDateTime lastUpdated;
    @Enumerated(EnumType.STRING)
    private LoraCategory category;
    private String subCategory;
    private String groupName;
    @Column(length = 5000)
    private String positivePrompt;
    @Column(length = 5000)
    private String negativePrompt;
    private Long seedNumber;
    @Column(length = 5000)
    private String notes;
    private boolean favorite;
    private String filePath;

    public LoraEntity() {}

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

    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(LocalDateTime lastUpdated) {
        this.lastUpdated = lastUpdated;
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
}
