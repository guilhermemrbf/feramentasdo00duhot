FROM debian:bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postfix ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 entrypoint.sh /usr/local/bin/start-postfix
EXPOSE 25
ENTRYPOINT ["/usr/local/bin/start-postfix"]
