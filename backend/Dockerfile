# backend/Dockerfile
FROM docker.1ms.run/library/python:3.9-slim

WORKDIR /app

# 设置国内源，加速安装
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 复制依赖并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]