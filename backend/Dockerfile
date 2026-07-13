FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# Install system dependencies (needed for compiling some packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Download offline GeoIP database
RUN python download_db.py

# Expose port
EXPOSE 8000

# Run database migrations and start uvicorn
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
