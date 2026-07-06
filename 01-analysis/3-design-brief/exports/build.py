#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка единого HTML из дизайн-брифа «Апекс» для последующей печати в PDF.
Офлайн: только стандартный Python + модуль `markdown`.
"""

import html
import re
from pathlib import Path

import markdown

BRIEF_DIR = Path(__file__).resolve().parent.parent
OUT_HTML = Path(__file__).resolve().parent / "design-brief.html"

# Порядок документов = порядок таблицы «Экраны» в design-brief.md
DOCS = [
    ("design-brief.md", "Обзор брифа"),
    ("00-foundations.md", "Сквозные правила (foundations)"),
    ("SCR-001-registration.md", "SCR-001 · Регистрация / Вход"),
    ("SCR-002-slot-list.md", "SCR-002 · Список слотов"),
    ("BS-001-filters.md", "BS-001 · Фильтры"),
    ("SCR-003-slot-card.md", "SCR-003 · Карточка слота"),
    ("SCR-004-booking.md", "SCR-004 · Оформление записи"),
    ("BS-002-booking-success.md", "BS-002 · Подтверждение записи"),
    ("SCR-005-my-bookings.md", "SCR-005 · Мои записи"),
    ("SCR-006-booking-details.md", "SCR-006 · Детали брони + отмена"),
    ("BS-003-cancel-confirm.md", "BS-003 · Подтверждение отмены"),
    ("BS-004-route-map.md", "BS-004 · Карта трассы"),
    ("SCR-007-profile.md", "SCR-007 · Профиль клиента"),
]


def doc_anchor(filename: str) -> str:
    """Стабильный id секции из имени файла."""
    return "doc-" + re.sub(r"\.md$", "", filename)


# Множество включённых файлов → их якоря (для переписывания ссылок)
INCLUDED = {fn: doc_anchor(fn) for fn, _ in DOCS}

LINK_RE = re.compile(r'<a\s+href="([^"]+)"\s*>(.*?)</a>', re.DOTALL)


def rewrite_links(body: str) -> str:
    """
    Внутренние ссылки на включённые файлы → якоря #doc-<имя>.
    Ссылки на невключённые .md и относительные пути → простой текст (без href).
    Внешние http(s) ссылки — оставляем как есть.
    """

    def repl(m: re.Match) -> str:
        href, text = m.group(1), m.group(2)

        if href.startswith(("http://", "https://", "mailto:")):
            return m.group(0)

        # отбрасываем фрагмент (#...), берём только имя файла
        path_part = href.split("#", 1)[0]
        filename = path_part.rsplit("/", 1)[-1]

        # чистый якорь внутри того же документа (#...) — оставляем как есть
        if path_part == "":
            return m.group(0)

        if filename in INCLUDED:
            return f'<a href="#{INCLUDED[filename]}">{text}</a>'

        # невключённый файл / внешний относительный путь → простой текст
        return text

    return LINK_RE.sub(repl, body)


def build_toc() -> str:
    items = "\n".join(
        f'      <li><a href="#{doc_anchor(fn)}">{html.escape(title)}</a></li>'
        for fn, title in DOCS
    )
    return (
        '<section class="toc" id="toc">\n'
        "  <h1>Содержание</h1>\n"
        "  <ol>\n" + items + "\n  </ol>\n"
        "</section>"
    )


def render_doc(filename: str, index: int) -> str:
    src = (BRIEF_DIR / filename).read_text(encoding="utf-8")
    md = markdown.Markdown(
        extensions=["tables", "fenced_code", "sane_lists", "attr_list"]
    )
    body = md.convert(src)
    body = rewrite_links(body)

    cls = "doc" if index == 0 else "doc page-break"
    return (
        f'<section class="{cls}" id="{doc_anchor(filename)}">\n'
        f"{body}\n"
        "</section>"
    )


CSS = """
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.5; color: #1a1a1a;
  margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page-break { break-before: page; page-break-before: always; }
h1 { font-size: 19pt; margin: 0 0 .4em; line-height: 1.2; border-bottom: 2px solid #2b6cb0; padding-bottom: .2em; }
h2 { font-size: 14pt; margin: 1.2em 0 .4em; color: #2b3a4a; }
h3 { font-size: 11.5pt; margin: 1em 0 .3em; color: #2b3a4a; }
h4 { font-size: 10.5pt; margin: .9em 0 .3em; }
p { margin: .45em 0; }
a { color: #2b6cb0; text-decoration: none; }
ul, ol { margin: .4em 0; padding-left: 1.5em; }
li { margin: .15em 0; }
hr { border: 0; border-top: 1px solid #d6dbe0; margin: 1.2em 0; }
strong { color: #111; }
code { font-family: "SF Mono", "Menlo", "Consolas", monospace; font-size: 9pt;
       background: #f1f3f5; padding: .05em .3em; border-radius: 3px; }
pre {
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 8.3pt; line-height: 1.35;
  white-space: pre; overflow: visible;
  background: #f6f8fa; border: 1px solid #dfe2e5; border-radius: 5px;
  padding: 10px 12px; margin: .7em 0;
  break-inside: avoid; page-break-inside: avoid;
}
pre code { background: none; padding: 0; font-size: inherit; }
blockquote {
  margin: .7em 0; padding: .5em .9em; border-left: 3px solid #b8c4d0;
  background: #f7f9fb; color: #3a4856; font-size: 9.8pt;
}
blockquote p { margin: .25em 0; }
table { border-collapse: collapse; width: 100%; margin: .7em 0; font-size: 9.3pt;
        break-inside: avoid; page-break-inside: avoid; }
th, td { border: 1px solid #cfd6dd; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #eef2f6; font-weight: 600; }
tr:nth-child(even) td { background: #fafbfc; }

/* Титул и оглавление */
.cover { text-align: center; padding-top: 28mm; }
.cover .kicker { font-size: 11pt; letter-spacing: .12em; text-transform: uppercase; color: #6b7785; }
.cover h1 { font-size: 30pt; border: 0; margin: .3em 0 .2em; }
.cover .sub { font-size: 13pt; color: #3a4856; max-width: 130mm; margin: 0 auto; }
.cover .meta { margin-top: 2em; font-size: 10pt; color: #6b7785; }
.toc { break-before: page; page-break-before: always; }
.toc h1 { border-bottom: 2px solid #2b6cb0; }
.toc ol { font-size: 11pt; line-height: 1.9; }
"""


def main() -> None:
    cover = (
        '<section class="cover">\n'
        '  <div class="kicker">Дизайн-бриф · UI/UX</div>\n'
        "  <h1>«Апекс»</h1>\n"
        '  <div class="sub">Требования на дизайн клиентского мобильного приложения '
        "самостоятельной записи на заезды уличного картинг-центра</div>\n"
        '  <div class="meta">Сквозные правила + 11 экранов и шторок · '
        "Черновик, версия 0.1 · 2026-06-15</div>\n"
        "</section>"
    )

    sections = [render_doc(fn, i) for i, (fn, _) in enumerate(DOCS)]

    html_doc = (
        "<!DOCTYPE html>\n"
        '<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
        "<title>Дизайн-бриф · Апекс</title>\n"
        f"<style>{CSS}</style>\n</head>\n<body>\n"
        + cover + "\n"
        + build_toc() + "\n"
        + "\n".join(sections)
        + "\n</body>\n</html>\n"
    )

    OUT_HTML.write_text(html_doc, encoding="utf-8")
    print(f"HTML собран: {OUT_HTML}  ({len(html_doc):,} байт, {len(DOCS)} документов)")


if __name__ == "__main__":
    main()
