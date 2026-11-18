package com.comfy.library.service;

import com.comfy.library.entity.LoraEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;

final class LoraModelFileRenamer {
    private static final Logger logger = LoggerFactory.getLogger(LoraModelFileRenamer.class);

    private record Move(Path source, Path target) {}

    static void rename(LoraEntity model, String title, ObjectMapper mapper) {
        if (Objects.equals(model.getLoraName(), title) || model.getModelFilePath() == null
                || model.getModelFilePath().isBlank()) return;
        if (title == null || title.isBlank()) throw invalid("LoRA name is required.");
        List<Move> completed = new ArrayList<>();
        Path metadata = null;
        byte[] originalMetadata = null;
        try {
            Path source = Path.of(model.getModelFilePath()).toAbsolutePath().normalize();
            if (!Files.isRegularFile(source, LinkOption.NOFOLLOW_LINKS)) {
                throw conflict("The linked model file is missing or is a symbolic link. Reconnect the model file before renaming it.");
            }
            String filename = source.getFileName().toString();
            int dot = filename.lastIndexOf('.');
            if (dot <= 0) throw invalid("The linked model file has no recognized extension.");
            String extension = filename.substring(dot);
            String stem = title.strip();
            if (stem.toLowerCase(Locale.ROOT).endsWith(extension.toLowerCase(Locale.ROOT))) {
                stem = stem.substring(0, stem.length() - extension.length());
            }
            validateFilename(stem, extension);
            Path target = source.resolveSibling(stem + extension);
            if (filename.equals(target.getFileName().toString())) return;
            checkDestination(source, target);
            metadata = source.resolveSibling(filename.substring(0, dot) + ".metadata.json");
            Path targetMetadata = source.resolveSibling(stem + ".metadata.json");
            byte[] updatedMetadata = null;
            if (Files.exists(metadata, LinkOption.NOFOLLOW_LINKS)) {
                if (!Files.isRegularFile(metadata, LinkOption.NOFOLLOW_LINKS)) throw conflict("The metadata sidecar cannot be renamed.");
                checkDestination(metadata, targetMetadata);
                originalMetadata = Files.readAllBytes(metadata);
                var root = mapper.readTree(originalMetadata);
                if (!(root instanceof ObjectNode object)) throw invalid("The metadata sidecar must contain a JSON object.");
                if (object.has("file_path")) object.put("file_path", target.toString());
                if (object.has("file_name")) {
                    String oldName = object.path("file_name").asText("");
                    object.put("file_name", oldName.toLowerCase(Locale.ROOT).endsWith(extension.toLowerCase(Locale.ROOT))
                            ? target.getFileName().toString() : stem);
                }
                updatedMetadata = mapper.writeValueAsBytes(object);
            } else if (Files.exists(targetMetadata, LinkOption.NOFOLLOW_LINKS)) {
                throw conflict("Metadata already exists for that name. Choose a different title.");
            }
            if (!TransactionSynchronizationManager.isSynchronizationActive()) {
                throw new IllegalStateException("Model file renames require a transaction");
            }
            move(source, target);
            completed.add(new Move(source, target));
            if (updatedMetadata != null) {
                move(metadata, targetMetadata);
                completed.add(new Move(metadata, targetMetadata));
                Files.write(targetMetadata, updatedMetadata);
            }
            Path originalMetadataPath = metadata;
            byte[] metadataBytes = originalMetadata;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        try { restore(completed, originalMetadataPath, metadataBytes); }
                        catch (IOException error) { logger.error("Could not restore model files after a rolled-back rename: {}", source, error); }
                    }
                }
            });
            model.setModelFilePath(target.toString());
        } catch (IOException error) {
            try { restore(completed, metadata, originalMetadata); }
            catch (IOException restoreError) { error.addSuppressed(restoreError); }
            logger.warn("Could not rename model file {}", model.getModelFilePath(), error);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Unable to rename the model file or its metadata. Check file permissions and try again.", error);
        } catch (tools.jackson.core.JacksonException error) {
            throw invalid("The metadata sidecar contains invalid JSON. Fix it before renaming the model.");
        } catch (InvalidPathException error) {
            throw invalid("The linked model path is invalid.");
        }
    }

    private static void validateFilename(String stem, String extension) {
        if (stem.isBlank() || Pattern.compile("[<>:\"/\\\\|?*\\p{Cntrl}]").matcher(stem).find() || stem.endsWith(".") || stem.endsWith(" ")
                || stem.matches("(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\\..*)?") || stem.length() + extension.length() > 255) {
            throw invalid("Use a valid filename for the LoRA title. Avoid reserved names, trailing dots, and characters such as / \\ : * ? \" < > |.");
        }
    }

    private static void checkDestination(Path source, Path target) throws IOException {
        if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)
                && !(source.getFileName().toString().equalsIgnoreCase(target.getFileName().toString()) && Files.isSameFile(source, target))) {
            throw conflict("A file already exists with that name. Choose a different title.");
        }
    }

    private static void move(Path source, Path target) throws IOException {
        if (source.getFileName().toString().equalsIgnoreCase(target.getFileName().toString())) {
            Path temporary = source.resolveSibling(".comfy-rename-" + UUID.randomUUID() + ".tmp");
            Files.move(source, temporary);
            try { Files.move(temporary, target); }
            catch (IOException error) {
                try { Files.move(temporary, source); }
                catch (IOException restoreError) { error.addSuppressed(restoreError); }
                throw error;
            }
        } else Files.move(source, target);
    }

    private static void restore(List<Move> completed, Path metadata, byte[] originalMetadata) throws IOException {
        IOException failure = null;
        for (int i = completed.size() - 1; i >= 0; i--) {
            Move operation = completed.get(i);
            try { move(operation.target(), operation.source()); }
            catch (IOException error) {
                if (failure == null) failure = error;
                else failure.addSuppressed(error);
            }
        }
        if (!completed.isEmpty() && originalMetadata != null && metadata != null && Files.exists(metadata)) {
            try { Files.write(metadata, originalMetadata); }
            catch (IOException error) {
                if (failure == null) failure = error;
                else failure.addSuppressed(error);
            }
        }
        if (failure != null) throw failure;
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
