#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT_DIR/backend/.venv" ]; then
  python3 -m venv "$ROOT_DIR/backend/.venv"
fi

source "$ROOT_DIR/backend/.venv/bin/activate"
pip install --disable-pip-version-check -r "$ROOT_DIR/backend/requirements.txt"

cd "$ROOT_DIR/frontend"
npm install

echo "CareerOS is ready."
echo "Backend: cd backend && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 5002 --reload"
echo "Frontend: cd frontend && npm run dev"
