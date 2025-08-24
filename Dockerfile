FROM python:3.9-slim

WORKDIR /app

# Копируем requirements первым для кэширования
COPY requirements.txt .
RUN pip install -r requirements.txt

# Копируем все файлы
COPY . .

# Создаем директорию static и копируем туда файлы
RUN mkdir -p static && \
    cp client.js static/ && \
    cp style.css static/ && \
    echo "Static files:" && ls -la static/

EXPOSE 8080

CMD ["python", "tstvoip.py"]