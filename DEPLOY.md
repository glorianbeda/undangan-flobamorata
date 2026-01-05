# 📦 Deploy Undangan Web dengan Cloudflared & Traefik

Panduan ini untuk men-deploy aplikasi Undangan Web di server `allets` menggunakan **Cloudflare Tunnel** dan **Traefik**.

Domain: `undangan.gbeda.my.id`
Port App: `3000`

---

## 1️⃣ Setup Docker Compose

Masuk ke direktori project di server:
```bash
cd /mnt/ssd_data/undangan-flobamorata
```

Edit atau buat `docker-compose.yml` agar support Traefik:
```bash
nano docker-compose.yml
```

Paste konfigurasi berikut:
```yaml
version: '3'
services:
  web:
    build: .
    container_name: undangan-web
    restart: unless-stopped
    ports:
      - "3001:3000" # Opsional: akses langsung via IP:3001
    volumes:
      - ./rsvp_data.json:/app/rsvp_data.json
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.undangan.rule=Host(`undangan.gbeda.my.id`)"
      - "traefik.http.routers.undangan.entrypoints=web"
      - "traefik.http.services.undangan.loadbalancer.server.port=3000"

networks:
  proxy:
    external: true
```

> **Catatan**: Pastikan network `proxy` sudah ada. Jika belum, sesuaikan dengan nama network Traefik Anda.

Build & Jalankan container:
```bash
docker compose up -d --build
```

---

## 2️⃣ Buat Subdomain dengan Cloudflared

Jalankan command ini di terminal server untuk mendaftarkan DNS:

```bash
cloudflared tunnel route dns homeserver undangan.gbeda.my.id
```

---

## 3️⃣ Edit `config.yml` Cloudflared

Buka konfigurasi Cloudflared:
```bash
sudo nano /etc/cloudflared/config.yml
```

Tambahkan entry baru di bagian `ingress` (letakkan **sebelum** rule 404/catch-all):

```yaml
  - hostname: undangan.gbeda.my.id
    service: http://127.0.0.1:80
```

> **Penjelasan**: Traffic `undangan.gbeda.my.id` akan diarahkan ke port **80** (Traefik). Traefik kemudian akan membaca label di Docker container dan meneruskan ke container `undangan-web`.

---

## 4️⃣ Restart Cloudflared

Terapkan perubahan konfigurasi:

```bash
sudo systemctl restart cloudflared
```

Cek status untuk memastikan tidak ada error:
```bash
sudo systemctl status cloudflared --no-pager
```

---

## 5️⃣ Test Akses

Buka browser dan kunjungi:
👉 **[http://undangan.gbeda.my.id](http://undangan.gbeda.my.id)**

---

## ✅ Checklist Deployment

- [ ] `docker-compose.yml` sudah update dengan labels Traefik
- [ ] Container `undangan-web` up & running connected to `proxy` network
- [ ] DNS `undangan.gbeda.my.id` sudah create via `cloudflared`
- [ ] `config.yml` sudah update (hostname -> service localhost:80)
- [ ] Cloudflared direstart
- [ ] Web bisa diakses dari internet
