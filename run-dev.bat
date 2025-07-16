@echo off
echo 🚀 Starting Question Game for Rhythm...

:: Start server
echo 🔧 Starting server...
start cmd /k "cd server && npm install && node index.js"

:: Wait 2 seconds before starting client
timeout /t 2 >nul

:: Start client
echo 🌐 Starting client (Vite)...
start cmd /k "cd client && npm install && npm run dev"

:: Wait 2 seconds before starting ngrok
timeout /t 2 >nul

:: Start ngrok tunnel to Vite (5173)
echo 🚇 Starting ngrok tunnel...
start cmd /k "ngrok http 5173"

echo ✅ All services launched in separate terminals.
