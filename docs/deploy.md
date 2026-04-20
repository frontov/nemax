# Production deploy

This project can be deployed as-is with Docker Compose on a single server.

## 1. Prepare the server

- Install Docker Engine and Docker Compose plugin.
- Point the domain `немах.рус` to `146.103.124.234`.
- Open inbound port `80` in the server firewall.

## 2. Upload the code

```bash
git clone https://github.com/frontov/nemax.git /opt/nemax
cd /opt/nemax
cp .env.production.example .env
```

## 3. Configure production env

Edit `.env` and replace all `change-me-*` values:

- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `MINIO_SECRET_KEY`
- `SESSION_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

The domain is prefilled in punycode form:

- `xn--80ajvc7b.xn--p1acf` = `немах.рус`

## 4. Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

## 5. Verify

```bash
curl -I http://127.0.0.1:8081
curl http://127.0.0.1:8081/api/health
```

## 6. Update later

```bash
cd /opt/nemax
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
