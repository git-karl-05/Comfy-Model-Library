package com.comfy.library.controller;

import com.comfy.library.dto.lora.LoraResponse;
import com.comfy.library.repository.LoraRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/loras")
public class LoraArchiveController {
    private final LoraRepository repository;

    public LoraArchiveController(LoraRepository repository) {
        this.repository = repository;
    }

    public record ArchiveRequest(@NotNull Boolean archived) {}

    @GetMapping("/archived")
    public Page<LoraResponse> archived(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "12") int size) {
        return repository.findByArchivedTrue(PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100),
                Sort.by("loraName").ascending().and(Sort.by("id")))).map(LoraResponse::new);
    }

    @PutMapping("/{id}/archive")
    @Transactional
    public LoraResponse archive(@PathVariable Long id, @Valid @RequestBody ArchiveRequest request) {
        var model = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "LoRA not found"));
        if (model.isArchived() != request.archived()) {
            model.setArchived(request.archived());
            model.setLastUpdated(LocalDateTime.now());
        }
        return new LoraResponse(repository.save(model));
    }
}
