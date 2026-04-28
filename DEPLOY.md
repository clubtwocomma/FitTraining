# FitTraining — Guia de Deployment em Produção

> Segue o mesmo modelo do **IGApp**: React+Express served behind nginx + HTTPS + Basic Auth.
> URL final: `https://magnific1.ddns.net/fittraining/`

---

## Pré-requisitos
- Node.js ≥ 18 instalado
- nginx configurado para `magnific1.ddns.net` com HTTPS (certbot)
- `apache2-utils` instalado (`sudo apt install apache2-utils`)

---

## 1. Preparação do Código

O código já está preparado:
- `client/vite.config.js` — tem `base: '/fittraining/'`
- `client/src/lib/api.js` — usa `VITE_API_BASE` com fallback em `/api`
- `client/.env.production` — define `VITE_API_BASE=/api`

---

## 2. Build & Deploy

```bash
# Vai à raiz do workspace OpenClaw (onde corre em produção)
cd ~/.openclaw/workspace/FitTraining

# Dependências do backend
cd server && npm install && cd ..

# Build do frontend
cd client
npm install
npm run build

# Copiar build para o backend servir como estático
rm -rf ../server/public
mkdir -p ../server/public
cp -r dist/* ../server/public/
cd ..
```

---

## 3. Serviço systemd

Copia o ficheiro de serviço incluído no repositório:

```bash
sudo cp fittraining.service /etc/systemd/system/fittraining.service
sudo systemctl daemon-reload
sudo systemctl enable --now fittraining.service
sudo systemctl status fittraining.service
```

Verifica que está a escutar na porta correta:
```bash
ss -tlnp | grep 8510
```

---

## 4. Nginx + HTTPS + Basic Auth

### Criar palavra-passe

```bash
sudo htpasswd -c /etc/nginx/.htpasswd_fittraining rjafreitas
```

### Adicionar ao bloco `server {}` de magnific1.ddns.net

Copia o conteúdo de `nginx_fittraining.conf` (incluído no repositório) para dentro do teu bloco `server { ... }` do nginx, a seguir ao bloco `/igapp/` existente.

```bash
# Testar config
sudo nginx -t

# Recarregar nginx
sudo systemctl reload nginx
```

---

## 5. Verificação Final

```bash
# Log do serviço
sudo journalctl -u fittraining -n 20

# Testar backend localmente
curl -I http://127.0.0.1:8510/
curl -I http://127.0.0.1:8510/api/exercises

# De fora da rede (4G/VPN):
# https://magnific1.ddns.net/fittraining/
```

---

## 6. Atualizar a App (após mudanças no código)

```bash
cd ~/.openclaw/workspace/FitTraining/client
npm run build
rm -rf ../server/public && mkdir -p ../server/public && cp -r dist/* ../server/public/
sudo systemctl restart fittraining
```

---

## 7. Resolução de Problemas

| Sintoma | Comando de diagnóstico |
|---|---|
| Página não carrega | `sudo journalctl -u nginx -n 50` |
| API não responde | `curl -I http://127.0.0.1:8510/api/exercises` |
| Serviço em baixo | `sudo journalctl -u fittraining -n 20` |
| Trocar password | `sudo htpasswd /etc/nginx/.htpasswd_fittraining rjafreitas` |
