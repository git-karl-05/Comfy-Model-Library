# Windows desktop installation

Build using JDK 21 and `./packaging/build-windows.ps1 -Type exe`.
The script uses WiX 3 candle.exe/light.exe from PATH or target/wix3. The
portable official tools are available from https://github.com/wixtoolset/wix3/releases/tag/wix3141rtm.
Use `-Type app-image` for a portable folder without WiX. Build output is under
target/windows-<timestamp>. Java is bundled; IntelliJ and a separate Java installation
are not required on the destination computer. The installer is currently unsigned.

## First launch and migration

1. Stop the IntelliJ instance before importing the library (or it will retain the database lock).
2. Run the installer, then start ComfyLibrary from the Start menu.
3. Choose Yes at the import prompt and select the old project folder containing data/comfydb.mv.db.
   Choose No only when you want an empty library.
4. The importer creates a timestamped ZIP backup in ~/ComfyLibrary/data and restores
   into ~/ComfyLibrary/data/comfydb.mv.db. It refuses to overwrite an existing destination.
   An active/locked source database causes import to fail; close the old server and retry.
5. Existing uploads in ~/ComfyLibrary/uploads remain in place. Import on the same Windows
   account. When moving computers, copy that uploads folder as well before launching.

For scripted import before the first launch:
`ComfyLibrary.exe --import-from=C:\path\to\old-project`
Quote the entire argument when its path contains spaces. No migration is performed during build.

## Operation

The tray menu provides Open Library, Settings, Open Logs and Quit. Closing the browser
keeps the server running. A second launch opens the already-running server.
Settings > General > Application includes startup, browser-at-startup, LAN access,
port, ComfyUI output folder selection, and data/log folder shortcuts. Application settings
are saved on the host in ~/ComfyLibrary/application.properties. Desktop controls are
available only through localhost on that computer and are absent during IDE runs.
Network/output changes require quitting via the tray and relaunching.
Startup is off initially. Enabling it registers the packaged executable under the current
user's Windows Run key; launch happens at sign-in, silently unless browser startup is enabled.
Launching manually always opens the browser.

Updates use a stable installer upgrade UUID. Personal data lives outside the install
folder and is retained on uninstall. Disable Start with Windows before uninstalling
(the current installer does not remove the application-created Run value automatically).
Quit the tray instance before upgrading or uninstalling.

## Verification

DesktopTests covers loopback/origin restrictions, input validation, and database backup/import
with preserved records and overwrite refusal. Appearance settings tests cover existing UI.
A smoke test starts the packaged JAR with an isolated database and verifies the Library page and desktop settings over HTTP. Interactive installer/tray/startup/upgrade testing on Windows remains part of release validation.
