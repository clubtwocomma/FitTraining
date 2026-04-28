#!/bin/bash

# FitTraining - Script para Iniciar a Aplicação

echo "🔥 A iniciar o FitTraining..."

# Iniciar o Backend em background
cd server
PORT=5050 npm start &
BACKEND_PID=$!
echo "📡 Servidor API a iniciar na porta 5050 (PID: $BACKEND_PID)..."

# Iniciar o Frontend
cd ../client
echo "💻 Frontend a iniciar..."
npm run dev

# Quando o frontend parar, matar o backend
kill $BACKEND_PID
echo "🛑 Aplicação Terminada."
