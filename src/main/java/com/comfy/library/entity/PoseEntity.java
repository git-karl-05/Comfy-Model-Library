package com.comfy.library.entity;


import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonCreator;
import java.util.ArrayList;
import java.util.List;

@Entity
public class PoseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
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
    @Lob
    private String prompt;
    @Lob
    private String notes;
    @ElementCollection(fetch = FetchType.EAGER)
    @OrderColumn(name = "image_order")
    private List<String> images = new ArrayList<>();

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public List<String> getImages() { return images; }
    public void setImages(List<String> images) { this.images = images; }
    @Enumerated(EnumType.STRING)
    private PoseType type;

    @JsonCreator
    public PoseEntity(){}

    public PoseEntity(Long id, String name, String category, String filePath, boolean favorite, Long seed, String lora, String prompt, PoseType type) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.filePath = filePath;
        this.favorite = favorite;
        this.seed = seed;
        this.lora = lora;
        this.prompt = prompt;
        this.type = type;
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
