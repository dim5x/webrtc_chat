#!/usr/bin/env bash

set -euo pipefail

TARBALL_URL="https://github.com/dim5x/webrtc_chat/archive/refs/heads/master.tar.gz"
INSTALL_DIR="${INSTALL_DIR:-/opt/webrtc_chat}"
APP_PORT="${APP_PORT:-8080}"
IMAGE_NAME="webrtc-chat"
CONTAINER_NAME="webrtc-chat"

[[ $EUID -eq 0 ]] || { echo "Запустите от root (sudo)"; exit 1; }

# --- Docker + curl + tar ---
if ! command -v docker >/dev/null 2>&1; then
    echo "[*] Устанавливаю Docker..."
    apt-get update -qq
    apt-get install -y -qq docker.io curl tar
    systemctl enable --now docker
fi

# --- Скачивание и распаковка ---
echo "[*] Скачиваю ${TARBALL_URL}..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
curl -fsSL "${TARBALL_URL}" -o "${TMP_DIR}/src.tar.gz"

echo "[*] Распаковываю в ${INSTALL_DIR}..."
rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
tar -xzf "${TMP_DIR}/src.tar.gz" -C "${INSTALL_DIR}" --strip-components=1
cd "${INSTALL_DIR}"

# --- Патч Dockerfile (healthcheck.py закомментирован в COPY) ---
sed -i 's|^#COPY healthcheck.py .|COPY healthcheck.py .|' Dockerfile || true

# --- Сборка ---
echo "[*] Собираю образ..."
docker build -t "${IMAGE_NAME}:latest" .

# --- Запуск только на localhost ---
echo "[*] Запускаю контейнер на 127.0.0.1:${APP_PORT}..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "127.0.0.1:${APP_PORT}:8080" \
    "${IMAGE_NAME}:latest"

echo
echo "[✓] Готово. Приложение слушает 127.0.0.1:${APP_PORT}"
echo "    Nginx должен проксировать на этот адрес (правки не трогаем)."
echo "    Логи:    docker logs -f ${CONTAINER_NAME}"
echo "    Рестарт: docker restart ${CONTAINER_NAME}"