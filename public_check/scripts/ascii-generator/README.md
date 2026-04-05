# ASCII Generator（Python）部署说明

本目录为 [Viet Nguyen 的 ASCII-generator](https://github.com/vietnh1009/ASCII-generator) 思路下的本地脚本副本，并已修正 MP4 输出时 `VideoWriter` 的初始化方式，且为视频转换加入 `tqdm` 进度条。

## 目录结构（克隆或下载后应保持）

```
ascii-generator/
├── fonts/
│   └── DejaVuSansMono-Bold.ttf
├── data/                    # 自建：放入 input.mp4 等
├── video2video_color.py
├── video2video.py
├── img2txt.py / img2img.py / img2img_color.py …
└── README.md
```

## 环境

- Python 3.8+（推荐 3.10+）
- 依赖：`opencv-python`、`pillow`、`numpy`、`tqdm`

```bash
python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple opencv-python pillow numpy tqdm
```

在项目根目录（含 `fonts/`）执行脚本，保证 `ImageFont.truetype("fonts/DejaVuSansMono-Bold.ttf", …)` 路径有效。

## 视频转 ASCII 视频（示例）

```bash
python video2video_color.py --input data/input.mp4 --output data/out.mp4 --mode simple --background black --num_cols 120 --scale 1 --fps 0 --overlay_ratio 0.15
```

- `--fps 0` 表示沿用源视频帧率。
- 输出 MP4 使用 `mp4v` 编码；若需更高兼容性可自行改为 `avc1` 等（依赖本机 OpenCV 构建）。

## 网页版说明页

部署到 GitHub Pages 后，说明与命令生成器见：

`/scripts/ascii-generator/guide.html`

纯前端演示（FFmpeg WASM）见：

`/scripts/vid2ascii-gif/index.html`

## 上线后是否可用？

- **说明页**（`guide.html`）：静态页面，部署后即可访问。
- **浏览器版**：需站点提供 **HTTPS**（GitHub Pages 默认满足），以便加载 WASM；首次打开会下载 `ffmpeg-core.wasm`，体积较大属正常。
- 上游仓库：<https://github.com/vietnh1009/ASCII-generator/>
