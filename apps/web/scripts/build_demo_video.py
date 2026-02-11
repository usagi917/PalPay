#!/usr/bin/env python3
"""Build a silent subtitle demo video (AVI/MJPEG) and matching SRT.

No external dependencies are required beyond Pillow, which is available in the
current environment.
"""

from __future__ import annotations

import argparse
import struct
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


@dataclass(frozen=True)
class Scene:
    start_s: int
    end_s: int
    screen: str
    action: str
    caption: str
    accent_rgb: tuple[int, int, int]


SCENES: tuple[Scene, ...] = (
    Scene(
        0,
        12,
        "タイトルスライド",
        "ロゴとタイトル表示",
        "Proof of Trust: 生産者と購入者の信頼を、工程連動決済で可視化",
        (191, 62, 22),
    ),
    Scene(
        12,
        25,
        "課題スライド",
        "課題3点を表示",
        "高額B2B取引は、前払い・進捗確認・紛争対応の負担が大きい",
        (130, 38, 56),
    ),
    Scene(
        25,
        40,
        "/agent",
        "ウォレット接続、チャット開始",
        "AIが出品支援を開始。価格相談、下書き作成、次アクション提案を自動化",
        (15, 102, 127),
    ),
    Scene(
        40,
        65,
        "/agent",
        "「神戸牛A5を50万円で出品」入力",
        "Vertex AI Gemini が market分析と出品ドラフトを生成",
        (51, 88, 40),
    ),
    Scene(
        65,
        85,
        "/agent",
        "署名準備UI表示",
        "署名前に内容確認。Human-in-the-loopで誤操作を防止",
        (80, 50, 110),
    ),
    Scene(
        85,
        105,
        "/listing/[address]",
        "lock -> approve の流れを実演",
        "購入者承認で取引開始。状態は open -> locked -> active",
        (142, 95, 30),
    ),
    Scene(
        105,
        125,
        "/listing/[address]",
        "milestone進捗更新",
        "工程完了に応じて段階支払い。最終支払いは buyer の確認後のみ",
        (36, 116, 108),
    ),
    Scene(
        125,
        140,
        "NFT表示",
        "token metadata/image APIを表示",
        "Dynamic NFTが進捗と状態を自動反映",
        (16, 118, 76),
    ),
    Scene(
        140,
        155,
        "チャット画面",
        "XMTP会話を表示",
        "当事者間のE2E暗号化チャットで合意形成を補助",
        (32, 77, 145),
    ),
    Scene(
        155,
        170,
        "構成図",
        "docs/architecture.mmd を表示",
        "Cloud Run + Vertex AI + EVM の構成で要件A/Bを満たす",
        (76, 84, 28),
    ),
    Scene(
        170,
        180,
        "エンディング",
        "URL一覧表示",
        "Demo URL / GitHub / Zenn 記事は概要欄へ",
        (110, 50, 50),
    ),
)

ARCH_LINES = (
    "User -> Cloud Run -> Vertex AI",
    "Cloud Run -> ListingFactory / Escrow / NFT API",
    "User -> XMTP (E2E encrypted chat)",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build silent subtitle demo AVI video and SRT."
    )
    parser.add_argument(
        "--out-dir",
        default="docs/demo-video",
        help="Output directory (default: docs/demo-video)",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=2,
        help="Frames per second (default: 2)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1920,
        help="Video width (default: 1920)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=1080,
        help="Video height (default: 1080)",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=87,
        help="JPEG quality 1-95 for MJPEG frames (default: 87)",
    )
    return parser.parse_args()


def select_font_path() -> Path:
    candidates = (
        Path("/Library/Fonts/NotoSansJP-Regular.otf"),
        Path("/Library/Fonts/Noto Sans CJK JP.ttc"),
        Path("/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc"),
        Path("/Library/Fonts/Arial Unicode.ttf"),
    )
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError("No Japanese-capable font was found.")


def format_time_srt(seconds: int) -> str:
    hh = seconds // 3600
    mm = (seconds % 3600) // 60
    ss = seconds % 60
    return f"{hh:02d}:{mm:02d}:{ss:02d},000"


def format_time_video(seconds: float) -> str:
    total = int(seconds)
    mm = total // 60
    ss = total % 60
    return f"{mm:02d}:{ss:02d}"


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        current = ""
        for char in paragraph:
            tentative = current + char
            bbox = draw.textbbox((0, 0), tentative, font=font)
            width = bbox[2] - bbox[0]
            if width <= max_width or not current:
                current = tentative
                continue
            lines.append(current)
            current = char
        if current:
            lines.append(current)
        elif not lines:
            lines.append("")
    return lines


def draw_lines(
    draw: ImageDraw.ImageDraw,
    lines: Iterable[str],
    font: ImageFont.FreeTypeFont,
    x: int,
    y: int,
    fill: tuple[int, int, int],
    align: str = "left",
    line_gap: int = 8,
) -> int:
    current_y = y
    for line in lines:
        if align == "center":
            bbox = draw.textbbox((0, 0), line, font=font)
            w = bbox[2] - bbox[0]
            draw.text((x - (w // 2), current_y), line, font=font, fill=fill)
        else:
            draw.text((x, current_y), line, font=font, fill=fill)
        bbox = draw.textbbox((0, 0), line or " ", font=font)
        line_h = bbox[3] - bbox[1]
        current_y += line_h + line_gap
    return current_y


def make_gradient_bg(
    width: int,
    height: int,
    accent: tuple[int, int, int],
) -> Image.Image:
    img = Image.new("RGB", (width, height), (12, 14, 20))
    px = img.load()
    for y in range(height):
        t = y / max(1, height - 1)
        base_r = int(12 + (accent[0] * 0.42) * t)
        base_g = int(14 + (accent[1] * 0.42) * t)
        base_b = int(20 + (accent[2] * 0.42) * t)
        for x in range(width):
            x_factor = (x / max(1, width - 1)) * 0.2
            px[x, y] = (
                min(255, int(base_r + accent[0] * x_factor)),
                min(255, int(base_g + accent[1] * x_factor)),
                min(255, int(base_b + accent[2] * x_factor)),
            )
    return img


def render_scene_base(
    scene: Scene,
    width: int,
    height: int,
    font_title: ImageFont.FreeTypeFont,
    font_label: ImageFont.FreeTypeFont,
    font_body: ImageFont.FreeTypeFont,
    font_caption: ImageFont.FreeTypeFont,
) -> Image.Image:
    img = make_gradient_bg(width, height, scene.accent_rgb)
    rgba = img.convert("RGBA")
    draw = ImageDraw.Draw(rgba)

    top_margin = int(height * 0.075)
    side_margin = int(width * 0.07)
    body_top = int(height * 0.21)
    subtitle_h = int(height * 0.2)
    subtitle_y = height - subtitle_h - int(height * 0.04)

    # Top labels
    timer = f"{format_time_video(scene.start_s)} - {format_time_video(scene.end_s)}"
    draw.rounded_rectangle(
        (side_margin, top_margin, side_margin + 300, top_margin + 72),
        radius=16,
        fill=(0, 0, 0, 130),
    )
    draw_lines(draw, [timer], font_label, side_margin + 28, top_margin + 16, (255, 255, 255))

    draw.rounded_rectangle(
        (width - side_margin - 480, top_margin, width - side_margin, top_margin + 72),
        radius=16,
        fill=(0, 0, 0, 130),
    )
    draw_lines(
        draw,
        [f"画面: {scene.screen}"],
        font_label,
        width - side_margin - 452,
        top_margin + 16,
        (255, 255, 255),
    )

    # Main message card
    card_x0 = side_margin
    card_y0 = body_top
    card_x1 = width - side_margin
    card_y1 = subtitle_y - int(height * 0.05)
    draw.rounded_rectangle(
        (card_x0, card_y0, card_x1, card_y1),
        radius=24,
        fill=(14, 18, 30, 160),
        outline=(255, 255, 255, 60),
        width=2,
    )

    title = "Proof of Trust Demo"
    draw_lines(draw, [title], font_title, card_x0 + 42, card_y0 + 34, (245, 245, 245))
    draw_lines(draw, [f"操作: {scene.action}"], font_label, card_x0 + 42, card_y0 + 126, (214, 228, 255))

    body_lines = wrap_text(draw, scene.caption, font_body, card_x1 - card_x0 - 84)
    draw_lines(draw, body_lines, font_body, card_x0 + 42, card_y0 + 196, (240, 240, 240), line_gap=12)

    if scene.screen == "構成図":
        draw.rounded_rectangle(
            (card_x0 + 42, card_y1 - 230, card_x1 - 42, card_y1 - 34),
            radius=14,
            fill=(0, 0, 0, 115),
            outline=(255, 255, 255, 45),
        )
        draw_lines(draw, ARCH_LINES, font_label, card_x0 + 72, card_y1 - 194, (220, 236, 228), line_gap=6)

    # Subtitle bar
    draw.rounded_rectangle(
        (side_margin, subtitle_y, width - side_margin, subtitle_y + subtitle_h),
        radius=18,
        fill=(0, 0, 0, 160),
    )
    subtitle_lines = wrap_text(draw, scene.caption, font_caption, width - (2 * side_margin) - 70)
    line_height = draw.textbbox((0, 0), "あ", font=font_caption)[3]
    total_h = len(subtitle_lines) * line_height + (len(subtitle_lines) - 1) * 10
    start_y = subtitle_y + (subtitle_h - total_h) // 2
    draw_lines(
        draw,
        subtitle_lines,
        font_caption,
        width // 2,
        start_y,
        (255, 255, 255),
        align="center",
        line_gap=10,
    )

    return rgba.convert("RGB")


def choose_scene(second: float) -> Scene:
    for scene in SCENES:
        if scene.start_s <= second < scene.end_s:
            return scene
    return SCENES[-1]


def jpeg_bytes(image: Image.Image, quality: int) -> bytes:
    buf = BytesIO()
    image.save(buf, format="JPEG", quality=quality, optimize=False)
    return buf.getvalue()


def riff_chunk(tag: bytes, data: bytes) -> bytes:
    pad = b"\x00" if len(data) % 2 else b""
    return tag + struct.pack("<I", len(data)) + data + pad


def riff_list(tag: bytes, data: bytes) -> bytes:
    return b"LIST" + struct.pack("<I", len(data) + 4) + tag + data


def write_avi_mjpeg(
    frames_jpeg: list[bytes],
    width: int,
    height: int,
    fps: int,
    out_path: Path,
) -> None:
    total_frames = len(frames_jpeg)
    max_frame = max(len(frame) for frame in frames_jpeg)

    avih = struct.pack(
        "<IIIIIIIIII4I",
        int(1_000_000 / fps),
        max_frame * fps,
        0,
        0,
        total_frames,
        0,
        1,
        max_frame,
        width,
        height,
        0,
        0,
        0,
        0,
    )

    strh = struct.pack(
        "<4s4sIHHIIIIIIIIhhhh",
        b"vids",
        b"MJPG",
        0,
        0,
        0,
        0,
        1,
        fps,
        0,
        total_frames,
        max_frame,
        0xFFFFFFFF,
        0,
        0,
        0,
        width,
        height,
    )

    strf = struct.pack(
        "<IiiHH4sIiiII",
        40,
        width,
        height,
        1,
        24,
        b"MJPG",
        width * height * 3,
        0,
        0,
        0,
        0,
    )

    hdrl = riff_list(
        b"hdrl",
        riff_chunk(b"avih", avih)
        + riff_list(
            b"strl",
            riff_chunk(b"strh", strh) + riff_chunk(b"strf", strf),
        ),
    )

    movi_data = b"".join(riff_chunk(b"00dc", frame) for frame in frames_jpeg)
    movi = riff_list(b"movi", movi_data)
    body = hdrl + movi
    riff = b"RIFF" + struct.pack("<I", len(body) + 4) + b"AVI " + body
    out_path.write_bytes(riff)


def write_srt(out_path: Path) -> None:
    blocks: list[str] = []
    for idx, scene in enumerate(SCENES, start=1):
        blocks.append(
            "\n".join(
                (
                    str(idx),
                    f"{format_time_srt(scene.start_s)} --> {format_time_srt(scene.end_s)}",
                    scene.caption,
                    "",
                )
            )
        )
    out_path.write_text("\n".join(blocks), encoding="utf-8")


def main() -> None:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    avi_path = out_dir / "silent-subtitle-demo.avi"
    srt_path = out_dir / "silent-subtitle-demo.srt"
    poster_path = out_dir / "silent-subtitle-demo-poster.jpg"

    font_path = select_font_path()
    font_title = ImageFont.truetype(str(font_path), size=62)
    font_label = ImageFont.truetype(str(font_path), size=36)
    font_body = ImageFont.truetype(str(font_path), size=44)
    font_caption = ImageFont.truetype(str(font_path), size=48)

    total_seconds = SCENES[-1].end_s
    fps = max(1, args.fps)
    total_frames = total_seconds * fps

    scene_bases = {
        scene: render_scene_base(
            scene,
            args.width,
            args.height,
            font_title,
            font_label,
            font_body,
            font_caption,
        )
        for scene in SCENES
    }

    frames: list[bytes] = []
    for frame_idx in range(total_frames):
        second = frame_idx / fps
        scene = choose_scene(second)
        frame = scene_bases[scene].copy()
        draw = ImageDraw.Draw(frame)

        # Global progress bar at the top.
        progress_w = int(args.width * (second / max(1, total_seconds)))
        draw.rectangle((0, 0, progress_w, 10), fill=(255, 255, 255))

        # Small runtime stamp.
        time_txt = format_time_video(second)
        draw.rectangle((args.width - 156, 16, args.width - 26, 62), fill=(0, 0, 0))
        draw.text((args.width - 142, 24), time_txt, font=font_label, fill=(255, 255, 255))

        frames.append(jpeg_bytes(frame, quality=max(1, min(95, args.quality))))

    poster_frame = scene_bases[SCENES[0]]
    poster_frame.save(poster_path, format="JPEG", quality=90)

    write_avi_mjpeg(frames, args.width, args.height, fps, avi_path)
    write_srt(srt_path)

    print(f"font: {font_path}")
    print(f"video: {avi_path}")
    print(f"subtitle: {srt_path}")
    print(f"poster: {poster_path}")
    print(f"duration: {total_seconds}s @ {fps}fps ({total_frames} frames)")


if __name__ == "__main__":
    main()
