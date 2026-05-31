package com.comfy.library.service;

import com.comfy.library.dto.CreateLoraRequest;
import com.comfy.library.dto.LoraResponse;
import com.comfy.library.dto.UpdateLoraRequest;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LoraService {

    private final LoraRepository loraRepository;

    public LoraService(LoraRepository loraRepository) {
        this.loraRepository = loraRepository;
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
}

