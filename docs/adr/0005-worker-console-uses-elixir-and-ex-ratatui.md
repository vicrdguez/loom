# Worker Console Uses Elixir/OTP and ExRatatui

The Worker console will be an Elixir/OTP application using ExRatatui for its full-screen terminal
interface and distributed as target-specific standard Mix releases that include ERTS. Each release
publishes dedicated platform artifacts containing the public `loom` executable, separate from the
source archive that carries Loom's skills. Running `loom` without arguments opens the Worker
console for the current project. Elixir was chosen over Go because supervision, retries, and
isolated Role lanes are the console's central complexity and an Elixir coordinator prototype
already exists; ExRatatui closes the UI gap with Markdown, input, layout, and headless testing
support. This accepts a younger Rust-NIF dependency and more release-matrix work in exchange for
keeping the core lifecycle model native to OTP; Burrito is deferred because its self-extracting
packaging remains experimental.
