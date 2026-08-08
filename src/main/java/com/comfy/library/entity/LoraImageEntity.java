package com.comfy.library.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "lora_images")
public class LoraImageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String filePath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lora_id", nullable = false)
    private LoraEntity lora;

    public LoraImageEntity() {
    }

    public LoraImageEntity(String filePath, LoraEntity lora) {
        this.filePath = filePath;
        this.lora = lora;
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

    public LoraEntity getLora() {
        return lora;
    }

    public void setLora(LoraEntity lora) {
        this.lora = lora;
    }
}
