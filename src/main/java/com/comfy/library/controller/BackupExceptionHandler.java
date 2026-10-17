package com.comfy.library.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.dao.DataIntegrityViolationException;
import tools.jackson.core.JacksonException;

@RestControllerAdvice(assignableTypes = {LoraBackupController.class, PoseController.class})
public class BackupExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, JacksonException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<String> invalidBackup(Exception error) {
        return ResponseEntity.badRequest().body("Invalid backup: " + error.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> invalidRecord(DataIntegrityViolationException error) {
        return ResponseEntity.badRequest().body("Backup contains data that cannot be stored. No records were imported. Check field lengths and required values.");
    }
}
