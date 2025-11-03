#!/bin/bash

# Start Worker with ngrok
# This runs the worker locally and exposes it via ngrok

set -e

echo "🚀 Starting Email Sorter Worker with ngrok..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "📝 Copy .env.example to .env and configure:"
    echo "   cp .env.example .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Prisma client is generated
if [ ! -d node_modules/.prisma ]; then
    echo "🔧 Generating Prisma client..."
    npx prisma generate
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found!"
    echo "📥 Install ngrok:"
    echo "   brew install ngrok"
    echo "   or download from: https://ngrok.com/download"
    exit 1
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "Starting worker on port 3001..."
echo "Starting ngrok tunnel..."
echo ""

# Start worker in background
node index.js &
WORKER_PID=$!

# Wait for worker to start
sleep 2

# Start ngrok
echo "🌐 Starting ngrok tunnel..."
ngrok http 3001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app')

echo ""
echo "=================================="
echo "✅ Worker is running!"
echo "=================================="
echo ""
echo "📍 Local URL:  http://localhost:3001"
echo "🌐 Public URL: $NGROK_URL"
echo ""
echo "🔑 Next steps:"
echo "1. Copy the ngrok URL above"
echo "2. Add to Vercel env vars:"
echo "   WORKER_URL=$NGROK_URL"
echo "3. Redeploy Vercel"
echo ""
echo "📊 Monitoring:"
echo "   • Worker logs:  This terminal"
echo "   • Ngrok dashboard: http://localhost:4040"
echo "   • Health check: curl $NGROK_URL/health"
echo ""
echo "Press Ctrl+C to stop worker and ngrok"
echo ""

# Trap Ctrl+C and cleanup
trap "echo ''; echo '🛑 Stopping...'; kill $WORKER_PID $NGROK_PID 2>/dev/null; exit" INT TERM

# Keep script running and show logs
tail -f /tmp/ngrok.log 2>/dev/null &
wait $WORKER_PID
