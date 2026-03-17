import shutil
from pathlib import Path


def copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    src_dir = repo_root / "my_icons"
    out_dir = repo_root / "static"

    ico = src_dir / "favicon.ico"
    png = src_dir / "favicon.png"

    if not ico.exists():
        raise FileNotFoundError(f"[sync_icons] missing {ico}")
    if not png.exists():
        raise FileNotFoundError(f"[sync_icons] missing {png}")

    mapping = {
        ico: out_dir / "favicon.ico",
        png: out_dir / "favicon.png",
        png: out_dir / "favicon-16x16.png",
        png: out_dir / "favicon-32x32.png",
        png: out_dir / "apple-touch-icon.png",
    }

    # dict key collision above; do explicit copies for png variants
    copy(ico, out_dir / "favicon.ico")
    copy(png, out_dir / "favicon.png")
    for name in ["favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png"]:
        copy(png, out_dir / name)

    print("[sync_icons] synced:")
    print(f"  - {ico} -> {out_dir / 'favicon.ico'}")
    print(f"  - {png} -> {out_dir / 'favicon.png'} (+ variants)")


if __name__ == "__main__":
    main()

