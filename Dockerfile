FROM node:22-bookworm-slim AS web-builder

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM golang:1.25-bookworm AS go-builder

WORKDIR /src

COPY server/go.mod server/go.sum ./server/
WORKDIR /src/server
RUN go mod download

COPY server ./ 
COPY --from=web-builder /workspace/server/resource ./resource

ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

RUN go build -tags headless -trimpath -ldflags "-s -w" -o /out/trpg-note .


FROM debian:bookworm-slim

RUN useradd --system --create-home --uid 10001 appuser

WORKDIR /app

COPY --from=go-builder /out/trpg-note /app/trpg-note

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

ENV BTR_PORT=8080
ENV BTR_DB_PATH=/app/data/storage.db

EXPOSE 8080
VOLUME ["/app/data"]

ENTRYPOINT ["/app/trpg-note"]
