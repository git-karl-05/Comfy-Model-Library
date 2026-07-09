package com.comfy.library.service;

import com.comfy.library.dto.CreateLoraRequest;
import com.comfy.library.dto.ImportSummaryResponse;
import com.comfy.library.dto.LoraResponse;
import com.comfy.library.dto.UpdateLoraRequest;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LoraService {

    @Value("${lora.upload.path}")
    private String uploadPath;

    private final LoraRepository loraRepository;
    private final ObjectMapper objectMapper;

    public LoraService(LoraRepository loraRepository, ObjectMapper objectMapper) {
        this.loraRepository = loraRepository;
        this.objectMapper = objectMapper;
    }

    public LoraResponse saveLora(CreateLoraRequest request) {
        LoraEntity loraEntity = new LoraEntity();
        loraEntity.setLoraName(request.getLoraName());
        loraEntity.setVersion(request.getVersion());
        loraEntity.setCreator(request.getCreator());
        loraEntity.setUrl(request.getUrl());
        loraEntity.setCreatedDate(LocalDateTime.now());
        loraEntity.setLastUpdated(LocalDateTime.now());
        loraEntity.setCategory(request.getCategory());
        loraEntity.setSubCategory(request.getSubCategory());
        loraEntity.setGroupName(request.getGroupName());
        loraEntity.setPositivePrompt(request.getPositivePrompt());
        loraEntity.setNegativePrompt(request.getNegativePrompt());
        loraEntity.setSeedNumber(request.getSeedNumber());
        loraEntity.setNotes(request.getNotes());
        loraEntity.setFavorite(false);
        loraEntity.setFilePath(null);

        LoraEntity savedLora = loraRepository.save(loraEntity);
        return new LoraResponse(savedLora);
    }

    public LoraResponse saveLoraWithPreviewImage(CreateLoraRequest request, MultipartFile previewImage) {
        LoraEntity loraEntity = new LoraEntity();
        loraEntity.setLoraName(request.getLoraName());
        loraEntity.setVersion(request.getVersion());
        loraEntity.setCreator(request.getCreator());
        loraEntity.setUrl(request.getUrl());
        loraEntity.setCreatedDate(LocalDateTime.now());
        loraEntity.setLastUpdated(LocalDateTime.now());
        loraEntity.setCategory(request.getCategory());
        loraEntity.setSubCategory(request.getSubCategory());
        loraEntity.setGroupName(request.getGroupName());
        loraEntity.setPositivePrompt(request.getPositivePrompt());
        loraEntity.setNegativePrompt(request.getNegativePrompt());
        loraEntity.setSeedNumber(request.getSeedNumber());
        loraEntity.setNotes(request.getNotes());
        loraEntity.setFavorite(false);
        loraEntity.setFilePath(null);

        String filePath = null;

        if (previewImage != null && !previewImage.isEmpty()) {
            filePath = savePreviewImage(previewImage);
        }

        loraEntity.setFilePath(filePath);

        LoraEntity savedLora = loraRepository.save(loraEntity);
        return new LoraResponse(savedLora);
    }

    public LoraResponse updateLoraById(UpdateLoraRequest request, Long loraId) {
        LoraEntity loraEntity = loraRepository.findById(loraId).
                orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

        loraEntity.setLoraName(request.getLoraName());
        loraEntity.setVersion(request.getVersion());
        loraEntity.setCreator(request.getCreator());
        loraEntity.setUrl(request.getUrl());
        loraEntity.setLastUpdated(LocalDateTime.now());
        loraEntity.setCategory(request.getCategory());
        loraEntity.setSubCategory(request.getSubCategory());
        loraEntity.setGroupName(request.getGroupName());
        loraEntity.setPositivePrompt(request.getPositivePrompt());
        loraEntity.setNegativePrompt(request.getNegativePrompt());
        loraEntity.setSeedNumber(request.getSeedNumber());
        loraEntity.setNotes(request.getNotes());
        if (request.getFavorite() != null) {
            loraEntity.setFavorite(request.getFavorite());
        }

        LoraEntity savedLora = loraRepository.save(loraEntity);
        return new LoraResponse(savedLora);
    }

    public String deleteLoraById(Long loraId) {
        LoraEntity loraEntity = loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

        loraRepository.delete(loraEntity);
        return "Lora ID: " + loraId + " has been deleted";
    }

    public LoraResponse getLoraById(Long loraId) {
        LoraEntity loraEntity = loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

        return new LoraResponse(loraEntity);
    }

    public List<LoraResponse> getAllLoras()  {
        return loraRepository.findAll()
                .stream()
                .map(LoraEntity -> new LoraResponse(LoraEntity))
                .collect(Collectors.toList());
    }

    //Filter by category
    //Filter by group
    //Filter by favorites


    public List<LoraResponse> searchLoras(String keyword) {
        return loraRepository.findByLoraNameContainingIgnoreCase(keyword)
                .stream()
                .map(LoraResponse::new)
                .collect(Collectors.toList());
    }

    public List<LoraResponse> getLorasByCategory(LoraCategory category) {
        return loraRepository.findByCategory(category)
                .stream()
                .map(LoraResponse::new)
                .collect(Collectors.toList());
    }

    public List<LoraResponse> getLorasByGroup(String groupName) {
        return loraRepository.findByGroupNameIgnoreCase(groupName)
                .stream()
                .map(LoraResponse::new)
                .collect(Collectors.toList());
    }

    public List<LoraResponse> getFavoriteLoras() {
        return loraRepository.findByFavoriteTrue()
                .stream()
                .map(LoraResponse::new)
                .collect(Collectors.toList());
    }

    public LoraResponse toggleFavorite(Long loraId) {
        LoraEntity loraEntity = loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

        loraEntity.setFavorite(!loraEntity.isFavorite());
        loraEntity.setLastUpdated(LocalDateTime.now());

        LoraEntity savedLora = loraRepository.save(loraEntity);
        return new LoraResponse(savedLora);
    }

    public List<LoraResponse> getAllLorasSortedByGroupname() {
        return loraRepository.findAllByOrderByGroupNameAsc()
                .stream()
                .map(LoraResponse::new)
                .collect(Collectors.toList());
    }

    public List<LoraCategory> getCategories() {
        return Arrays.asList(LoraCategory.values());
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

    private enum ImportResult {
        IMPORTED,
        SKIPPED
    }

    public ImportSummaryResponse importLorasFromFolder(String folderPath) {
        int scanned = 0;
        int imported = 0;
        int skipped = 0;
        int failed = 0;

        try {
            List<Path> metadataFiles = Files.walk(Paths.get(folderPath))
                    .filter(Files::isRegularFile)
                    .filter(path -> path.toString().endsWith(".metadata.json"))
                    .toList();

            scanned = metadataFiles.size();

            for (Path metadataFile : metadataFiles) {
                try {
                    ImportResult result = importSingleMetadataFiles(metadataFile);

                    if (result == ImportResult.IMPORTED) {
                        imported++;
                    } else if (result == ImportResult.SKIPPED) {
                        skipped++;
                    }
                } catch (Exception e) {
                    failed++;
                    System.out.println("Failed to import: " + metadataFile);
                    e.printStackTrace();
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Filed to scan folder: " + folderPath, e);
        }
        return new ImportSummaryResponse(scanned, imported, skipped, failed);
    }
}

