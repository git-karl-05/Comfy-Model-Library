package com.comfy.library.dto;

import com.comfy.library.entity.LoraCategory;

public class UpdateLoraRequest {
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
    private Boolean favorite;

    public UpdateLoraRequest() {
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

    public Boolean getFavorite() {
        return favorite;
    }

    public void setFavorite(Boolean favorite) {
        this.favorite = favorite;
    }

    public Long getSeedNumber() {
        return seedNumber;
    }

    public void setSeedNumber(Long seedNumber) {
        this.seedNumber = seedNumber;
    }
}
