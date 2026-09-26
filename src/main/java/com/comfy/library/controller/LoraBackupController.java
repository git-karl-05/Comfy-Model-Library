package com.comfy.library.controller;


import com.comfy.library.dto.LoraBackup;
import com.comfy.library.service.LoraBackupService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/backup")
public class LoraBackupController {

    private final LoraBackupService loraBackupService;

    public LoraBackupController(LoraBackupService loraBackupService) {
        this.loraBackupService = loraBackupService;
    }


    @GetMapping("/export")
    public ResponseEntity<LoraBackup> exportBackup() {

        LoraBackup backup = loraBackupService.exportBackup();

        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"comfy-model-library-backup.json\""
                )
                .contentType(MediaType.APPLICATION_JSON)
                .body(backup);
    }
}
