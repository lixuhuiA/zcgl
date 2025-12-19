# 阶段 1: 构建 (Build)
FROM docker.1ms.run/library/node:20-alpine as builder
WORKDIR /app
# 复制 package.json 并安装依赖
COPY package.json .
RUN npm install
# 复制源代码并打包
COPY . .
RUN npm run build

# 阶段 2: 运行 (Serve with Nginx)
FROM docker.1ms.run/library/nginx:alpine
# 从第一阶段复制打包好的文件到 Nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# 复制我们在根目录写的 nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]