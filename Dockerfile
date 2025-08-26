FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Устанавливаем tree для красивого вывода
RUN apt-get update && apt-get install -y tree && rm -rf /var/lib/apt/lists/*


# Копируем ВСЕ файлы проекта
COPY . .

# Проверяем структуру файлов
RUN echo "=== FILE TREE ===" && \
    tree -h -I '__pycache__|node_modules|.git' && \
    echo "" && \
    echo "=== JS FILES ===" && \
    ls -lah static/js/ && \
    echo "" && \
    echo "=== CSS FILES ===" && \
    ls -lah static/css/

# Проверяем что файлы на месте
#RUN echo "Files in container:" && ls -la

EXPOSE 8080

CMD ["python", "tstvoip.py"]