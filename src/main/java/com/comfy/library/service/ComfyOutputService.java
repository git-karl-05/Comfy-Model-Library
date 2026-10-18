package com.comfy.library.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@Service
public class ComfyOutputService {
    public record Entry(String name, String path, boolean directory, long modified, long created, boolean video, Long contentCount) {}
    public record Listing(String folder, List<Entry> entries, int page, boolean hasMore, long totalMedia, long mediaOffset, List<Entry> folders, Map<String, Long> dayCounts) {}
    private final Path root;
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp", "gif");
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "webm", "mov", "ogg");

    public ComfyOutputService(@Value("${comfyui.output.path:}") String path) {
        root = path.isBlank() ? null : Path.of(path).toAbsolutePath().normalize();
    }
    private Path root() throws IOException {
        if (root == null || !Files.isDirectory(root)) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "ComfyUI output folder is unavailable. Check comfyui.output.path on the server.");
        return root.toRealPath();
    }
    Path resolve(String relative) throws IOException {
        Path base = root();
        Path candidate;
        try { candidate = base.resolve(relative == null ? "" : relative).normalize(); }
        catch (InvalidPathException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid output path"); }
        if (!candidate.startsWith(base)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Path is outside the ComfyUI output folder");
        if (!Files.exists(candidate)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Output file or folder no longer exists");
        Path real = candidate.toRealPath();
        if (!real.startsWith(base)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Path is outside the ComfyUI output folder");
        return real;
    }
    private String extension(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
    public boolean isVideo(Path path) { return VIDEO_EXTENSIONS.contains(extension(path)); }
    private boolean supported(Path path) {
        return IMAGE_EXTENSIONS.contains(extension(path)) || isVideo(path);
    }
    private String folderKind(Path base, Path directory) {
        for (Path part : base.relativize(directory)) {
            String name = part.toString().toLowerCase(Locale.ROOT);
            if (Set.of("video", "videos").contains(name)) return "video";
            if (Set.of("image", "images").contains(name)) return "image";
        }
        return "all";
    }
    public Path image(String relative) throws IOException {
        Path file = resolve(relative);
        if (!Files.isRegularFile(file) || !supported(file)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Choose a PNG, JPEG, WebP, GIF, MP4, WebM, MOV or OGG file");
        long limit = isVideo(file) ? 200L * 1024 * 1024 : 25L * 1024 * 1024;
        if (Files.size(file) > limit) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                isVideo(file) ? "Video exceeds the 200 MB limit" : "Image exceeds the 25 MB limit");
        return file;
    }
    public String contentType(Path file) {
        return switch (extension(file)) {
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "mov" -> "video/quicktime";
            case "ogg" -> "video/ogg";
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            default -> "image/gif";
        };
    }
    private Long contentCount(Path base, Path directory) {
        String kind = folderKind(base, directory);
        try (var stream = Files.list(directory)) {
            return stream.filter(path -> !Files.isSymbolicLink(path))
                    .filter(path -> Files.isDirectory(path) || (Files.isRegularFile(path) && supported(path)
                            && (kind.equals("all") || (kind.equals("video") == isVideo(path)))))
                    .count();
        } catch (IOException | SecurityException error) {
            return null;
        }
    }
    public Listing list(String folder, int page) throws IOException {
        return list(folder, page, "recent", "all");
    }
    public Listing list(String folder, int page, String sort, String media) throws IOException {
        return list(folder, page, sort, media, "UTC");
    }
    public Listing list(String folder, int page, String sort, String media, String timeZone) throws IOException {
        java.time.ZoneId zone;
        try { zone = java.time.ZoneId.of(timeZone); }
        catch (java.time.DateTimeException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid time zone"); }
        if (!Set.of("recent", "name", "name-desc", "created", "created-asc", "modified", "modified-asc").contains(sort) || !Set.of("all", "image", "video").contains(media))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sort or media filter");
        if (page < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page");
        Path base = root(), directory = resolve(folder);
        if (!Files.isDirectory(directory)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an output folder");
        String kind = folderKind(base, directory);
        List<Entry> entries = new ArrayList<>();
        try (var stream = Files.list(directory)) {
            for (Path path : stream.toList()) {
                if (Files.isSymbolicLink(path)) continue;
                boolean isDirectory = Files.isDirectory(path);
                boolean matchesKind = kind.equals("all") || (kind.equals("video") == isVideo(path));
                if (isDirectory || (Files.isRegularFile(path) && supported(path) && matchesKind && (media.equals("all") || (media.equals("video") == isVideo(path))))) {
                    entries.add(new Entry(path.getFileName().toString(), base.relativize(path).toString().replace('\\', '/'),
                            isDirectory, Files.getLastModifiedTime(path).toMillis(), Files.readAttributes(path, java.nio.file.attribute.BasicFileAttributes.class).creationTime().toMillis(), !isDirectory && isVideo(path), isDirectory ? contentCount(base, path) : null));
                }
            }
        }
        Comparator<Entry> names = Comparator.comparing(Entry::name, String.CASE_INSENSITIVE_ORDER).thenComparing(Entry::name);
        Comparator<Entry> order = sort.equals("name") ? names : sort.equals("name-desc") ? names.reversed()
                : sort.equals("created") ? Comparator.comparingLong(Entry::created).reversed().thenComparing(names)
                : sort.equals("created-asc") ? Comparator.comparingLong(Entry::created).thenComparing(names)
                : sort.equals("modified-asc") ? Comparator.comparingLong(Entry::modified).thenComparing(names)
                : Comparator.comparingLong(Entry::modified).reversed().thenComparing(names);
        entries.sort(Comparator.comparing(Entry::directory).reversed().thenComparing(order));
        List<Entry> folders = entries.stream().filter(Entry::directory).toList();
        Comparator<Entry> dateGroups = Comparator.comparing((Entry entry) -> java.time.Instant.ofEpochMilli(entry.created())
                .atZone(zone).toLocalDate());
        if (!sort.equals("created-asc")) dateGroups = dateGroups.reversed();
        List<Entry> mediaEntries = entries.stream().filter(entry -> !entry.directory())
                .sorted(dateGroups.thenComparing(order)).toList();
        int from = (int)Math.min((long)page * 36, mediaEntries.size());
        int to = Math.min(from + 36, mediaEntries.size());
        return new Listing(base.relativize(directory).toString().replace('\\', '/'), mediaEntries.subList(from, to),
                page, to < mediaEntries.size(), mediaEntries.size(), from, folders,
                mediaEntries.stream().collect(java.util.stream.Collectors.groupingBy(
                        entry -> java.time.Instant.ofEpochMilli(entry.created()).atZone(zone).toLocalDate().toString(),
                        java.util.stream.Collectors.counting())));
    }
    public String copyImage(String relative, Path destination) throws IOException {
        Path source = image(relative);
        String name = source.getFileName().toString();
        String filename = UUID.randomUUID() + name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        Files.createDirectories(destination);
        Files.copy(source, destination.resolve(filename));
        return "/uploads/pose/" + filename;
    }
}
