# Dockerfile
# Production container for SurakshID backend.
# Installs Tesseract OCR and Poppler as system dependencies,
# then installs Node packages and starts the Express server.

FROM node:22-slim

# Install system dependencies as root
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy rest of the source code
COPY . .

# Create required directories
RUN mkdir -p uploads reports

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]