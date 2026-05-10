# -*- coding: utf-8 -*-
"""
Post-process Hugo output for Cloudflare Workers Static Assets.

Workers Static Assets currently reject individual assets larger than 25 MiB.
The browser ffmpeg wasm is useful for local/offline runs, but the deployed
page loads it from unpkg instead, so it must not be included in public/.
"""
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

DEPLOY_EXCLUDES = [
    PUBLIC / "scripts" / "vid2ascii-gif" / "ffmpeg-core.wasm",
]


def main() -> None:
    for path in DEPLOY_EXCLUDES:
        if path.exists():
            path.unlink()
            print(f"[prepare_cloudflare_assets] removed {path.relative_to(ROOT)}")
        else:
            print(f"[prepare_cloudflare_assets] skip missing {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
