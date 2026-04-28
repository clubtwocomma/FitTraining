#!/bin/bash
# deploy.sh — Rebuild frontend e reinicia o serviço FitTraining em produção

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$SCRIPT_DIR/client"
SERVER_DIR="$SCRIPT_DIR/server"

echo "🏋️  FitTraining — Deploy em produção"
echo "======================================="

# 1. Build do frontend
echo ""
echo "📦 A construir o frontend..."
cd "$CLIENT_DIR"
npm run build

# 2. Copiar build para o servidor
echo ""
echo "📁 A copiar build para server/public..."
rm -rf "$SERVER_DIR/public"
mkdir -p "$SERVER_DIR/public"
cp -r "$CLIENT_DIR/dist/"* "$SERVER_DIR/public/"

# 3. Reiniciar o serviço
echo ""
echo "🔄 A reiniciar o serviço fittraining..."
sudo systemctl restart fittraining

echo ""
echo "✅ Deploy concluído! App disponível em: https://magnific1.ddns.net/fittraining/"
