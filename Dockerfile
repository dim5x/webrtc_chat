FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Устанавливаем tree для красивого вывода
RUN apt-get update && apt-get install -y --no-install-recommends tree && rm -rf /var/lib/apt/lists/*

# Копируем только необходимые файлы
COPY requirements.txt .
COPY main.py .
COPY index.html .

# Копируем статические файлы
COPY static/fonts/ static/fonts/

# Копируем ТОЛЬКО минифицированные CSS файлы
COPY static/css/style.min.css static/css/style.css
COPY static/css/fontello.min.css static/css/fontello.css

# Копируем ТОЛЬКО минифицированные JS файлы
COPY static/js/client.min.js static/js/client.js

# Проверяем структуру файлов
RUN echo "=== FILE TREE ===" && \
    #tree -h -I '__pycache__|node_modules|.git'
    tree -h -I

# Проверяем что файлы на месте
#RUN echo "Files in container:" && ls -la

EXPOSE 8080

CMD ["python", "main.py"]