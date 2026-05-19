FROM alpine:3.22

ARG TARGETARCH

WORKDIR /app

RUN addgroup -S app && adduser -S -G app -u 10001 appuser

COPY .docker-bin/ /tmp/docker-bin/

RUN cp "/tmp/docker-bin/trpg-note-${TARGETARCH}" /app/trpg-note && \
    chmod +x /app/trpg-note && \
    rm -rf /tmp/docker-bin && \
    mkdir -p /app/data && \
    chown -R appuser:app /app

USER appuser

ENV BTR_PORT=8080
ENV BTR_DB_PATH=/app/data/storage.db

EXPOSE 8080
VOLUME ["/app/data"]

ENTRYPOINT ["/app/trpg-note"]
