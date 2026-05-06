# Stage 1: Build frontend
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


# Stage 2: Production image
FROM python:3.12-slim

# System dependencies: ffmpeg, libmagic, cairo/pango (for cairosvg), ripgrep
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libmagic1 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app ./app
COPY backend/config.docker.yaml ./config.yaml

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create data directory for thumbnails and transcoding cache
RUN mkdir -p /data/thumbnails /data/transcoded

# Environment defaults for Docker
ENV FILAMAMA_CONFIG=/app/config.yaml
ENV FILAMAMA_ROOT_PATH=/browse
ENV FILAMAMA_DATA_DIR=/data
ENV FILAMAMA_FRONTEND_DIST=/app/frontend/dist
ENV FILAMAMA_ALLOW_INSECURE=true

EXPOSE 1031

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "1031"]
