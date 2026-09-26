package com.comfy.library.controller;


import com.comfy.library.dto.BackupRestoreResponse;
import com.comfy.library.dto.LoraBackup;
import com.comfy.library.service.LoraBackupService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


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

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BackupRestoreResponse> importBackup(@RequestBody LoraBackup backup) {
        return ResponseEntity.ok(loraBackupService.restoreBackup(backup));
    }
}
