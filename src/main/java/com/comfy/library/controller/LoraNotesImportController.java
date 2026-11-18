package com.comfy.library.controller;

import com.comfy.library.service.LoraNotesImportService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.*;

@RestController
@RequestMapping("/api/loras/notes-import")
public class LoraNotesImportController {
    private final LoraNotesImportService service;

    public LoraNotesImportController(LoraNotesImportService service) {
        this.service = service;
    }

    @PostMapping(consumes = "multipart/form-data")
    public LoraNotesImportService.Summary importNotes(@RequestParam("file") MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        Charset charset = StandardCharsets.UTF_8;
        if (bytes.length >= 2 && ((bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xfe)
                || (bytes[0] == (byte) 0xfe && bytes[1] == (byte) 0xff))) charset = StandardCharsets.UTF_16;
        try {
            String text = charset.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
            if (text.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The notes file is empty");
            return service.importNotes(text);
        } catch (CharacterCodingException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Save the notes file as UTF-8 or UTF-16 text");
        }
    }
}
