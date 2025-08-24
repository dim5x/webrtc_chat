FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Копируем ВСЕ файлы проекта
COPY . .

# Проверяем что файлы на месте
RUN echo "Files in container:" && ls -la

EXPOSE 8080

CMD ["python", "tstvoip.py"]