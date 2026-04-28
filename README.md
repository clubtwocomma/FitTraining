# FitTraining - Gerador de Treinos Domésticos

Aplicação web responsiva (mobile-first) para geração de treinos automáticos e inteligentes.

## Características
- **Mobile-First**: Design otimizado para telemóveis com componentes grandes e navegação clara.
- **Inteligência Artificial**: Opção de gerar treinos usando Gemini ou OpenAI para maior dinamismo.
- **Flexível**: Escolhe o tempo, os grupos musculares e o equipamento que tens em casa.
- **Exportação**:O projeto está dividido em `client` (Frontend React) e `server` (Backend Node.js).
A API corre agora por predefinição na porta **5050** para evitar conflitos comuns com o sistema.

### Execução Local (Rápida)
1. Instala os requisitos: `./setup.sh`
2. Inicia tudo: `./start.sh`

A aplicação ficará disponível em `http://localhost:5173`.

### Execução Manual
**Backend:**
```bash
cd server
npm install
npm run dev  # Usa a porta 5050
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

## Como Executar (Docker)

Esta é a forma recomendada para publicar num servidor Linux.

### 1. Build da Imagem
```bash
docker build -t fittraining .
```

### 2. Executar o Contentor
```bash
docker run -p 5000:5000 fittraining
```
A aplicação estará disponível em `http://localhost:5000`.

## Estrutura do Projeto
- `/client`: Frontend React (Vite).
- `/server`: API Node.js/Express.
- `/server/data`: Base de dados de exercícios (JSON).
- `/server/utils`: Lógica de geração de treinos.
- `/server/services`: Integração com APIs de IA.

---
**Nota de Segurança**: Adapta sempre o treino ao teu nível físico.
