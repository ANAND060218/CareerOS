#!/bin/bash
echo "Setting up CareerOS DevContainer..."

# Install Backend Dependencies
echo "Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

# Install Frontend Dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "DevContainer setup complete!"
