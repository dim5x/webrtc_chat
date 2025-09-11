FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Устанавливаем tree для красивого вывода
RUN apt-get update && apt-get install -y --no-install-recommends tree && rm -rf /var/lib/apt/lists/*

# Создаем non-root пользователя
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Копируем только необходимые файлы
COPY main.py .
COPY healthchek.py .
COPY index.html .

# Копируем статические файлы
COPY static/fonts/ static/fonts/

# Копируем ТОЛЬКО минифицированные CSS файлы
COPY static/css/style.min.css static/css/style.css
COPY static/css/fontello.min.css static/css/fontello.css

# Копируем ТОЛЬКО минифицированные JS файлы
COPY static/js/client.min.js static/js/client.js

# Меняем владельца файлов на non-root пользователя
RUN chown -R appuser:appuser /app

# Переключаемся на non-root пользователя
USER appuser

# Проверяем структуру файлов
RUN tree -h

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD ["python", "healthchek.py"]

CMD ["python", "main.py"]