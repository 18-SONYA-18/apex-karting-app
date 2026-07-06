#!/usr/bin/env bash
# Сборка PDF дизайн-брифа «Апекс» (картинг-центр): md -> HTML (Python) -> PDF (Chrome headless).
# Работает на Mac, Linux и Windows (через WSL/Git Bash).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="$DIR/design-brief.html"
PDF="$DIR/design-brief.pdf"

# === Проверка Python и модуля markdown ===
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON=python
  else
    echo "❌ Ошибка: не найден Python."
    echo "   Установите Python 3: https://www.python.org/downloads/"
    exit 1
  fi
else
  PYTHON=python3
fi

if ! "$PYTHON" -c "import markdown" 2>/dev/null; then
  echo "⚠️  Модуль 'markdown' не установлен. Устанавливаем..."
  "$PYTHON" -m pip install --quiet markdown
fi

# === Поиск Chrome / Chromium / Edge ===
find_browser() {
  # Mac
  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return
  fi
  # Linux (разные варианты установки)
  for cmd in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$cmd" >/dev/null 2>&1; then
      command -v "$cmd"
      return
    fi
  done
  # Windows — Chrome
  if [ -x "/c/Program Files/Google/Chrome/Application/chrome.exe" ]; then
    echo "/c/Program Files/Google/Chrome/Application/chrome.exe"
    return
  fi
  if [ -x "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" ]; then
    echo "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    return
  fi
  # Windows — Edge (предустановлен в Windows 10/11)
  if [ -x "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" ]; then
    echo "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    return
  fi
  if [ -x "/c/Program Files/Microsoft/Edge/Application/msedge.exe" ]; then
    echo "/c/Program Files/Microsoft/Edge/Application/msedge.exe"
    return
  fi
  echo ""
}

BROWSER=$(find_browser)

if [ -z "$BROWSER" ]; then
  echo "❌ Ошибка: не найден Google Chrome / Chromium / Edge."
  echo "   Установите один из браузеров и повторите запуск."
  echo "   Mac:     https://www.google.com/chrome/"
  echo "   Linux:   sudo apt install chromium-browser"
  echo "   Windows: https://www.google.com/chrome/"
  echo "            (или используйте предустановленный Edge)"
  exit 1
fi

# Определяем имя браузера для вывода
BROWSER_NAME=$(basename "$BROWSER" .exe)
case "$BROWSER_NAME" in
  chrome)   BROWSER_LABEL="Google Chrome" ;;
  msedge)   BROWSER_LABEL="Microsoft Edge" ;;
  chromium) BROWSER_LABEL="Chromium" ;;
  *)        BROWSER_LABEL="$BROWSER_NAME" ;;
esac

echo "==> 1/2  Сборка HTML"
"$PYTHON" "$DIR/build.py"

echo "==> 2/2  Печать в PDF (headless)"
echo "   Браузер: $BROWSER_LABEL"
"$BROWSER" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PDF" "file://$HTML" 2>/dev/null

echo ""
echo "✅ Готово: $PDF"
ls -lh "$PDF" | awk '{print "   Размер:", $5}'