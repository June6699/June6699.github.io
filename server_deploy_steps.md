# 服务器部署步骤

本文记录将 `June6699.github.io` 部署到 Alibaba Cloud Linux 服务器的完整流程。

## 当前已确认

- 服务器系统：Alibaba Cloud Linux 3
- Python 启动方式：`py -3.11`
- Nginx：已安装，可用 `nginx -v` 验证
- 站点类型：Hugo 静态站，不需要 Python 常驻进程

---

## 0. 目标目录

```bash
/projects/June6699.github.io
```

站点构建产物目录：

```bash
/projects/June6699.github.io/public
```

安装v2rayN

```bash
mkdir -p /softwares
cd /softwares
wget -O v2rayN-linux-64.rpm "https://dl.v2rayn.co/apps/v2rayn/7.20.4/v2rayN-linux-rhel-64.rpm"

cd /softwares
sudo dnf install -y ./v2rayN-linux-rhel-x64.rpm
```



测试不加速的订阅

```bash
curl -vL --http1.1 \
  -A 'v2rayN/7.20.4' \
  -o /softwares/sub.txt \
  'https://unity3d.bujiasu.com/file/4a3b70aee9070a162fa40af4d62c403d/obj.fbm'

# 如果断了
curl -vL --http1.1 \
  -A 'v2rayN/7.20.4' \
  -H 'Referer: https://unity3d.bujiasu.com/' \
  -o /softwares/sub.txt \
  'https://unity3d.bujiasu.com/file/4a3b70aee9070a162fa40af4d62c403d/obj.fbm'

```



---

## 1. 安装基础工具

```bash
sudo dnf install -y git wget curl tar gzip unzip
```

如果 Nginx 还没装，或之前遇到 `exclude filtering` 问题：

```bash
sudo dnf --disableexcludes=all install -y nginx
sudo systemctl enable --now nginx
nginx -v
```

---

## 2. 安装 Hugo

用winscp传输

如果系统源没有 Hugo，优先用镜像下载。可以先试 SourceForge 镜像：

```bash
cd /tmp
HUGO_VERSION=0.157.0
wget -O hugo.tar.gz "https://github.com/gohugoio/hugo/releases/download/v0.157.0/hugo_0.157.0_linux-amd64.tar.gz"
tar -xzf hugo.tar.gz
sudo mv hugo /usr/local/bin/hugo
sudo chmod +x /usr/local/bin/hugo
hugo version
```

如果这个版本在镜像里不可用，就换成镜像里现成的版本，再把 `HUGO_VERSION` 对应修改掉。

---

## 3. 拉取项目

```bash
cd /projects

sudo dnf install -y git
git clone https://github.com/June6699/June6699.github.io.git
cd /projects/June6699.github.io
```

---

## 4. 创建 Python 环境

```bash
cd /projects/June6699.github.io
```

安装依赖时优先用国内 PyPI 镜像：

```bash
py -3.11 -m pip install --upgrade pip -i https://mirrors.aliyun.com/pypi/simple/
py -3.11 -m pip install -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt
```

如果阿里源有问题，可换清华源：

```bash
py -3.11 -m pip install --upgrade pip -i https://mirrors.aliyun.com/pypi/simple/
py -3.11 -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```

---

## 5. 构建站点

先同步图片和图标，再构建 Hugo：

```bash
cd /projects/June6699.github.io

py -3.11 scripts/sync_images.py
py -3.11 scripts/sync_icons.py

cd /projects/June6699.github.io   # 按你的实际路径改
rm -rf public
hugo --minify --buildFuture --baseURL "https://june6699.top/"
ls -lh public/index.html
```

---

## 6. 配置 Nginx

创建站点配置：

```bash
sudo dnf install -y nano
sudo nano /etc/nginx/conf.d/june-blog.conf
```

写入：

```nginx
server {
    listen 80;
    server_name june6699.top www.june6699.top;

    root /projects/June6699.github.io/public;
    index index.html;

    error_page 404 /404.html;

    location / {
        try_files $uri $uri/ =404;
    }
}

```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. 域名解析

在域名 DNS 控制台添加两条 A 记录：

```text
@      A      服务器公网 IP
www    A      服务器公网 IP
```

查看公网 IP：

```bash
curl ifconfig.me
curl -I http://127.0.0.1
curl -I http://8.137.165.92

```

或者直接在阿里云 ECS 控制台查看。

---

## 8. 安全组放行

阿里云安全组入方向放行：

```text
80    TCP    0.0.0.0/0
443   TCP    0.0.0.0/0
```

如果这一步没做，服务器本地能访问，外网也可能打不开。

---

## 9. HTTPS

先尝试安装 Certbot：

```bash
sudo dnf install -y certbot python3-certbot-nginx
```

如果安装成功，直接签证书：

```bash
sudo certbot --nginx -d june6699.top -d www.june6699.top
```

如果 certbot 装不上，再改用阿里云 SSL 免费证书手动配置。

---

## 10. 后续更新发布

以后每次更新文章或资源，按下面顺序执行：

```bash
cd /projects/June6699.github.io
git pull
source .venv/bin/activate

py -3.11 scripts/sync_images.py
py -3.11 scripts/sync_icons.py

hugo --minify --buildFuture --baseURL "https://june6699.top/"
sudo systemctl reload nginx
```

---

## 11. 常见问题

### Nginx 安装时报 `exclude filtering`

```bash
sudo dnf --disableexcludes=all install -y nginx
```

### Hugo 下载慢或下不到

- 优先试系统源
- 再试 SourceForge 镜像
- 实在不行再换镜像里的其他 Hugo 版本

### 页面能访问，但外网打不开

先检查：

1. 域名 A 记录是否指向服务器公网 IP
2. 阿里云安全组是否放行 80/443
3. Nginx 是否在运行
4. `sudo nginx -t` 是否通过

