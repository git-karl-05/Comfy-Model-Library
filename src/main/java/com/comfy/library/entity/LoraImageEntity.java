package com.comfy.library.entity;

import jakarta.persistence.*;

@Entity
public class LoraImageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String filePath;

    @ManyToOne
    private LoraEntity lora_id;
}
