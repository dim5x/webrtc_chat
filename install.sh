#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/dim5x/webrtc_chat.git"
INSTALL_DIR="${INSTALL_DIR:-/opt/webrtc_chat}"
APP_PORT="${APP_PORT:-8080}"
IMAGE_NAME="webrtc-chat"
CONTAINER_NAME="webrtc-chat"

[[ $EUID -eq 0 ]] || { echo "Запустите от root (sudo)"; exit 1; }

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
    echo "[*] Устанавливаю Docker..."
    apt-get update -qq
    apt-get install -y -qq docker.io git
    systemctl enable --now docker
fi

# --- Клон / pull ---
if [[ -d "${INSTALL_DIR}/.git" ]]; then
    echo "[*] Обновляю ${INSTALL_DIR}..."
    git -C "${INSTALL_DIR}" pull --ff-only
else
    echo "[*] Клонирую репозиторий..."
    rm -rf "${INSTALL_DIR}"
    git clone --depth=1 "${REPO_URL}" "${INSTALL_DIR}"
fi

cd "${INSTALL_DIR}"

# --- Патч Dockerfile (healthcheck.py закомментирован в COPY) ---
sed -i 's|^#COPY healthcheck.py .|COPY healthcheck.py .|' Dockerfile || true

# --- Сборка и запуск ---
echo "[*] Собираю образ..."
docker build -t "${IMAGE_NAME}:latest" .

echo "[*] Запускаю контейнер..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "${APP_PORT}:8080" \
    "${IMAGE_NAME}:latest"

echo
echo "[✓] Готово. Приложение: http://$(hostname -I | awk '{print $1}'):${APP_PORT}"
echo "    Логи:    docker logs -f ${CONTAINER_NAME}"
echo "    Рестарт: docker restart ${CONTAINER_NAME}"