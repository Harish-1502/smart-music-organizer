FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Container-internal 0.0.0.0 is required for Docker port publishing.
# Bind published host ports to 127.0.0.1 by default; LAN exposure should be an
# explicit opt-in and requires API_AUTH_TOKEN.
CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
