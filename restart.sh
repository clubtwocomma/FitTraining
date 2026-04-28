#!/bin/bash
# script para reiniciar o FitTraining e aplicar todas as alterações

# Cores para o output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏋️  FitTraining — Reinício Completo${NC}"
echo "======================================="

# 1. Parar processos antigos
echo -e "\n${BLUE}🛑 1. Parando processos na porta 8510...${NC}"

# Tentar parar o serviço systemd se existir (pode pedir password se usar sudo, caso contrário falha silenciosamente)
sudo systemctl stop fittraining 2>/dev/null || echo "A tentar parar manualmente..."

# Matar processos que usem a porta 8510
fuser -k 8510/tcp 2>/dev/null
sleep 2 # Dar tempo ao SO para libertar o porto totalmente

echo -e "${GREEN}✅ Porta 8510 libertada.${NC}"

# 2. Build do Frontend
echo -e "\n${BLUE}📦 2. Construindo frontend...${NC}"
cd client
npm run build
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Build concluído.${NC}"
else
  echo -e "${RED}❌ Erro no build do frontend.${NC}"
  exit 1
fi
cd ..

# 3. Sincronizar com o Servidor
echo -e "\n${BLUE}📂 3. Sincronizando ficheiros para server/public...${NC}"
rm -rf server/public/*
mkdir -p server/public
cp -r client/dist/* server/public/
echo -e "${GREEN}✅ Sincronização concluída.${NC}"

# 4. Atualizar Schema da DB
echo -e "\n${BLUE}🗄️ 4. Sincronizando Base de Dados e Client...${NC}"
cd server
npx prisma generate
npx prisma db push
echo -e "${GREEN}✅ Base de dados e Client Prisma atualizados.${NC}"
cd ..

# 5. Configurar e Iniciar Serviço (systemd)
echo -e "\n${BLUE}🚀 5. Configurando e Iniciando serviço FitTraining...${NC}"

# Garantir que o ficheiro de serviço está no sítio certo
sudo cp fittraining.service /etc/systemd/system/
sudo systemctl daemon-reload

# Habilitar para iniciar no boot se ainda não estiver
sudo systemctl enable fittraining 2>/dev/null

# Reiniciar o serviço
sudo systemctl restart fittraining

# Verificar status
echo -e "${GREEN}✅ Serviço reiniciado.${NC}"
sudo systemctl status fittraining --no-pager | grep "Active:"

echo -e "\n${GREEN}✨ FitTraining está online e acessível em:${NC}"
echo -e "🔗 https://magnific1.ddns.net/fittraining/"
echo -e "🔗 http://localhost:8510/ (interno)"
