package com.comfy.library.service;

import com.comfy.library.dto.*;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.entity.LoraImageEntity;
import com.comfy.library.repository.LoraImageRepository;
import com.comfy.library.repository.LoraRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.criteria.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LoraService {

    private static final int DEFAULT_PAGE_SIZE = 12;
    private static final int MAX_PAGE_SIZE = 36;

    private static final int MAX_PREVIEW_IMAGES = 5;

    @Value("${lora.upload.path}")
    private String uploadPath;

    private final LoraRepository loraRepository;
    private final LoraImageRepository loraImageRepository;
    private final ObjectMapper objectMapper;

    public LoraService(LoraRepository loraRepository, LoraImageRepository loraImageRepository, ObjectMapper objectMapper) {
        this.loraRepository = loraRepository;
        this.loraImageRepository = loraImageRepository;
        this.objectMapper = objectMapper;
    }

    public LoraResponse saveLora(CreateLoraRequest request) {
        LoraEntity loraEntity = new LoraEntity();
        loraEntity.setLoraName(request.getLoraName());
        loraEntity.setVersion(normalizeVersion(request.getVersion()));
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
        loraEntity.setBaseModel(request.getBaseModel());

        LoraEntity savedLora = loraRepository.save(loraEntity);
        return new LoraResponse(savedLora);
    }

    public LoraResponse saveLoraWithPreviewImage(CreateLoraRequest request, MultipartFile previewImage) {
        LoraEntity loraEntity = new LoraEntity();
        loraEntity.setLoraName(request.getLoraName());
        loraEntity.setVersion(normalizeVersion(request.getVersion()));
        loraEntity.setCreator(request.getCreator());
        loraEntity.setUrl(request.getUrl());
        loraEntity.setCreatedDate(LocalDateTime.now());
        loraEntity.setLastUpdated(LocalDateTime.now());
        loraEntity.setCategory(request.getCategory());
        loraEntity.setSubCategory(request.getSubCategory());
        loraEntity.setGroupName(request.getGroupName());
        loraEntity.setPositivePrompt(request.getPositivePrompt());
        loraEntity.setNegativePrompt(request.getNegativePrompt());
        loraEntity.setBaseModel(request.getBaseModel());
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


    public LoraResponse updateLoraWithPreviewById(Long loraId, UpdateLoraRequest request, MultipartFile preview) {
        LoraEntity existingLora = loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

        updateEditFields(request, existingLora);

        if (preview != null && !preview.isEmpty()) {
            String newFilePath = savePreviewImage(preview);
            existingLora.setFilePath(newFilePath);
        }

        LoraEntity savedLora = loraRepository.save(existingLora);
        return new LoraResponse(savedLora);

    }

    private void updateEditFields(UpdateLoraRequest request, LoraEntity entity) {
        entity.setLoraName(request.getLoraName());
        entity.setVersion(normalizeVersion(request.getVersion()));
        entity.setCreator(request.getCreator());
        entity.setUrl(request.getUrl());
        entity.setLastUpdated(LocalDateTime.now());
        entity.setCategory(request.getCategory());
        entity.setSubCategory(request.getSubCategory());
        entity.setBaseModel(request.getBaseModel());
        entity.setPositivePrompt(request.getPositivePrompt());
        entity.setNegativePrompt(request.getNegativePrompt());
        entity.setSeedNumber(request.getSeedNumber());
        entity.setNotes(request.getNotes());
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

    public LoraEntity findLoraById(Long loraId) {
        return loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

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

    public List<LoraResponse> getAllLoras()  {
        return loraRepository.findAll()
                .stream()
                .map(LoraEntity -> new LoraResponse(LoraEntity))
                .collect(Collectors.toList());
    }

    //Filter by category
    //Filter by group
    //Filter by favorites


    public Page<LoraResponse> searchLoras(String keyword, int page, int size) {

        Pageable pageable = createPageable(page, size);

        Page<LoraEntity> entityPage = loraRepository.findByLoraNameContainingIgnoreCase(keyword, pageable);

        return entityPage.map(LoraResponse::new);
    }



    private int normalizePageNumber(int page) {
        return Math.max(page, 0);
    }

    private int normalizePageSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }

        return Math.min(size, MAX_PAGE_SIZE);
    }

    private Pageable createPageable(int page, int size) {
        int normalizedPage = normalizePageNumber(page);
        int normalizedSize = normalizePageSize(size);

        return PageRequest.of(normalizedPage, normalizedSize, Sort.by(Sort.Direction.DESC, "createdDate"));
    }



    public Page<LoraResponse> getFavoriteLoras(int page, int size) {


        Pageable pageable = createPageable(page, size);

        Page<LoraEntity> entityPage = loraRepository.findByFavoriteTrue(pageable);

        return entityPage.map(LoraResponse::new);

    }

    public LoraResponse toggleFavorite(Long loraId) {
        LoraEntity loraEntity = loraRepository.findById(loraId)
                .orElseThrow(() -> new RuntimeException("Lora ID: " + loraId + " not found"));

        loraEntity.setFavorite(!loraEntity.isFavorite());
        loraEntity.setLastUpdated(LocalDateTime.now());

        LoraEntity savedLora = loraRepository.save(loraEntity);
        return new LoraResponse(savedLora);
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

    private enum ImportResult {
        IMPORTED,
        SKIPPED
    }

    public ImportSummaryResponse importLorasFromFolder(String folderPath) {
        printLorasMissingMetadata(folderPath);

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
                    ImportResult result = importSingleMetadataFile(metadataFile);

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
            throw new RuntimeException("Failed to scan folder: " + folderPath, e);
        }
        return new ImportSummaryResponse(scanned, imported, skipped, failed);
    }


    private ImportResult importSingleMetadataFile(Path metadataFile) throws IOException {
        JsonNode root = objectMapper.readTree(metadataFile.toFile());

        String sha256 = getText(root, "sha256");

        if (sha256 != null && loraRepository.existsBySha256(sha256)) {
            return ImportResult.SKIPPED;
        }

        List<String> previewPaths = resolvePreviewPaths(root);

        LoraEntity entity = new LoraEntity();

        entity.setLoraName(resolveLoraName(root));
        entity.setVersion(normalizeVersion(getText(root.path("civitai"), "name")));
        entity.setCreator(resolveCreator(root));
        entity.setUrl(resolveUrl(root));
        entity.setCreatedDate(LocalDateTime.now());
        entity.setLastUpdated(LocalDateTime.now());
        entity.setCategory(resolveCategory(root));
        entity.setSubCategory(resolveSubCategory(root));
        entity.setBaseModel(resolveBaseModel(root));
        entity.setPositivePrompt(resolvePositivePrompt(root));
        entity.setNegativePrompt(resolveNegativePrompt(root));
        entity.setSeedNumber(resolveSeedNumber(root));
        entity.setNotes(null);
        entity.setFavorite(false);

        entity.setFilePath(getPrimaryPreviewPath(previewPaths));
        entity.setModelFilePath(getText(root, "file_path"));
        entity.setSha256(sha256);

        LoraEntity savedLora = loraRepository.save(entity);

        saveAdditionalPreviewImages(savedLora, previewPaths);

        return ImportResult.IMPORTED;
    }

    private String getText(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);

        if (value == null || value.isNull()) {
            return null;
        }

        String text = value.asText();

        return text.isBlank() ? null : text;
    }

    private String resolveLoraName(JsonNode root) {
        String fileName = getText(root, "file_name");

        if (fileName != null) {
            return fileName;
        }

        String modelName = getText(root, "model_name");

        if (modelName != null) {
            return modelName;
        }

        return "Untitled LoRA";
    }

    private String resolveCreator(JsonNode root) {
        String fileName = getText(root, "file_name");

        if (fileName == null || fileName.isBlank()) {
            return "Unknown Creator";
        }

        String[] parts = fileName.split("(?i)\\s+by\\s+", 2);

        if (parts.length < 2) {
            return "Unknown Creator";
        }

        String creator = parts[1].trim();

        return creator.isBlank()
                ? "Unknown Creator"
                : creator;
    }

    private String resolveUrl(JsonNode root) {
        JsonNode civitai = root.path("civitai");

        String downloadUrl = getText(civitai, "downloadUrl");

        if (downloadUrl != null) {
            return downloadUrl;
        }

        JsonNode files = civitai.path("files");

        if (files.isArray() && files.size() > 0) {
            return getText(files.get(0), "downloadUrl");
        }

        return null;
    }

    private LoraCategory resolveCategory(JsonNode root) {
        String filePath = getText(root, "file_path");

        if (filePath == null) {
            return LoraCategory.CONCEPT;
        }

        String normalized = filePath.toLowerCase();

        if (normalized.contains("/character/") || normalized.contains("\\character\\")) {
            return LoraCategory.CHARACTER;
        }

        if (normalized.contains("/style/") || normalized.contains("\\style\\")) {
            return LoraCategory.STYLE;
        }

        if (normalized.contains("/outfit/") || normalized.contains("\\outfit\\")) {
            return LoraCategory.OUTFIT;
        }

        if (normalized.contains("/pose/") || normalized.contains("\\pose\\")) {
            return LoraCategory.POSES;
        }

        if (normalized.contains("/background/") || normalized.contains("\\background\\")) {
            return LoraCategory.BACKGROUND;
        }

        if (normalized.contains("/slider/") || normalized.contains("\\slider\\")) {
            return LoraCategory.SLIDER;
        }

        if (normalized.contains("/enhancer/") || normalized.contains("\\enhancer\\")) {
            return LoraCategory.ENHANCER;
        }

        return LoraCategory.CONCEPT;
    }

    private String resolveSubCategory(JsonNode root) {
        String filePath = getText(root, "file_path");

        if (filePath == null) {
            return null;
        }

        Path path = Paths.get(filePath);

        Path parent = path.getParent();

        if (parent == null) {
            return null;
        }

        return parent.getFileName().toString();
    }

    private String resolveBaseModel(JsonNode root) {
        String baseModel = getText(root, "base_model");

        if (baseModel != null) {
            return baseModel;
        }

        return "Imported";
    }


    private String resolvePositivePrompt(JsonNode root) {
        JsonNode trainedWords =
                root.path("civitai").path("trainedWords");

        if (!trainedWords.isArray() || trainedWords.isEmpty()) {
            return null;
        }

        List<String> trainedWordGroups = new ArrayList<>();

        for (JsonNode wordNode : trainedWords) {
            if (!wordNode.isTextual()) {
                continue;
            }

            String value = wordNode
                    .asText()
                    .trim()
                    .replaceAll("^,+|,+$", "")
                    .trim();

            if (!value.isEmpty()) {
                trainedWordGroups.add(value);
            }
        }

        return trainedWordGroups.isEmpty()
                ? null
                : String.join(", ", trainedWordGroups);
    }

    private String resolveNegativePrompt(JsonNode root) {
        JsonNode images = root.path("civitai").path("images");

        if (images.isArray() && images.size() > 0) {
            return getText(images.get(0).path("meta"), "negativePrompt");
        }

        return null;
    }

    private Long resolveSeedNumber(JsonNode root) {
        JsonNode images = root.path("civitai").path("images");

        if (images.isArray() && images.size() > 0) {
            JsonNode seed = images.get(0).path("meta").get("seed");

            if (seed != null && seed.canConvertToLong()) {
                return seed.asLong();
            }
        }

        return null;
    }



    private String resolveNotes(JsonNode root) {
        StringBuilder notes = new StringBuilder();

        String baseModel = getText(root, "base_model");

        if (baseModel != null) {
            notes.append("Base model: ").append(baseModel).append("\n");
        }

        JsonNode trainedWords = root.path("civitai").path("trainedWords");

        if (trainedWords.isArray() && trainedWords.size() > 0) {
            notes.append("Trained words: ");

            for (JsonNode word : trainedWords) {
                notes.append(word.asText()).append(" ");
            }

            notes.append("\n");
        }

        String modelFilePath = getText(root, "file_path");

        if (modelFilePath != null) {
            notes.append("Model file path: ").append(modelFilePath).append("\n");
        }

        String description = getText(root.path("civitai"), "description");

        if (description != null) {
            notes.append("Description: ").append(description);
        }

        return notes.isEmpty() ? null : notes.toString();
    }

    private List<String> resolvePreviewPaths(JsonNode root) {
        List<String> previewPaths = new ArrayList<>();
        JsonNode previews = root.path("civitai").path("images");

        if (previews.isArray()) {
            for (JsonNode preview : previews) {
                String previewUrl = getText(preview, "url");

                if (previewUrl == null || previewPaths.contains(previewUrl)) {
                    continue;
                }

                previewPaths.add(previewUrl);

                if (previewPaths.size() >= MAX_PREVIEW_IMAGES) {
                    break;
                }
            }
        }
        return previewPaths;
    }

    private String getPrimaryPreviewPath(List<String> previewPaths) {
        if (previewPaths.isEmpty()) {
            return null;
        }

        return previewPaths.get(0);
    }

    private void saveAdditionalPreviewImages(LoraEntity loraEntity, List<String> previewPaths) {
        for (int i = 1; i < previewPaths.size(); i++) {
            LoraImageEntity loraImageEntity = new LoraImageEntity();

            loraImageEntity.setFilePath(previewPaths.get(i));
            loraImageEntity.setLora(loraEntity);

            loraImageRepository.save(loraImageEntity);
        }
    }

    private boolean isSafetensorsFile(Path file) {
        String fileName = file
                .getFileName()
                .toString()
                .toLowerCase();

        return fileName.endsWith(".safetensors");
    }

    private boolean isMetadataFileMissing(Path modelFile) {
        Path expectedMetadataFile = resolveMetadataPath(modelFile);

        return Files.notExists(expectedMetadataFile);
    }



    private String removeSafetensorsExtension(String fileName) {
        String extension = ".safetensors";

        if (!fileName.toLowerCase().endsWith(extension)) {
            throw new IllegalArgumentException("Not a safetensors file: " + fileName);
        }
        return fileName.substring(0, fileName.length() - extension.length());
    }

    private Path resolveMetadataPath(Path modelFile) {
        String modelFileName = modelFile
                .getFileName()
                .toString();

        String baseName = removeSafetensorsExtension(modelFileName);

        String metadataFileName = baseName + ".metadata.json";

        return modelFile
                .getParent()
                .resolve(metadataFileName);
    }

    private List<Path> findLorasMissingMetadata(String folderPath) {
        Path rootFolder = Paths.get(folderPath);

        if (!Files.exists(rootFolder)) {
            throw new IllegalArgumentException("Folder does not exist: " + folderPath);
        }

        if (!Files.isDirectory(rootFolder)) {
            throw new IllegalArgumentException("Path is not a folder: " + folderPath);
        }

        try (Stream<Path> paths = Files.walk(rootFolder)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(this::isSafetensorsFile)
                    .filter(this::isMetadataFileMissing)
                    .toList();
        } catch (IOException e) {
            throw new RuntimeException("Failed to scan folder for LoRA files: " + folderPath);
        }
    }

    private void printLorasMissingMetadata(String folderPath) {
        List<Path> missingMetadataFiles = findLorasMissingMetadata(folderPath);

        System.out.println("LoRAs missing metadata: " + missingMetadataFiles.size());

        missingMetadataFiles.forEach(modelFile -> {
            System.out.println("Model: " + modelFile);

            System.out.println("Expected JSON: " + resolveMetadataPath(modelFile));
        });
    }





    public Page<LoraResponse> getLoras(int page, int size) {
        Pageable pageable = createPageable(page, size);

        Page<LoraEntity> entityPage = loraRepository.findAll(pageable);

        return entityPage.map(LoraResponse::new);
    }

    public Page<LoraResponse> getLorasByCategory(LoraCategory category, int page, int size) {

        Pageable pageable = createPageable(page, size);

        Page<LoraEntity> entityPage = loraRepository.findByCategory(category, pageable);

        return entityPage.map(LoraResponse::new);
    }

    public Page<LoraResponse> getLorasByGroup(String groupName, int page, int size) {

        Pageable pageable = createPageable(page, size);

        Page<LoraEntity> entityPage = loraRepository.findByGroupNameIgnoreCase(
                groupName,
                pageable
        );

        return entityPage.map(LoraResponse::new);

    }


    private String normalizeVersion(String version) {
        if (version == null || version.isBlank()) {
            return "1";
        }

        String normalizedVersion = version.trim();

        if (normalizedVersion.startsWith("v") || normalizedVersion.startsWith("V")) {
            normalizedVersion = normalizedVersion.substring(1).trim();
        }

        if (normalizedVersion.isBlank()) {
            return "1";
        }

        return normalizedVersion;
    }

    private boolean hasFilterValue(String value) {
        return value != null
                && !value.isBlank()
                && !value.equalsIgnoreCase("ALL");
    }

    private void addBaseModelPredicate(
            List<Predicate> predicates,
            String baseModel,
            jakarta.persistence.criteria.Root<LoraEntity> root,
            jakarta.persistence.criteria.CriteriaBuilder criteriaBuilder
    ) {
        if (!hasFilterValue(baseModel)) {
            return;
        }

        predicates.add(
                criteriaBuilder.equal(
                        criteriaBuilder.lower(
                                root.get("baseModel")
                        ),
                        baseModel.toLowerCase()
                )
        );
    }

    private void addCategoryPredicate(
            List<Predicate> predicates,
            LoraCategory category,
            jakarta.persistence.criteria.Root<LoraEntity> root,
            jakarta.persistence.criteria.CriteriaBuilder criteriaBuilder
    ) {
        if (category == null) {
            return;
        }

        predicates.add(
                criteriaBuilder.equal(
                        root.get("category"),
                        category
                )
        );
    }

    private void addSubcategoryPredicate(
            List<Predicate> predicates,
            String subcategory,
            jakarta.persistence.criteria.Root<LoraEntity> root,
            jakarta.persistence.criteria.CriteriaBuilder criteriaBuilder
    ) {
        if (!hasFilterValue(subcategory)) {
            return;
        }

        predicates.add(
                criteriaBuilder.equal(
                        criteriaBuilder.lower(
                                root.get("subCategory")
                        ),
                        subcategory.toLowerCase()
                )
        );
    }

    private Specification<LoraEntity> buildFilterSpecification(
            String baseModel,
            LoraCategory category,
            String subcategory
    ) {
        return (
                root,
                query,
                criteriaBuilder
        ) -> {
            List<Predicate> predicates =
                    new ArrayList<>();

            addBaseModelPredicate(
                    predicates,
                    baseModel,
                    root,
                    criteriaBuilder
            );

            addCategoryPredicate(
                    predicates,
                    category,
                    root,
                    criteriaBuilder
            );

            addSubcategoryPredicate(
                    predicates,
                    subcategory,
                    root,
                    criteriaBuilder
            );

            return criteriaBuilder.and(
                    predicates.toArray(
                            new Predicate[0]
                    )
            );
        };
    }

    private Pageable buildFilterPageable(
            int page,
            int size
    ) {
        int safePage =
                Math.max(page, 0);

        int safeSize =
                Math.min(
                        Math.max(size, 1),
                        36
                );

        return PageRequest.of(
                safePage,
                safeSize,
                Sort.by(
                        Sort.Direction.DESC,
                        "createdDate"
                )
        );
    }
    public Page<LoraResponse> getFilteredLoras(
            String baseModel,
            LoraCategory category,
            String subcategory,
            int page,
            int size
    ) {
        Specification<LoraEntity> specification =
                buildFilterSpecification(
                        baseModel,
                        category,
                        subcategory
                );

        Pageable pageable =
                buildFilterPageable(
                        page,
                        size
                );

        Page<LoraEntity> entityPage =
                loraRepository.findAll(
                        specification,
                        pageable
                );

        return entityPage.map(
                LoraResponse::new
        );
    }
}



