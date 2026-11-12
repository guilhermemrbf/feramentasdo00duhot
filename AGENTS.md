# Architecture rules
- Keep batch metadata cleaning browser-local in isolated media helpers and a dedicated section below the existing individual tool; user media must never leave the device.
- Use a single FFmpeg WASM worker for stream-copy video cleaning and sequential ZIP writes; terminate the worker on cancellation and release per-file resources.
- Keep tool destinations and descriptions in the shared catalog so home, navigation, search and saved tool IDs stay consistent; retired tool URLs use route redirects.
- Keep tool photography and task labels in a browser-safe shared visual map; reuse it in the catalog and tool headers so presentation stays consistent without touching processing or publishing logic.