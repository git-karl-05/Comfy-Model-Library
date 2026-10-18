package com.comfy.library.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LoraPreviewCacheServiceTests {
    @TempDir Path directory;

    @SuppressWarnings("unchecked")
    private HttpResponse<java.io.InputStream> response(int status, String type, String body) {
        var response = (HttpResponse<java.io.InputStream>) mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("Content-Type", List.of(type)), (a, b) -> true));
        when(response.body()).thenReturn(new ByteArrayInputStream(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        return response;
    }

    private LoraPreviewCacheService cache(HttpClient client) throws Exception {
        var cache = spy(new LoraPreviewCacheService(directory, client));
        doNothing().when(cache).validateRemoteUri(any());
        return cache;
    }

    @Test
    void cachesImageBytesOnceAcrossServiceInstancesAndKeepsSourceUrlsSeparate() throws Exception {
        var client = mock(HttpClient.class);
        var imageResponse = response(200, "image/png", "image bytes");
        var videoResponse = response(200, "video/mp4", "video bytes");
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(imageResponse, videoResponse);
        var cache = cache(client);
        String source = "https://example.com/preview.png?version=1";
        var first = cache.getPreview(source);
        assertEquals("image bytes", Files.readString(first.path()));
        assertEquals("image/png", first.contentType());
        var restarted = cache(client);
        assertEquals(first, restarted.getPreview(source));
        var video = restarted.getPreview("https://example.com/preview.mp4");
        assertNotEquals(first.path(), video.path());
        assertEquals("video/mp4", video.contentType());
        verify(client, times(2)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void rejectsUnsafeSchemesAndPrivateAddresses() {
        var cache = new LoraPreviewCacheService(directory, mock(HttpClient.class));
        for (String url : List.of("file:///etc/passwd", "http://127.0.0.1/test", "http://10.0.0.1/test",
                "http://169.254.169.254/test", "http://[::1]/test", "https://user:password@example.com/test")) {
            assertThrows(IllegalArgumentException.class, () -> cache.getPreview(url), url);
        }
    }

    @Test
    void failedOrNonMediaDownloadsAreNotCachedAndCanBeRetried() throws Exception {
        var client = mock(HttpClient.class);
        var missing = response(404, "image/png", "missing");
        var html = response(200, "text/html", "error page");
        var svg = response(200, "image/svg+xml", "active content");
        var empty = response(200, "image/png", "");
        var success = response(200, "image/png", "success");
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(missing, html, svg, empty, success);
        var cache = cache(client);
        for (int i = 0; i < 4; i++) {
            assertThrows(IOException.class, () -> cache.getPreview("https://example.com/image"));
            try (var paths = Files.list(directory)) { assertEquals(0, paths.count()); }
        }
        assertEquals("success", Files.readString(cache.getPreview("https://example.com/image").path()));
    }

    @Test
    void validatesRedirectTargetsBeforeFollowingThem() throws Exception {
        var client = mock(HttpClient.class);
        var redirect = response(302, "image/png", "");
        when(redirect.headers()).thenReturn(HttpHeaders.of(Map.of("Location", List.of("http://127.0.0.1/private")), (a,b) -> true));
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(redirect);
        var cache = cache(client);
        doThrow(new IllegalArgumentException("private destination")).when(cache).validateRemoteUri(URI.create("http://127.0.0.1/private"));
        assertThrows(IllegalArgumentException.class, () -> cache.getPreview("https://example.com/image"));
        verify(client).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void cachedVideoSupportsRangeRequestsAndBrowserCaching() throws Exception {
        Path video = Files.writeString(directory.resolve("video"), "0123456789");
        var cache = mock(LoraPreviewCacheService.class);
        when(cache.getPreview("https://example.com/video.mp4"))
                .thenReturn(new LoraPreviewCacheService.CachedPreview(video, "video/mp4"));
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
                new com.comfy.library.controller.LoraPreviewController(cache)).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/loras/preview")
                        .param("url", "https://example.com/video.mp4").header("Range", "bytes=2-5"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isPartialContent())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string("2345"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control", "max-age=2592000"));
    }
}
