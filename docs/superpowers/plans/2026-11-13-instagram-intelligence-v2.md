# Instagram Intelligence 2.0

1. Validate metadata-only production access and confirm the existing queue. Add a server-only Business Discovery adapter with bounded pagination, explicit gaps and safe error codes. Test with isolated HTTP fixtures, then use an authorized credential for a read-only smoke test.
2. Add an atomic Analyze entry point. Reuse the existing queue and automatically resolve connected sources owned by the caller. Preserve legacy batches and authorized file imports.
3. Attach Discovery to a persistent external acquisition queue with leases and bounded retries. Treat ambiguous Meta errors as unavailable and preserve acquisition provenance.
4. Add an audiovisual worker with bounded media downloads and FFmpeg, then validate structured model outputs against actual sampled timestamps. Keep approvals gated by evidence. Test against a small real authorized batch before increasing capacity.
5. Publish only a verified increment. Record production credentials, coverage and open work without including secrets.
