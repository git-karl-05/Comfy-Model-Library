package com.comfy.library.entity;

import jakarta.persistence.*;

@Entity
public class LoraImageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String imagePath;

    @ManyToOne
    private LoraEntity lora;
}
