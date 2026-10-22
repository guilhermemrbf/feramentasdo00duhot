# Architecture rules
- Keep batch metadata cleaning browser-local in isolated media helpers and a dedicated section below the existing individual tool; user media must never leave the device.
- Use a single FFmpeg WASM worker for stream-copy video cleaning and sequential ZIP writes; terminate the worker on cancellation and release per-file resources.