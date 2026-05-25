FROM node:20-slim AS frontend-build

ARG VITE_API_AUTH_TOKEN=""
ENV VITE_API_AUTH_TOKEN=${VITE_API_AUTH_TOKEN}

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --include=dev --dry-run=false

COPY frontend/ ./
RUN rm -rf dist
RUN test -f node_modules/.bin/vite
RUN npm run build --dry-run=false
RUN test -f /app/frontend/dist/index.html


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/backend/data /music

EXPOSE 8000

# Container-internal 0.0.0.0 is required for Docker port publishing.
# docker-compose.yml binds the host port to 127.0.0.1 by default; exposing this
# on 0.0.0.0/LAN should only be done deliberately with API_AUTH_TOKEN set.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
