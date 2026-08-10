package com.comfy.library.service;

import com.comfy.library.dto.LoraImageResponse;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.entity.LoraImageEntity;
import com.comfy.library.repository.LoraImageRepository;
import com.comfy.library.repository.LoraRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class LoraImageService {

    private final LoraRepository loraRepository;
    private final LoraImageRepository loraImageRepository;

    @Value("${lora.upload.path}")
    private String uploadPath;

    public LoraImageService(LoraRepository loraRepository, LoraImageRepository loraImageRepository) {
        this.loraRepository = loraRepository;
        this.loraImageRepository = loraImageRepository;
    }

    public LoraEntity findLoraById(Long loraId) {
        return loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("LoRA ID: " + loraId + " not found"));
    }

    public List<LoraImageResponse> getImagesByLoraId(Long loraId) {
        LoraEntity lora = findLoraById(loraId);

        List<LoraImageResponse> images = new ArrayList<>();

        if (lora.getFilePath() != null && !lora.getFilePath().isBlank()) {
            images.add(
                    new LoraImageResponse(
                            null,
                            lora.getFilePath(),
                            true
                    )
            );
        }

        List<LoraImageResponse> additionalImages = loraImageRepository
                .findByLoraIdOrderByIdAsc(loraId)
                .stream()
                .map(LoraImageResponse::new)
                .toList();

        images.addAll(additionalImages);

        return images;
    }

    public String savePreviewImage(MultipartFile previewImage) {
        try {
            Files.createDirectories(Paths.get(uploadPath));

            String originalFileName = previewImage.getOriginalFilename();
            String safeFileName = UUID.randomUUID() + "_" + originalFileName;

            Path destinationPath = Paths.get(uploadPath, safeFileName);

            previewImage.transferTo(destinationPath.toFile());
            return "/uploads/lora/" + safeFileName;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save preview image", e);
        }
    }

    private String saveCarouselImage(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new RuntimeException("An image file is required.");
        }
        return savePreviewImage(image);
    }

    public LoraImageResponse addImageToLora(Long loraId, MultipartFile image) {
        LoraEntity loraEntity = findLoraById(loraId);

        String filePath = saveCarouselImage(image);

        LoraImageEntity loraImageEntity = new LoraImageEntity();
        loraImageEntity.setFilePath(filePath);
        loraImageEntity.setLora(loraEntity);

        LoraImageEntity savedImageEntity = loraImageRepository.save(loraImageEntity);
        return new LoraImageResponse(savedImageEntity);
    }

    public void saveAdditionalPreviewImages(LoraEntity loraEntity, List<String> previewPaths) {
        for (int i = 1; i < previewPaths.size(); i++) {
            LoraImageEntity loraImageEntity = new LoraImageEntity();

            loraImageEntity.setFilePath(previewPaths.get(i));
            loraImageEntity.setLora(loraEntity);

            loraImageRepository.save(loraImageEntity);
        }
    }

    public String getPrimaryPreviewPath(List<String> previewPaths) {
        if (previewPaths.isEmpty()) {
            return null;
        }

        return previewPaths.get(0);
    }
}
