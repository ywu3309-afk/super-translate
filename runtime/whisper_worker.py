#!/usr/bin/env python
"""Persistent, local-only faster-whisper worker for Super Translate.

The parent Electron process exchanges one JSON object per line over stdin/stdout.
Audio is passed by a short-lived local WAV path so raw customer media never
leaves the computer.  Diagnostics go to stderr; stdout is reserved for JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def clean_language(value: object) -> str | None:
    language = str(value or "").strip()
    if language in {"", "auto"}:
        return None
    # Whisper expects ISO-639-1 for the languages exposed by the client.  Both
    # Chinese UI variants map to the same speech language.
    aliases = {"zh-CN": "zh", "zh-TW": "zh", "yue": "zh"}
    return aliases.get(language, language)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--device", default="cpu", choices=("cpu", "cuda"))
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    model_dir = Path(args.model_dir).resolve()
    if not (model_dir / "model.bin").is_file():
        emit({"event": "fatal", "error": "Whisper model.bin is missing"})
        return 2

    try:
        from faster_whisper import WhisperModel

        started = time.monotonic()
        model = WhisperModel(
            str(model_dir),
            device=args.device,
            compute_type=args.compute_type,
            local_files_only=True,
        )
        emit(
            {
                "event": "ready",
                "model": model_dir.name,
                "device": args.device,
                "computeType": args.compute_type,
                "loadedMs": round((time.monotonic() - started) * 1000),
            }
        )
    except Exception as exc:
        emit({"event": "fatal", "error": str(exc)[-800:]})
        return 3

    for raw in sys.stdin:
        try:
            request = json.loads(raw)
            request_id = request.get("id")
            operation = request.get("op")
            if operation == "stop":
                emit({"id": request_id, "ok": True})
                return 0
            if operation != "transcribe":
                raise ValueError("Unsupported worker operation")

            audio_path = Path(str(request.get("file") or "")).resolve()
            if not audio_path.is_file() or audio_path.suffix.lower() != ".wav":
                raise ValueError("A local WAV file is required")

            language = clean_language(request.get("language"))
            started = time.monotonic()
            segments_iter, info = model.transcribe(
                str(audio_path),
                language=language,
                task="transcribe",
                beam_size=5,
                vad_filter=True,
                condition_on_previous_text=False,
                word_timestamps=False,
            )
            segments = []
            text_parts = []
            for item in segments_iter:
                text = str(item.text or "").strip()
                if not text:
                    continue
                text_parts.append(text)
                if len(segments) < 500:
                    segments.append(
                        {
                            "start": round(float(item.start or 0), 3),
                            "end": round(float(item.end or 0), 3),
                            "text": text,
                        }
                    )
            text = " ".join(text_parts).strip()
            emit(
                {
                    "id": request_id,
                    "ok": True,
                    "text": text[:6000],
                    "language": str(info.language or language or "auto")[:20],
                    "languageProbability": float(info.language_probability or 0),
                    "duration": float(getattr(info, "duration", 0) or 0),
                    "segments": segments,
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                }
            )
        except Exception as exc:
            emit({"id": locals().get("request_id"), "ok": False, "error": str(exc)[-800:]})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
