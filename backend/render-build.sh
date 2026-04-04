#!/bin/bash
# render-build.sh
# Build script for Render deployment.
# Installs Tesseract OCR and Poppler system dependencies,
# then installs Node.js packages.

echo "Installing system dependencies..."
apt-get update -y
apt-get install -y tesseract-ocr poppler-utils

echo "Installing Node packages..."
npm install

echo "Build complete."