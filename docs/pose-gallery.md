# Pose gallery

The application serves HTML, CSS, and deferred JavaScript through Spring Boot.
There is no browser package manager or bundler. Shared scripts handle gallery
sorting, pagination, return navigation, appearance settings, media, and gestures;
`poses.js` supplies pose-specific rendering and actions.

Pose data is handled by `PoseController`, `PoseService`, and `PoseRepository`.
Adding and editing poses opens the standalone form pages. Preview selection
browses the server's ComfyUI output directory, configured by `COMFYUI_OUTPUT_PATH`.
