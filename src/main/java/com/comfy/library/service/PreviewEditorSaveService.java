package com.comfy.library.service;

import com.comfy.library.dto.lora.*;
import com.comfy.library.entity.*;
import com.comfy.library.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.io.IOException;
import java.util.*;

@Service
public class PreviewEditorSaveService {
    private final PreviewManifestService manifests;
    private final LoraService loras;
    private final LoraRepository loraRepository;
    private final LoraImageRepository images;
    private final PoseService poses;
    private final PoseRepository poseRepository;
    public PreviewEditorSaveService(PreviewManifestService manifests, LoraService loras,
            LoraRepository loraRepository, LoraImageRepository images, PoseService poses, PoseRepository poseRepository) {
        this.manifests = manifests; this.loras = loras; this.loraRepository = loraRepository;
        this.images = images; this.poses = poses; this.poseRepository = poseRepository;
    }
    @Transactional(rollbackFor = Exception.class)
    public LoraResponse saveLora(Long id, CreateLoraRequest create, UpdateLoraRequest update,
            String manifest, List<MultipartFile> uploads) throws IOException {
        Map<String, String> owned = new LinkedHashMap<>();
        LoraEntity entity = id == null ? null : loraRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "LoRA not found"));
        if (entity != null) {
            if (entity.getFilePath() != null) owned.put("primary", entity.getFilePath());
            images.findByLoraIdOrderByIdAsc(id).forEach(image -> owned.put(image.getId().toString(), image.getFilePath()));
        }
        List<String> paths = manifests.resolve(manifest, owned, uploads, true);
        if (entity == null) {
            LoraResponse saved = loras.saveLoraWithPreviewImage(create, null);
            entity = loraRepository.findById(saved.getId()).orElseThrow();
        } else loras.updateLoraWithPreviewById(id, update, null);
        entity.setFilePath(paths.isEmpty() ? null : paths.getFirst());
        images.deleteAll(images.findByLoraIdOrderByIdAsc(entity.getId()));
        images.flush();
        for (int i = 1; i < paths.size(); i++) images.save(new LoraImageEntity(paths.get(i), entity));
        loraRepository.saveAndFlush(entity); images.flush();
        return new LoraResponse(entity);
    }
    @Transactional(rollbackFor = Exception.class)
    public PoseEntity savePose(Long id, String name, String category, Long seed, String lora, String prompt,
            String notes, String baseModel, String manifest) throws IOException {
        List<String> existing = new ArrayList<>();
        if (id != null) {
            PoseEntity pose = poses.get(id);
            existing.addAll(pose.getImages());
            if (existing.isEmpty() && pose.getFilePath() != null) existing.add(pose.getFilePath());
        }
        Map<String, String> owned = new LinkedHashMap<>();
        for (int i = 0; i < existing.size(); i++) owned.put(String.valueOf(i), existing.get(i));
        List<String> paths = manifests.resolve(manifest, owned, List.of(), false);
        PoseEntity saved = poses.save(id, name, category, seed, lora, prompt, notes, baseModel, existing, List.of(), null);
        saved.setImages(new ArrayList<>(paths));
        saved.setFilePath(paths.isEmpty() ? null : paths.getFirst());
        saved.setType(!paths.isEmpty() && paths.getFirst().matches("(?i).*\\.(mp4|webm|mov|ogg)([?#].*)?$") ? PoseType.VIDEO : PoseType.IMAGE);
        return poseRepository.saveAndFlush(saved);
    }
}
