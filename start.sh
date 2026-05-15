#!/bin/bash

# FilaMama - File Manager
# Start script for development

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
FILAMAMA_ROOT_PATH="${FILAMAMA_ROOT_PATH:-$HOME}"

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

# Start backend in dev mode
echo "Starting backend on port 5031 (dev mode)..."
cd backend
source venv/bin/activate
FILAMAMA_DEV=1 FILAMAMA_ROOT_PATH="$FILAMAMA_ROOT_PATH" FILAMAMA_PORT=5031 python -m uvicorn app.main:app --host 0.0.0.0 --port 5031 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend on port 5030..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "FilaMama is running!"
echo "  Frontend: http://spark.local:5030"
echo "  Backend:  http://spark.local:5031"
echo "  Root:     $FILAMAMA_ROOT_PATH"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for processes
wait
