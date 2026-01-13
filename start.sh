#!/bin/bash

# FilaMama - File Manager
# Start script for development

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "Starting FilaMama..."

# Check if Python venv exists, create if not
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv backend/venv
fi

# Activate venv and install dependencies
echo "Installing backend dependencies..."
source backend/venv/bin/activate
pip install -q -r backend/requirements.txt

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Create data directory if needed
mkdir -p data/files
mkdir -p data/thumbnails

# Function to cleanup on exit
cleanup() {
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting backend on port 5101..."
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 5101 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend on port 5100..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "FilaMama is running!"
echo "  Frontend: http://spark.local:5100"
echo "  Backend:  http://spark.local:5101"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for processes
wait
