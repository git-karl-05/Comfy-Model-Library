package com.comfy.library.desktop;

import com.comfy.library.ComfyLibraryMainApplication;
import org.springframework.boot.SpringApplication;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.net.URI;
import java.nio.channels.*;
import java.nio.file.*;
import java.util.*;
import javax.swing.JOptionPane;

public final class DesktopLauncher {
    private static void browse(String url) {
        try { Desktop.getDesktop().browse(URI.create(url)); }
        catch (Exception e) { JOptionPane.showMessageDialog(null, "Open " + url + " in your browser."); }
    }
    static void importDatabase(Path source, Path home) throws Exception {
        Path target = home.resolve("data/comfydb.mv.db");
        if (Files.exists(target)) throw new IllegalStateException("A library already exists. Import will not overwrite it.");
        Path database = source.toAbsolutePath().resolve("data/comfydb");
        if (!Files.isRegularFile(Path.of(database + ".mv.db"))) throw new IllegalArgumentException("No database found in " + source);
        Path backup = home.resolve("data/legacy-backup-" + System.currentTimeMillis() + ".zip");
        try (var connection = java.sql.DriverManager.getConnection("jdbc:h2:file:" + database.toString().replace('\\', '/') + ";IFEXISTS=TRUE", "sa", "");
             var statement = connection.createStatement()) {
            statement.execute("BACKUP TO '" + backup.toString().replace("'", "''") + "'");
        }
        try (var zip = new java.util.zip.ZipInputStream(Files.newInputStream(backup))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) if (entry.getName().endsWith(".mv.db")) {
                Files.copy(zip, target); return;
            }
        }
        throw new IllegalStateException("Database backup contained no database");
    }
    public static void main(String[] args) {
        System.setProperty("java.awt.headless", "false");
        try {
            Files.createDirectories(DesktopSettings.HOME.resolve("data"));
            Files.createDirectories(DesktopSettings.HOME.resolve("logs"));
            var settings = DesktopSettings.load();
            String url = "http://127.0.0.1:" + settings.getProperty("port") + "/html/index.html";
            var channel = FileChannel.open(DesktopSettings.HOME.resolve("desktop.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
            var lock = channel.tryLock();
            if (lock == null) {
                channel.close();
                Path running = DesktopSettings.HOME.resolve("running-url.txt");
                browse(Files.exists(running) ? Files.readString(running) : url); return;
            }
            for (String arg : args) if (arg.startsWith("--import-from=")) {
                importDatabase(Path.of(arg.substring("--import-from=".length())), DesktopSettings.HOME);
            }
            if (!Files.exists(DesktopSettings.HOME.resolve("data/comfydb.mv.db"))) {
                int choice = JOptionPane.showConfirmDialog(null,
                        "Import an existing Comfy Library?\nChoose Yes and select the old project folder, or No to start a new library.",
                        "Set up Comfy Library", JOptionPane.YES_NO_CANCEL_OPTION);
                if (choice == JOptionPane.CANCEL_OPTION || choice == JOptionPane.CLOSED_OPTION) { lock.release(); channel.close(); return; }
                if (choice == JOptionPane.YES_OPTION) {
                    var picker = new javax.swing.JFileChooser(); picker.setFileSelectionMode(javax.swing.JFileChooser.DIRECTORIES_ONLY);
                    if (picker.showOpenDialog(null) != javax.swing.JFileChooser.APPROVE_OPTION) { lock.release(); channel.close(); return; }
                    importDatabase(picker.getSelectedFile().toPath(), DesktopSettings.HOME);
                }
            }
            var app = new SpringApplication(ComfyLibraryMainApplication.class);
            app.setHeadless(false);

            // System properties override development configuration without changing IDE runs.
            System.setProperty("comfy.desktop", "true");
            System.setProperty("server.port", settings.getProperty("port"));
            System.setProperty("server.address", Boolean.parseBoolean(settings.getProperty("lan")) ? "0.0.0.0" : "127.0.0.1");
            System.setProperty("spring.datasource.url", "jdbc:h2:file:" + DesktopSettings.HOME.resolve("data/comfydb").toString().replace('\\', '/'));
            System.setProperty("spring.h2.console.enabled", "false");
            System.setProperty("spring.jpa.show-sql", "false");
            System.setProperty("logging.file.name", DesktopSettings.HOME.resolve("logs/application.log").toString());
            if (!settings.getProperty("output").isBlank()) System.setProperty("comfyui.output.path", settings.getProperty("output"));
            var context = app.run();
            Files.writeString(DesktopSettings.HOME.resolve("running-url.txt"), url);
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                context.close();
                try { lock.release(); channel.close(); } catch (Exception ignored) { }
            }));
            if (!SystemTray.isSupported()) {
                context.close();
                throw new IllegalStateException("Windows system tray is unavailable.");
            }
            var image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
            var g = image.createGraphics();
            g.setColor(new Color(124, 77, 255)); g.fillRoundRect(0, 0, 32, 32, 8, 8);
            g.setColor(Color.WHITE); g.setFont(new Font("SansSerif", Font.BOLD, 24)); g.drawString("C", 7, 25); g.dispose();
            var menu = new PopupMenu();
            var open = new MenuItem("Open Library"); open.addActionListener(e -> browse(url)); menu.add(open);
            var preferences = new MenuItem("Settings"); preferences.addActionListener(e -> browse(url + "#application-settings")); menu.add(preferences);
            var logs = new MenuItem("Open Logs"); logs.addActionListener(e -> {
                try { Desktop.getDesktop().open(DesktopSettings.HOME.resolve("logs").toFile()); } catch (Exception ignored) { }
            }); menu.add(logs);
            menu.addSeparator();
            var quit = new MenuItem("Quit"); quit.addActionListener(e -> System.exit(0)); menu.add(quit);
            var icon = new TrayIcon(image, "Comfy Library", menu); icon.setImageAutoSize(true);
            icon.addActionListener(e -> browse(url)); SystemTray.getSystemTray().add(icon);
            boolean startup = Arrays.asList(args).contains("--startup");
            if (!startup || Boolean.parseBoolean(settings.getProperty("openBrowser"))) browse(url);
        } catch (Exception e) {
            JOptionPane.showMessageDialog(null, "Comfy Library could not start: " + e.getMessage() + "\nCheck ~/ComfyLibrary/logs/application.log", "Comfy Library", JOptionPane.ERROR_MESSAGE);
            System.exit(1);
        }
    }
}
