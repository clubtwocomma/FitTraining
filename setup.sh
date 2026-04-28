#!/bin/bash

# FitTraining - Script de Instalação de Requisitos

echo "🚀 Iniciando instalação do FitTraining..."

# Instalar dependências do Backend
echo "📦 Instalando dependências do Backend (Server)..."
cd server
npm install
if [ $? -eq 0 ]; then
  echo "✅ Backend pronto."
else
  echo "❌ Erro ao instalar dependências do Backend."
  exit 1
fi

# Voltar para a raiz e ir para o Frontend
cd ..
echo "📦 Instalando dependências do Frontend (Client)..."
cd client
npm install
if [ $? -eq 0 ]; then
  echo "✅ Frontend pronto."
else
  echo "❌ Erro ao instalar dependências do Frontend."
  exit 1
fi

echo "✨ Tudo pronto! Podes agora correr a aplicação com os scripts de start ou via Docker."
