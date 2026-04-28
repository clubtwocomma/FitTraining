#!/bin/bash
# dev.sh — Arranca o ambiente de desenvolvimento local (frontend + backend em paralelo)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏋️  FitTraining — Modo Desenvolvimento"
echo "======================================="
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:5050"
echo "   Termina com: Ctrl+C"
echo ""

# Matar processos ao sair
trap "kill 0" EXIT

# Arrancar backend em background
echo "🚀 A arrancar o backend..."
cd "$SCRIPT_DIR/server"
npm start &

# Esperar um pouco para o backend inicializar
sleep 1

# Arrancar frontend em foreground
echo "🚀 A arrancar o frontend..."
cd "$SCRIPT_DIR/client"
npm run dev
