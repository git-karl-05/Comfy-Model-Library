package com.comfy.library.desktop;

import java.io.*;
import java.nio.file.*;
import java.util.Properties;

public final class DesktopSettings {
    public static final Path HOME = Path.of(System.getProperty("user.home"), "ComfyLibrary");
    private static final Path FILE = HOME.resolve("application.properties");
    public static synchronized Properties load() throws IOException {
        Properties p = new Properties();
        p.setProperty("port", "8080");
        p.setProperty("lan", "true");
        p.setProperty("openBrowser", "false");
        p.setProperty("autoStart", "false");
        Path existingOutput = Path.of(System.getProperty("user.home"), "ComfyUI-Installs", "ComfyUI", "ComfyUI", "output");
        p.setProperty("output", System.getenv().getOrDefault("COMFYUI_OUTPUT_PATH",
                (Files.isDirectory(existingOutput) ? existingOutput : Path.of(System.getProperty("user.home"), "ComfyUI", "output")).toString()));
        if (Files.exists(FILE)) try (var in = Files.newInputStream(FILE)) { p.load(in); }
        return p;
    }
    public static synchronized void save(Properties p) throws IOException {
        Files.createDirectories(HOME);
        Path temp = Files.createTempFile(HOME, "settings-", ".tmp");
        try {
            try (var out = Files.newOutputStream(temp)) { p.store(out, "Comfy Library application settings"); }
            Files.move(temp, FILE, StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp); }
    }
    private DesktopSettings() {}
}
