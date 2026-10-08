FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TF_CPP_MIN_LOG_LEVEL=2
WORKDIR /app
COPY pyproject.toml README.md LICENSE ./
COPY src ./src
RUN pip install --no-cache-dir '.[ml]' \
    && useradd --create-home --uid 10001 foodlogger \
    && mkdir -p /app/runtime /home/foodlogger/.keras \
    && chown -R foodlogger:foodlogger /app/runtime /home/foodlogger
USER foodlogger
EXPOSE 8000
CMD ["foodlogger", "--host", "0.0.0.0", "--port", "8000"]
