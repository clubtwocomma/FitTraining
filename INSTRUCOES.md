# FitTraining - Guia de Instalação e Execução

Bem-vindo ao **FitTraining**, a tua aplicação de treinos com Inteligência Artificial.
Este guia explica passo a passo como iniciar a aplicação no teu computador.

A aplicação está dividida em duas partes que precisam de correr em simultâneo:
1. **Frontend (Client)**: A interface visual que usas no browser. (React/Vite)
2. **Backend (Server)**: O cérebro da aplicação, que lida com a lógica, a base de dados de exercícios e comunica com a Inteligência Artificial. (Node.js/Express)

---

## 📋 Pré-requisitos
Antes de começares, certifica-te de que tens o **Node.js** instalado no teu computador.
Podes verificar abrindo o teu terminal e escrevendo:
```bash
node -v
npm -v
```
*Se não os tiveres, faz o download em [nodejs.org](https://nodejs.org/).*

---

## 🚀 Passo a Passo para Iniciar a App

### PASSO 1: Iniciar o Servidor (Backend)

O servidor é onde estão alojados os nossos treinos WOD, Heróis, Girls e também o motor da Inteligência Artificial.

1. Abre um **Terminal Novo**.
2. Navega para a pasta do servidor:
   ```bash
   cd /caminho/para/FitTraining/server
   ```
   *(Substitui `/caminho/para/` pelo local real onde tens a pasta FitTraining, ex: `~/MoatBot/workspace/FitTraining/server`)*
3. Se for a primeira vez que estás a iniciar o projeto, instala as dependências:
   ```bash
   npm install
   ```
4. Inicia o Servidor:
   ```bash
   npm start
   ```
5. Deverás ver uma mensagem semelhante a: `Servidor a correr na porta 3001`. Deixa este terminal aberto e a correr!


### PASSO 2: Iniciar a Aplicação (Frontend)

Com o servidor (cérebro) a correr, vamos agora iniciar a cara da aplicação.

1. Abre **Outro Terminal Novo** (não feches o terminal do Passo 1!).
2. Navega para a pasta do cliente:
   ```bash
   cd /caminho/para/FitTraining/client
   ```
3. Se for a primeira vez que estás a iniciar o projeto, instala as dependências:
   ```bash
   npm install
   ```
4. Inicia a Interface:
   ```bash
   npm run dev
   ```
5. Deverás ver uma mensagem com um link local semelhante a: `➜  Local:   http://localhost:5173/`


### PASSO 3: Abrir no Browser

1. Abre o teu browser (ex: Google Chrome, Firefox, Safari).
2. Escreve a morada que o terminal do frontend te deu no URL. Normalmente é: **http://localhost:5173**

---

## 🛑 Como Desligar a Aplicação

Para desligares a aplicação quando terminares de a usar:
1. Vai a cada um dos dois terminais que tens abertos.
2. Pressiona `Ctrl + C` (ou `Cmd + C` no Mac) em cada um deles.
3. Isso irá matar os processos de forma limpa.

---

## 💡 Dicas Importantes

- **Fizeste uma alteração no código do Servidor (ex: adicionámos os Girls WODs)?** Vais reparar que o backend não deteta automaticamente as tuas novas alterações. Precisas de ir à janela do Terminal do **Server** (`npm start`), fazer `Ctrl + C` para o parar, e voltar a escrever `npm start`.
- **Ecrã Branco ou "Failed to Fetch"?** 99% das vezes isto significa que te esqueceste de iniciar o Servidor (Passo 1), ou que fechaste essa janela. A app (Frontend) precisa de falar com o cérebro (Backend) para funcionar.
- **Como configurar as Chaves da Inteligência Artificial?** Dentro da aplicação, clica no ícone da engrenagem ("Ajustes") no fundo do ecrã e cola lá a tua chave API (Google Gemini ou OpenAI) para desbloqueares todas as potencialidades de teres treinos gerados especialmente para ti, baseados nas tuas limitações e objetivos do dia!

---

## ⚡ Scripts Rápidos (Forma Mais Fácil)

Em vez de abrir vários terminais manualmente, podes usar os scripts incluídos na raiz do projeto.

### Desenvolvimento Local

Para arrancar o backend e o frontend ao mesmo tempo com um único comando:
```bash
cd ~/MoatBot/workspace/FitTraining
./dev.sh
```
- Abre automaticamente o backend (porta 5050) e o frontend (porta 5173) em paralelo.
- Termina os dois com `Ctrl + C`.
- Acede em: **http://localhost:5173**

### Produção — Após Gravar Alterações

Quando fizeres alterações no código e quiseres publicar em `magnific1.ddns.net`:
```bash
cd ~/MoatBot/workspace/FitTraining
./deploy.sh
```
O script faz automaticamente:
1. Build do frontend (`npm run build`)
2. Copia os ficheiros compilados para `server/public/`
3. Reinicia o serviço (`sudo systemctl restart fittraining`)

> A app fica disponível em: **https://magnific1.ddns.net/fittraining/**

> **Nota:** Se os scripts não forem executáveis, corre uma vez: `chmod +x deploy.sh dev.sh`

---

## 🌐 Deployment em Produção (nginx + HTTPS)

A app está configurada para ser exposta através de nginx com HTTPS, no subcaminho `/fittraining/`.
Consulta o ficheiro **`DEPLOY.md`** para o guia completo de instalação em produção, incluindo:
- Configuração do serviço `systemd` (`fittraining.service`)
- Configuração do nginx (`nginx_fittraining.conf`)
- Criação de utilizador/password de acesso

