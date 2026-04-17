# TopViewbot 安装指南

## 快速安装（Linux/macOS）

```bash
# 一行命令安装
curl -fsSL https://raw.githubusercontent.com/your-username/topviewbot/main/install.sh | bash
```

安装脚本会自动完成：
1. 检测并安装 Bun 运行时
2. 下载 TopViewbot 源码
3. 安装所有依赖
4. 构建 Web 前端
5. 创建全局命令 `topviewbot`

## 手动安装

如果自动安装失败，可以手动安装：

### 1. 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### 2. 克隆项目

```bash
git clone https://github.com/your-username/topviewbot.git ~/.topviewbot
cd ~/.topviewbot
```

### 3. 安装依赖

```bash
# opencode 依赖
cd opencode && bun install && cd ..

# topviewbot 依赖
cd packages/topviewbot && bun install && cd ../..

# web 依赖
cd web && bun install && cd ..
```

### 4. 构建 Web 前端

```bash
cd web && bun run build && cd ..
```

### 5. 创建启动脚本

```bash
mkdir -p ~/.local/bin

cat > ~/.local/bin/topviewbot << 'EOF'
#!/bin/bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
exec bun run "$HOME/.topviewbot/packages/topviewbot/src/index.ts" "$@"
EOF

chmod +x ~/.local/bin/topviewbot
```

### 6. 添加到 PATH

```bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc
source ~/.bashrc
```

## 使用方法

```bash
# 启动服务（首次运行会触发配置向导）
topviewbot

# 运行配置向导
topviewbot setup

# 查看配置
topviewbot config show

# 启动并开启隧道
topviewbot start --tunnel

# 指定端口
topviewbot start --port 8080

# 查看帮助
topviewbot --help
```

## 更新

```bash
~/.topviewbot/scripts/update.sh
```

或手动更新：

```bash
cd ~/.topviewbot
git pull
cd opencode && bun install && cd ..
cd packages/topviewbot && bun install && cd ../..
cd web && bun install && bun run build && cd ..
```

## 卸载

```bash
~/.topviewbot/scripts/uninstall.sh
```

或手动卸载：

```bash
rm -rf ~/.topviewbot
rm ~/.local/bin/topviewbot
```

## 配置文件

配置文件位于 `~/.topviewbot/topviewbot.config.jsonc`

```json
{
  "server": {
    "port": 4096,
    "hostname": "127.0.0.1",
    "openBrowser": true
  },
  "auth": {
    "enabled": false,
    "password": "your-password"
  },
  "tunnel": {
    "enabled": true,
    "provider": "natapp",
    "natapp": {
      "authToken": "your-natapp-token"
    }
  },
  "model": "anthropic/claude-3-5-sonnet-20241022"
}
```

## 隧道配置

### ngrok（国际）

1. 注册 [ngrok](https://ngrok.com) 账号
2. 获取 authtoken
3. 配置：

```json
{
  "tunnel": {
    "enabled": true,
    "provider": "ngrok",
    "ngrok": {
      "authToken": "your-ngrok-token"
    }
  }
}
```

### NATAPP（国内）

1. 注册 [NATAPP](https://natapp.cn) 账号
2. 创建隧道，获取 authtoken
3. 下载 NATAPP 客户端并添加到 PATH
4. 配置：

```json
{
  "tunnel": {
    "enabled": true,
    "provider": "natapp",
    "natapp": {
      "authToken": "your-natapp-token"
    }
  }
}
```

## 系统要求

- **操作系统**: Linux, macOS
- **运行时**: Bun >= 1.0.0（安装脚本会自动安装）
- **网络**: 需要访问 AI 提供商 API

## 常见问题

### Q: 安装后 `topviewbot` 命令找不到

运行 `source ~/.bashrc` 或重新打开终端。

### Q: 端口被占用

使用 `--port` 参数指定其他端口：

```bash
topviewbot start --port 8080
```

### Q: 如何在后台运行

使用 `nohup` 或 `screen`：

```bash
nohup topviewbot start --no-browser > topviewbot.log 2>&1 &
```

或使用 systemd 服务（见下方）。

## systemd 服务（可选）

创建 `/etc/systemd/system/topviewbot.service`：

```ini
[Unit]
Description=TopViewbot AI Assistant
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/.topviewbot
ExecStart=/home/your-username/.local/bin/topviewbot start --no-browser
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable topviewbot
sudo systemctl start topviewbot
```
