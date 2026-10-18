package com.comfy.library.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

@Service
public class LoraPreviewCacheService {
    public record CachedPreview(Path path, String contentType) {}
    private static final long MAX_BYTES = 200L * 1024 * 1024;
    private final Path directory;
    private final HttpClient client;
    private final Object[] locks = new Object[32];

    @org.springframework.beans.factory.annotation.Autowired
    public LoraPreviewCacheService(@Value("${lora.upload.path}") String uploadPath) {
        this(Path.of(uploadPath, "preview-cache"), HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build());
    }

    LoraPreviewCacheService(Path directory, HttpClient client) {
        this.directory = directory;
        this.client = client;
        for (int i = 0; i < locks.length; i++) locks[i] = new Object();
    }

    public CachedPreview getPreview(String source) throws IOException, InterruptedException {
        URI uri;
        try { uri = URI.create(source); }
        catch (IllegalArgumentException error) { throw new IllegalArgumentException("Invalid preview URL."); }
        validateScheme(uri);
        String key;
        try {
            key = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
        synchronized (locks[(key.hashCode() & Integer.MAX_VALUE) % locks.length]) {
            Path target = directory.resolve(key);
            Path typeFile = directory.resolve(key + ".type");
            if (Files.isRegularFile(target) && Files.isRegularFile(typeFile)) {
                return new CachedPreview(target, Files.readString(typeFile));
            }
            Files.createDirectories(directory);
            for (int redirect = 0; redirect <= 5; redirect++) {
                validateRemoteUri(uri);
                var response = client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(60))
                        .header("Accept", "image/*,video/*").GET().build(), HttpResponse.BodyHandlers.ofInputStream());
                try (InputStream input = response.body()) {
                    if (response.statusCode() >= 300 && response.statusCode() < 400) {
                        String location = response.headers().firstValue("Location")
                                .orElseThrow(() -> new IOException("Preview redirect has no destination."));
                        uri = uri.resolve(location);
                        continue;
                    }
                    if (response.statusCode() != 200) throw new IOException("Preview source returned HTTP " + response.statusCode());
                    String type = response.headers().firstValue("Content-Type").orElse("").split(";", 2)[0].trim();
                    if (!java.util.Set.of("image/jpeg", "image/png", "image/gif", "image/webp",
                            "image/avif", "image/bmp", "video/mp4", "video/webm", "video/ogg").contains(type)) {
                        throw new IOException("Preview source did not return an image or video.");
                    }
                    if (response.headers().firstValueAsLong("Content-Length").orElse(0) > MAX_BYTES) {
                        throw new IOException("Preview exceeds the 200 MB cache limit.");
                    }
                    Path temporary = Files.createTempFile(directory, key, ".part");
                    try {
                        try (var output = Files.newOutputStream(temporary)) {
                            byte[] buffer = new byte[65536];
                            long total = 0;
                            int length;
                            while ((length = input.read(buffer)) != -1) {
                                total += length;
                                if (total > MAX_BYTES) throw new IOException("Preview exceeds the 200 MB cache limit.");
                                output.write(buffer, 0, length);
                            }
                            if (total == 0) throw new IOException("Preview is empty.");
                        }
                        Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
                        Files.writeString(typeFile, type);
                        return new CachedPreview(target, type);
                    } finally { Files.deleteIfExists(temporary); }
                }
            }
            throw new IOException("Too many preview redirects.");
        }
    }

    private void validateScheme(URI uri) {
        if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Preview URL must use HTTP or HTTPS.");
        }
    }

    void validateRemoteUri(URI uri) throws IOException {
        validateScheme(uri);
        for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
            byte[] bytes = address.getAddress();
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress() || address.isMulticastAddress()
                    || (bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc)) {
                throw new IllegalArgumentException("Preview URL must point to a public host.");
            }
        }
    }
}
