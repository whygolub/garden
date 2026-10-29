"""Общие штуки: настройки, хранилище данных, отправка в Telegram-бота."""
import datetime as dt
import json
import os
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
import yaml

ROOT = Path(__file__).parent
# Папка с данными. В GitHub Actions сюда подключается приватный репозиторий с данными.
DATA = Path(os.getenv("DATA_DIR", ROOT / "data"))
DATA.mkdir(parents=True, exist_ok=True)
# Настройки лежат в приватном репозитории (data/config.yaml), чтобы их не было видно публично.
_cfg = DATA / "config.yaml"
if not _cfg.exists():
    print("Нет config.yaml в приватном репозитории, беру config.example.yaml")
    _cfg = ROOT / "config.example.yaml"
CONFIG = yaml.safe_load(_cfg.read_text(encoding="utf-8"))

TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9",
}
MSK = ZoneInfo("Europe/Moscow")

BOT_TOKEN = os.getenv("TG_BOT_TOKEN", "")
CHAT_ID = os.getenv("TG_CHAT_ID", "")
BOT_ON = bool(BOT_TOKEN and CHAT_ID)


def now_iso():
    return dt.datetime.now(MSK).isoformat(timespec="minutes")


# ---------- хранилище ----------

def load_json(name, default):
    p = DATA / name
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"[{name}] повреждён, начинаю заново")
    return default


def _dump(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def _lines(obj, top=True):
    """JSON по строке на элемент: компактно и хорошо сжимается в истории git."""
    if isinstance(obj, list):
        return "[\n" + ",\n".join(_dump(x) for x in obj) + "\n]"
    if isinstance(obj, dict) and top:
        return "{\n" + ",\n".join(
            f"{_dump(k)}:{_lines(v, False) if isinstance(v, (list, dict)) else _dump(v)}"
            for k, v in obj.items()) + "\n}"
    if isinstance(obj, dict):
        return "{\n" + ",\n".join(f"{_dump(k)}:{_dump(v)}" for k, v in obj.items()) + "\n}"
    return _dump(obj)


def save_json(name, obj, compact=True):
    p = DATA / name
    tmp = p.with_suffix(".tmp")
    tmp.write_text(_lines(obj) + "\n", encoding="utf-8")
    tmp.replace(p)


def push_feed(name, new_items, limit):
    """Добавляет элементы в ленту (новые сверху) и обрезает до limit."""
    feed = load_json(name, {"items": []})
    known = {i["id"] for i in feed["items"]}
    fresh = [i for i in new_items if i["id"] not in known]
    feed["items"] = (fresh[::-1] + feed["items"])[:limit]
    feed["updated"] = now_iso()
    save_json(name, feed, compact=True)
    return len(fresh)


# ---------- Telegram-бот (необязательно) ----------

def _api(method, **kw):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    for _ in range(5):
        r = requests.post(url, timeout=120, **kw)
        if r.status_code == 429:
            time.sleep(r.json().get("parameters", {}).get("retry_after", 5) + 1)
            if "files" in kw:
                for f in kw["files"].values():
                    f.seek(0)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("Telegram: слишком много запросов")


def send(text):
    if not BOT_ON:
        return None
    try:
        return _api("sendMessage", json={
            "chat_id": CHAT_ID, "text": text[:4096], "parse_mode": "HTML",
            "disable_web_page_preview": True,
        })
    except Exception as ex:
        print(f"[бот] не отправилось: {ex}")


def send_document(path, caption=""):
    if not BOT_ON:
        return None
    try:
        with open(path, "rb") as f:
            return _api("sendDocument", data={"chat_id": CHAT_ID, "caption": caption[:1024],
                                              "parse_mode": "HTML"},
                        files={"document": f})
    except Exception as ex:
        print(f"[бот] файл не отправился: {ex}")
