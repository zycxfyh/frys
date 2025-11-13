# Frys - Multi-stage Docker build for production deployment
# ============================================================================
# This Dockerfile creates a minimal, secure, and optimized container for Frys
# ============================================================================

# -----------------------------------------------------------------------------
# Base stage - Common dependencies and tools
# -----------------------------------------------------------------------------
FROM rust:1.70-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./

# -----------------------------------------------------------------------------
# Dependencies stage - Cache dependencies
# -----------------------------------------------------------------------------
FROM base AS dependencies

# Copy source code
COPY modules/ modules/
COPY src/ src/

# Build dependencies only (for caching)
RUN mkdir -p /app/target && \
    cargo build --release --target-dir /app/target && \
    cargo clean --release --target-dir /app/target

# -----------------------------------------------------------------------------
# Builder stage - Build the application
# -----------------------------------------------------------------------------
FROM dependencies AS builder

# Copy all source code
COPY . .

# Build optimized release binary
RUN cargo build --release --target-dir /app/target

# Strip debug symbols for smaller binary size
RUN strip /app/target/release/frys

# -----------------------------------------------------------------------------
# Runtime stage - Minimal production image
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Create non-root user for security
RUN groupadd -r frys && useradd -r -g frys frys

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/config && \
    chown -R frys:frys /app

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/frys /app/frys

# Copy default configuration
COPY --from=builder /app/config/ /app/config/

# Copy static assets if any
COPY --from=builder /app/static/ /app/static/ 2>/dev/null || true

# Change ownership to non-root user
RUN chown frys:frys /app/frys

# Switch to non-root user
USER frys

# Expose ports
EXPOSE 8080 9090 9443

# Set environment variables
ENV RUST_LOG=info
ENV FRYS_CONFIG_PATH=/app/config
ENV FRYS_DATA_PATH=/app/data
ENV FRYS_LOG_PATH=/app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

# Default command
CMD ["/app/frys", "--config", "/app/config/default.toml"]

# -----------------------------------------------------------------------------
# Debug stage - Development and debugging image
# -----------------------------------------------------------------------------
FROM runtime AS debug

# Switch back to root for installing debug tools
USER root

# Install debug tools
RUN apt-get update && apt-get install -y \
    gdb \
    valgrind \
    strace \
    tcpdump \
    net-tools \
    curl \
    jq \
    vim \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Switch back to frys user
USER frys

# -----------------------------------------------------------------------------
# Testing stage - Image for running tests
# -----------------------------------------------------------------------------
FROM base AS testing

# Copy source code
COPY . .

# Install test dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Set test environment
ENV RUST_TEST_THREADS=1
ENV RUST_BACKTRACE=1

# Default command for running tests
CMD ["cargo", "test", "--release", "--verbose"]

# -----------------------------------------------------------------------------
# Benchmark stage - Image for performance benchmarking
# -----------------------------------------------------------------------------
FROM runtime AS benchmark

# Switch to root for installing benchmark tools
USER root

# Install benchmark tools
RUN apt-get update && apt-get install -y \
    apache2-utils \
    wrk \
    siege \
    vegeta \
    hey \
    && rm -rf /var/lib/apt/lists/*

# Install Go tools for additional benchmarking
RUN curl -L https://go.dev/dl/go1.21.0.linux-amd64.tar.gz | tar -C /usr/local -xzf - && \
    export PATH=$PATH:/usr/local/go/bin && \
    go install github.com/tsenart/vegeta@latest && \
    go install github.com/rakyll/hey@latest

# Switch back to frys user
USER frys

# -----------------------------------------------------------------------------
# CI/CD stage - Image for CI/CD pipelines
# -----------------------------------------------------------------------------
FROM base AS ci

# Install CI/CD tools
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    docker.io \
    docker-compose \
    kubectl \
    helm \
    && rm -rf /var/lib/apt/lists/*

# Copy CI scripts
COPY scripts/ci/ /app/scripts/ci/

# Set working directory for CI
WORKDIR /workspace

# Default command
CMD ["/bin/bash"]

# -----------------------------------------------------------------------------
# Default target - Production runtime
# -----------------------------------------------------------------------------
FROM runtime
