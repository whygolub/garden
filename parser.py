"""
Заказы с бирж: FL.ru, Хабр Фриланс, Kwork, публичные Telegram-каналы.
Подходящие по ключевым словам -> data/orders.json (для приложения) и в Telegram-бота.

  python parser.py              # обычный прогон
  python parser.py --dry-run    # без бота, печать в консоль
  python parser.py --test-bot   # проверить, что бот пишет тебе
"""
import html
import re
import sys
import time

import feedparser
import requests
from bs4 import BeautifulSoup

from common import BOT_ON, CONFIG, HEADERS, load_json, now_iso, push_feed, save_json, send

TIMEOUT = 20
SEEN_LIMIT = 8000   # сколько последних id помнить
FEED_LIMIT = 1500   # сколько заказов хранить для приложения


def clean(text: str) -> str:
    text = BeautifulSoup(text or "", "html.parser").get_text(" ")
    return re.sub(r"\s+", " ", text).strip()


def lead(source, uid, title, text, url, price=""):
    return {
        "id": f"{source}:{uid}",
        "source": source,
        "title": clean(title),
        "text": clean(text),
        "url": url,
        "price": clean(str(price)) if price else "",
    }


# ---------- источники ----------

def fetch_fl():
    out = []
    for feed_url in CONFIG["sources"]["fl"]["feeds"]:
        try:
            resp = requests.get(feed_url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
        except Exception as ex:
            print(f"  [fl {feed_url}] ошибка: {ex}")
            continue
        feed = feedparser.parse(resp.content)
        for e in feed.entries:
            uid = re.search(r"(\d+)", e.get("link", "")) or None
            uid = uid.group(1) if uid else e.get("link", "")
            out.append(lead("FL.ru", uid, e.get("title", ""),
                            e.get("summary", ""), e.get("link", "")))
    return out


def fetch_habr():
    out = []
    for page_url in CONFIG["sources"]["habr"]["pages"]:
        resp = requests.get(page_url, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for art in soup.select("article.task, li.content-list__item"):
            a = art.select_one(".task__title a") or art.select_one('a[href^="/tasks/"]')
            if not a:
                continue
            m = re.search(r"/tasks/(\d+)", a.get("href", ""))
            if not m:
                continue
            tags = " ".join(t.get_text(" ") for t in art.select(".tags__item_link, .tags a"))
            price_el = art.select_one(".task__price, .count")
            out.append(lead("Хабр Фриланс", m.group(1), a.get_text(" "), tags,
                            f"https://freelance.habr.com/tasks/{m.group(1)}",
                            price_el.get_text(" ") if price_el else ""))
    return out


def fetch_kwork():
    out = []
    cats = CONFIG["sources"]["kwork"].get("categories") or [None]
    for c in cats:
        data = {"page": 1}
        if c:
            data["c"] = c
        resp = requests.post(
            "https://kwork.ru/projects", data=data, timeout=TIMEOUT,
            headers={**HEADERS, "X-Requested-With": "XMLHttpRequest",
                     "Referer": "https://kwork.ru/projects"},
        )
        resp.raise_for_status()
        js = resp.json()
        d = js.get("data", js)
        wants = d.get("wants") or d.get("pagination", {}).get("data") or []
        for w in wants:
            uid = w.get("id")
            price = w.get("priceLimit") or w.get("possiblePriceLimit") or ""
            out.append(lead("Kwork", uid, w.get("name", ""), w.get("description", ""),
                            f"https://kwork.ru/projects/{uid}/view",
                            f"до {price} ₽" if price else ""))
    return out


def fetch_telegram():
    out = []
    for ch in CONFIG["sources"]["telegram"].get("channels") or []:
        ch = ch.lstrip("@").strip()
        try:
            resp = requests.get(f"https://t.me/s/{ch}", headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
        except Exception as ex:
            print(f"  [telegram @{ch}] ошибка: {ex}")
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for msg in soup.select("div.tgme_widget_message[data-post]"):
            post = msg["data-post"]  # вида channel/123
            body = msg.select_one(".tgme_widget_message_text")
            if not body:
                continue
            text = body.get_text("\n")
            first_line = next((l for l in text.split("\n") if l.strip()), "")[:120]
            out.append(lead(f"TG @{ch}", post, first_line, text, f"https://t.me/{post}"))
        time.sleep(1)
    return out


SOURCES = {"fl": fetch_fl, "habr": fetch_habr, "kwork": fetch_kwork, "telegram": fetch_telegram}


# ---------- фильтр ----------

def match(item):
    hay = f"{item['title']} {item['text']}".lower()
    kw = CONFIG["keywords"]
    if any(x.lower() in hay for x in kw.get("exclude") or []):
        return []
    return [x for x in kw["include"] if x.lower() in hay]


def format_lead(item, hits):
    e = html.escape
    snippet = item["text"]
    if snippet.startswith(item["title"]):
        snippet = snippet[len(item["title"]):].strip()
    snippet = snippet[:500] + ("…" if len(snippet) > 500 else "")
    parts = [f"<b>{e(item['title'] or 'Без названия')}</b>"]
    meta = item["source"] + (f" · {item['price']}" if item["price"] else "")
    parts.append(f"<i>{e(meta)}</i>")
    if snippet:
        parts.append(e(snippet))
    parts.append(f"🔑 {e(', '.join(hits))}")
    parts.append(f'<a href="{e(item["url"])}">Открыть заказ</a>')
    return "\n\n".join(parts)


# ---------- main ----------

def main():
    dry = "--dry-run" in sys.argv
    if "--test-bot" in sys.argv:
        print("Отправлено." if send("✅ Бот работает, заказы будут приходить сюда.") else
              "Бот не настроен: нет TG_BOT_TOKEN / TG_CHAT_ID.")
        return

    seen = load_json("seen.json", [])
    seen_set = set(seen)
    # источники, которые уже встречались; с новых старые заказы не шлём в бота
    known_sources = {i.split(":", 1)[0] for i in seen}

    items = []
    for name, fn in SOURCES.items():
        if not CONFIG["sources"].get(name, {}).get("enabled"):
            continue
        try:
            got = fn()
            print(f"[{name}] получено: {len(got)}")
            items += got
        except Exception as ex:
            print(f"[{name}] ошибка: {ex}")

    new = [i for i in items if i["id"] not in seen_set]
    matched, sent, warmed = [], 0, set()
    for item in new:
        seen.append(item["id"])
        seen_set.add(item["id"])
        hits = match(item)
        if not hits:
            continue
        item["hits"] = hits
        item["date"] = now_iso()
        matched.append(item)
        if item["source"] not in known_sources:
            warmed.add(item["source"])   # в приложение попадёт, в бота — нет
            continue
        if dry:
            print("-" * 40 + "\n" + format_lead(item, hits))
        elif BOT_ON:
            send(format_lead(item, hits))
            time.sleep(0.5)
        sent += 1

    push_feed("orders.json", matched, FEED_LIMIT)
    save_json("seen.json", seen[-SEEN_LIMIT:], compact=True)
    if warmed:
        print("Первый раз вижу: " + ", ".join(sorted(warmed)) +
              " — подходящие заказы сохранила в приложение, в бота шлю со следующего прогона.")
    print(f"Новых: {len(new)}, подошло: {len(matched)}, в бота: {sent}")


if __name__ == "__main__":
    main()
