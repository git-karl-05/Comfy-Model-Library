package com.comfy.library.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = {LoraController.class, PoseController.class})
public class PreviewEditorExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> invalidPreview(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(error.getReason());
    }
}
