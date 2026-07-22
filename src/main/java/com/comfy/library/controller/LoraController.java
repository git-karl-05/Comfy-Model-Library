package com.comfy.library.controller;

import com.comfy.library.dto.*;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.repository.LoraRepository;
import com.comfy.library.service.LoraService;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/loras")
public class LoraController {

    private final LoraService loraService;

    public LoraController(LoraService loraService) {
        this.loraService = loraService;
    }

    @PostMapping
    public ResponseEntity<LoraResponse> saveLora(@RequestBody CreateLoraRequest loraRequest) {
        return ResponseEntity.ok(loraService.saveLora(loraRequest));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LoraResponse saveLoraWithPreviewImage(
            @ModelAttribute CreateLoraRequest request,
            @RequestParam(required = false)MultipartFile previewImage) {
        return loraService.saveLoraWithPreviewImage(request, previewImage);
    }

    @GetMapping("/{loraId}")
    public ResponseEntity<LoraResponse> getLoraById(@PathVariable long loraId) {
        return ResponseEntity.ok(loraService.getLoraById(loraId));
    }

    @GetMapping
    public ResponseEntity<Page<LoraResponse>> getLoras(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        Page<LoraResponse> response = loraService.getLoras(page,size);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{loraId}")
    public ResponseEntity<LoraResponse> updateLora(@RequestBody UpdateLoraRequest request, @PathVariable Long loraId) {
        return ResponseEntity.ok(loraService.updateLoraById(request, loraId));
    }

    @DeleteMapping("/{loraId}")
    public ResponseEntity<String> deleteLora(@PathVariable Long loraId) {
        return ResponseEntity.ok(loraService.deleteLoraById(loraId));
    }

    @GetMapping("/search")
    public List<LoraResponse> searchLoras(@RequestParam String keyword) {
        return loraService.searchLoras(keyword);
    }

    @GetMapping("/category/{category}")
    public List<LoraResponse> getLorasByCategory(@PathVariable LoraCategory category){
        return loraService.getLorasByCategory(category);
    }

    @GetMapping("/group/{groupName}")
    public List<LoraResponse> getLorasByGroup(@PathVariable String groupName) {
        return loraService.getLorasByGroup(groupName);
    }

    @GetMapping("/favorites")
    public List<LoraResponse> getFavoriteLoras() {
        return loraService.getFavoriteLoras();
    }

    @PutMapping("/{loraId}/favorite")
    public LoraResponse toggleFavorite(@PathVariable Long loraId) {
        return loraService.toggleFavorite(loraId);
    }

    @GetMapping("/sorted/group")
    public List<LoraResponse> getAllLorasSortedByGroupName() {
        return loraService.getAllLorasSortedByGroupname();
    }

    @GetMapping("/categories")
    public List<LoraCategory> getCategories() {
        return loraService.getCategories();
    }

    @PostMapping("/import-folder")
    public ImportSummaryResponse importFolder(@RequestBody ImportFolderRequest request) {
        return loraService.importLorasFromFolder(request.getFolderPath());
    }


}
