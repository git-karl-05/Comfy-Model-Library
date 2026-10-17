package com.comfy.library.dto.lora;

import com.comfy.library.entity.LoraCategory;

public record LoraFilterMetadata(String baseModel, LoraCategory category, String subCategory) {
}
