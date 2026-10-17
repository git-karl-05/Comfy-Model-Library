package com.comfy.library.controller;


import com.comfy.library.dto.lora.BackupRestoreResponse;
import com.comfy.library.dto.lora.LoraBackup;
import com.comfy.library.service.LoraBackupService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.DeserializationFeature;
import java.io.IOException;


@RestController
@RequestMapping("/api/backup")
public class LoraBackupController {

    private final LoraBackupService loraBackupService;
    private final ObjectMapper mapper;

    public LoraBackupController(LoraBackupService loraBackupService, ObjectMapper mapper) {
        this.loraBackupService = loraBackupService;
        this.mapper = mapper;
    }


    @GetMapping("/export")
    public ResponseEntity<LoraBackup> exportBackup() {

        LoraBackup backup = loraBackupService.exportBackup();

        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"comfy-model-library-backup.json\""
                )
                .contentType(MediaType.APPLICATION_JSON)
                .body(backup);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BackupRestoreResponse> importBackup(jakarta.servlet.http.HttpServletRequest request) throws IOException {
        return readBackup(request.getInputStream());
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BackupRestoreResponse> importBackupFile(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("Backup file is empty.");
        // Read directly from the upload stream; do not parse numbers in JavaScript.
        try (var input = file.getInputStream()) {
            return readBackup(input);
        }
    }

    private ResponseEntity<BackupRestoreResponse> readBackup(java.io.InputStream input) {
        LoraBackup backup = mapper.readerFor(LoraBackup.class)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS,
                        DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .without(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .readValue(input);
        return ResponseEntity.ok(loraBackupService.restoreBackup(backup));
    }
}
