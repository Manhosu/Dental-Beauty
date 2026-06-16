# Deploy do Microserviço de Agendamento (VPS)

Guia para subir o microserviço de agendamento Clinicorp numa VPS, acessível por HTTPS para o Flow Builder do Chatbotify chamar.

## Visão geral
```
Chatbotify (Flow Builder, bloco HTTP)
        │  HTTPS
        ▼
   Nginx (443, TLS) ── proxy ──▶ app (Docker, :3000) ──▶ Redis (Docker)
                                       │
                                       ▼  HTTPS Basic
                                 API Clinicorp
```

## Pré-requisitos na VPS
- Docker + Docker Compose plugin (`docker compose version`).
- Um domínio/subdomínio apontando (A record) para o IP da VPS — ex: `agenda.dentalbeauty.com.br`.
- Portas 80 e 443 liberadas no firewall.

## 1. Clonar e configurar
```bash
git clone https://github.com/Manhosu/Dental-Beauty.git
cd Dental-Beauty
cp .env.example .env
nano .env
```
Preencher o `.env` (NUNCA commitar):
```
NODE_ENV=production
PORT=3000
REDIS_URL=redis://redis:6379        # nome do serviço no compose
CLINICORP_API_BASE=https://api.clinicorp.com/rest/v1
CLINICORP_API_USER=oralmultiedentalbeautyoralmulti
CLINICORP_API_TOKEN=<token>
CLINICORP_SUBSCRIBER_ID=oralmultiedentalbeauty
CLINICORP_BUSINESS_ID=6247357829611520
CLINICORP_ACCESS_CODE=<codigo do agendamento online>   # ver pendência
CHATBOTIFY_API_BASE=https://chatbotify.com.br
CHATBOTIFY_API_TOKEN=
```

## 2. Subir app + Redis
```bash
docker compose up -d --build
docker compose logs -f app      # acompanhar o boot
curl http://localhost:3000/health   # deve responder {"status":"ok"}
```

## 3. Nginx + HTTPS (Let's Encrypt)
Instalar Nginx e Certbot:
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```
Criar `/etc/nginx/sites-available/agenda` (ajuste o domínio):
```nginx
server {
    server_name agenda.dentalbeauty.com.br;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Ativar + emitir certificado:
```bash
sudo ln -s /etc/nginx/sites-available/agenda /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d agenda.dentalbeauty.com.br   # configura HTTPS automaticamente
```

## 4. Validar de fora
```bash
curl https://agenda.dentalbeauty.com.br/health
```
No Flow Builder do Chatbotify, os blocos HTTP apontam para:
- `GET  https://agenda.dentalbeauty.com.br/agendamento/disponibilidade?date=YYYY-MM-DD`
- `POST https://agenda.dentalbeauty.com.br/agendamento/book`
- `POST https://agenda.dentalbeauty.com.br/agendamento/cancelar`

## 5. Atualizações
```bash
git pull
docker compose up -d --build
```

## Operação
- **Logs:** `docker compose logs -f app`
- **Reiniciar:** `docker compose restart app`
- **Redis persiste** em volume (`redis-data`) — filas/locks sobrevivem a restart.

## Segurança
- `.env` fica só na VPS (gitignored). Rotacionar o token Clinicorp periodicamente.
- Considerar proteger os endpoints `/agendamento/*` com um header secreto compartilhado com o Flow Builder (ex: `X-Api-Key`) — **melhoria recomendada** antes de produção, já que a URL é chamada de fora.

## Pendências
- **`CLINICORP_ACCESS_CODE`**: código do Agendamento Online da Clinicorp (necessário para `disponibilidade`). Confirmar com o cliente + o nome exato do parâmetro na chamada.
