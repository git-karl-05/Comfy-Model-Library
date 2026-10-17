package com.comfy.library.service;

import com.comfy.library.entity.PoseEntity;
import com.comfy.library.entity.PoseType;
import com.comfy.library.repository.PoseRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@Service
public class PoseService {
    private final PoseRepository repository;
    private final Path uploadPath;

    public PoseService(PoseRepository repository,
                       @Value("${pose.upload.path:${user.home}/ComfyLibrary/uploads/pose}") String uploadPath) {
        this.repository = repository;
        this.uploadPath = Paths.get(uploadPath);
    }

    public Page<PoseEntity> find(String keyword, String category, Boolean favorite,
                                 int page, int size, String sortBy, String direction) {
        String field = Set.of("name", "category", "seed").contains(sortBy) ? sortBy : "id";
        Sort.Direction order = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(order, field);
        if (!field.equals("id")) sort = sort.and(Sort.by("id"));
        Specification<PoseEntity> filter = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                String escaped = keyword.trim().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                predicates.add(cb.like(cb.lower(root.get("name")), "%" + escaped + "%", '\\'));
            }
            if (category != null && !category.isBlank()) predicates.add(cb.equal(root.get("category"), category));
            if (favorite != null) predicates.add(cb.equal(root.get("favorite"), favorite));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(filter, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)), sort));
    }

    public PoseEntity get(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pose not found"));
    }

    public List<String> categories() {
        return repository.findAll().stream().map(PoseEntity::getCategory)
                .filter(Objects::nonNull).filter(value -> !value.isBlank()).distinct().sorted().toList();
    }

    @Transactional
    public PoseEntity favorite(Long id) {
        PoseEntity pose = get(id);
        pose.setFavorite(!pose.isFavorite());
        return repository.save(pose);
    }

    @Transactional
    public PoseEntity save(Long id, String name, String category, Long seed, String lora,
                           String prompt, String notes, String baseModel, List<String> retained, List<MultipartFile> files) throws IOException {
        if (name == null || name.isBlank() || name.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pose name is required (maximum 255 characters)");
        }
        PoseEntity pose = id == null ? new PoseEntity() : get(id);
        List<String> existing = new ArrayList<>(pose.getImages());
        if (existing.isEmpty() && pose.getFilePath() != null) existing.add(pose.getFilePath());
        if (!existing.containsAll(retained)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid retained images");
        // Validate the entire batch before writing any image.
        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            if (!Set.of("image/png", "image/jpeg", "image/webp", "image/gif").contains(Objects.toString(file.getContentType(), ""))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Supported images: PNG, JPEG, WebP, GIF");
            }
        }
        List<String> images = new ArrayList<>(retained);
        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            String extension = switch (file.getContentType()) {
                case "image/png" -> ".png";
                case "image/jpeg" -> ".jpg";
                case "image/webp" -> ".webp";
                default -> ".gif";
            };
            Files.createDirectories(uploadPath);
            String filename = UUID.randomUUID() + extension;
            try (var input = file.getInputStream()) { Files.copy(input, uploadPath.resolve(filename)); }
            images.add("/uploads/pose/" + filename);
        }
        pose.setName(name.trim());
        pose.setCategory(category);
        pose.setSeed(seed);
        pose.setLora(lora);
        pose.setPrompt(prompt);
        pose.setNotes(notes);
        if (baseModel != null) pose.setBaseModel(baseModel.trim());
        pose.setImages(images);
        pose.setFilePath(images.isEmpty() ? null : images.getFirst());
        pose.setType(PoseType.IMAGE);
        return repository.save(pose);
    }

    public List<PoseEntity> exportBackup() { return repository.findAll(); }

    @Transactional
    public Map<String, Integer> importBackup(List<PoseEntity> poses) {
        if (poses == null) throw new IllegalArgumentException("Pose backup must be an array.");
        int index = 0;
        for (PoseEntity pose : poses) {
            String prefix = "poses[" + index++ + "]";
            if (pose == null || pose.getName() == null || pose.getName().isBlank()) {
                throw new IllegalArgumentException(prefix + ".name is required.");
            }
            validateBackupLength(prefix + ".name", pose.getName());
            validateBackupLength(prefix + ".category", pose.getCategory());
            validateBackupLength(prefix + ".baseModel", pose.getBaseModel());
            validateBackupLength(prefix + ".filePath", pose.getFilePath());
            validateBackupLength(prefix + ".lora", pose.getLora());
            if (pose.getImages() != null) for (String image : pose.getImages()) {
                if (image == null) throw new IllegalArgumentException(prefix + ".images must not contain null.");
                validateBackupLength(prefix + ".images", image);
            }
        }
        for (PoseEntity pose : poses) {
            pose.setId(null);
            if (pose.getImages() == null) pose.setImages(new ArrayList<>());
        }
        repository.saveAllAndFlush(poses);
        return Map.of("importedCount", poses.size());
    }

    private void validateBackupLength(String field, String value) {
        if (value != null && value.length() > 255) throw new IllegalArgumentException(field + " exceeds 255 characters.");
    }
}
