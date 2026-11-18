package com.comfy.library.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.DeserializationFeature;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/** Resolves a complete pending preview list, with file cleanup tied to the save transaction. */
@Service
public class PreviewManifestService {
    public record Entry(String key, String source, String ref, String path, Integer uploadIndex) {}
    public record Manifest(List<Entry> entries, String defaultKey) {}
    private final ObjectMapper mapper;
    private final ComfyOutputService output;
    private final Path loraPath, posePath;
    public PreviewManifestService(ObjectMapper mapper, ComfyOutputService output,
            @Value("${lora.upload.path}") String loraPath, @Value("${pose.upload.path:${user.home}/ComfyLibrary/uploads/pose}") String posePath) {
        this.mapper = mapper; this.output = output;
        this.loraPath = Path.of(loraPath); this.posePath = Path.of(posePath);
    }
    private ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preview list: " + message);
    }
    public List<String> resolve(String json, Map<String, String> owned, List<MultipartFile> uploads, boolean lora) throws IOException {
        Manifest manifest;
        try {
            manifest = mapper.readerFor(Manifest.class).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                    DeserializationFeature.FAIL_ON_TRAILING_TOKENS).without(DeserializationFeature.ACCEPT_FLOAT_AS_INT).readValue(json);
        } catch (RuntimeException error) { throw invalid("invalid JSON structure"); }
        if (manifest == null || manifest.entries() == null) throw invalid("entries are required");
        // Preserve oversized legacy collections while preventing new additions beyond five.
        if (manifest.entries().size() > Math.max(5, owned.size())) throw invalid("a maximum of 5 previews is allowed");
        Set<String> keys = new HashSet<>(), refs = new HashSet<>();
        Set<Integer> usedUploads = new HashSet<>();
        List<Path> sources = new ArrayList<>();
        List<String> extensions = new ArrayList<>();
        Map<String, String> types = Map.of("image/png", ".png", "image/jpeg", ".jpg", "image/webp", ".webp",
                "image/gif", ".gif", "video/mp4", ".mp4", "video/webm", ".webm", "video/quicktime", ".mov", "video/ogg", ".ogg");
        for (Entry entry : manifest.entries()) {
            if (entry == null || entry.key() == null || entry.key().isBlank() || !keys.add(entry.key()))
                throw invalid("each slot needs a unique key");
            Path source = null; String extension = null;
            if ("existing".equals(entry.source())) {
                if (!owned.containsKey(entry.ref()) || !refs.add(entry.ref())) throw invalid("invalid or repeated retained preview");
                if (entry.path() != null && !entry.path().equals(owned.get(entry.ref()))) throw invalid("retained preview changed; reload the form");
            } else if ("output".equals(entry.source())) {
                if (entry.path() == null || entry.path().isBlank()) throw invalid("output path is required");
                source = output.image(entry.path());
                extension = source.getFileName().toString().substring(source.getFileName().toString().lastIndexOf('.')).toLowerCase(Locale.ROOT);
            } else if ("upload".equals(entry.source()) && lora) {
                Integer index = entry.uploadIndex();
                if (index == null || index < 0 || index >= uploads.size() || !usedUploads.add(index)) throw invalid("invalid upload reference");
                MultipartFile file = uploads.get(index);
                extension = types.get(Objects.toString(file.getContentType(), ""));
                if (file.isEmpty() || extension == null) throw invalid("unsupported or empty uploaded media");
            } else throw invalid("unsupported preview source");
            sources.add(source); extensions.add(extension);
        }
        if ((!keys.isEmpty() && !keys.contains(manifest.defaultKey())) || (keys.isEmpty() && manifest.defaultKey() != null))
            throw invalid("default must identify an existing slot");
        if (usedUploads.size() != uploads.size()) throw invalid("unreferenced uploaded files");
        if (!TransactionSynchronizationManager.isSynchronizationActive()) throw new IllegalStateException("Preview save requires a transaction");
        List<Path> created = new ArrayList<>();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) for (Path file : created) {
                    try { Files.deleteIfExists(file); }
                    catch (IOException error) { org.slf4j.LoggerFactory.getLogger(PreviewManifestService.class).warn("Could not clean up preview {}", file, error); }
                }
            }
        });
        Path directory = lora ? loraPath : posePath;
        List<String> paths = new ArrayList<>();
        int defaultIndex = -1;
        for (int i = 0; i < manifest.entries().size(); i++) {
            Entry entry = manifest.entries().get(i);
            if (entry.key().equals(manifest.defaultKey())) defaultIndex = i;
            if ("existing".equals(entry.source())) { paths.add(owned.get(entry.ref())); continue; }
            Files.createDirectories(directory);
            String name = UUID.randomUUID() + extensions.get(i);
            Path destination = directory.resolve(name);
            created.add(destination); // Register before writing, including partially copied files.
            if (sources.get(i) != null) Files.copy(sources.get(i), destination);
            else try (var input = uploads.get(entry.uploadIndex()).getInputStream()) { Files.copy(input, destination); }
            paths.add((lora ? "/uploads/lora/" : "/uploads/pose/") + name);
        }
        if (defaultIndex > 0) paths.add(0, paths.remove(defaultIndex));
        return paths;
    }
}
