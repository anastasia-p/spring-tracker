#!/usr/bin/env python3
"""
Статические проверки app.html — consent-логика Яндекс.Метрики
и cross-tab sync. Запускать перед деплоем app.html.

Использование:
    python3 tools/test_app.py [path/to/app.html]
По умолчанию проверяется app.html в текущей папке.

Exit code 0 если все проверки прошли, 1 если хотя бы одна упала.
"""

import re
import sys
from pathlib import Path

YM_COUNTER = "108404687"


def check(name, condition, hint=""):
    """Печатает результат и возвращает 1 если упало, 0 если ок."""
    if condition:
        print(f"  \u2713 {name}")
        return 0
    suffix = f" \u2014 {hint}" if hint else ""
    print(f"  \u2717 {name}{suffix}")
    return 1


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "app.html")
    if not path.exists():
        print(f"ERROR: {path} не найден")
        return 1

    src = path.read_text(encoding="utf-8")
    print(f"Проверяю {path}\n")

    failed = 0

    # --- Consent: загрузка Метрики ---
    print("Consent: загрузка Метрики")

    # 1. КРИТИЧЕСКАЯ: ym(...,"init",...) встречается ровно 1 раз
    #    и только внутри window.loadYandexMetrika.
    #    Если кто-то откатит consent-логику и вернет init на верхний уровень
    #    (как было до consent-gating), эта проверка упадет.
    init_matches = list(re.finditer(r'ym\([^)]*?"init"', src))
    fn_match = re.search(
        r'window\.loadYandexMetrika\s*=\s*function\s*\(\)\s*\{', src)
    if fn_match:
        # Ищем закрывающую }; функции от позиции после открывающей {.
        body_start = fn_match.end()
        depth = 1
        i = body_start
        while i < len(src) and depth > 0:
            if src[i] == "{":
                depth += 1
            elif src[i] == "}":
                depth -= 1
            i += 1
        fn_body_range = (fn_match.start(), i)
        all_inside = all(
            fn_body_range[0] <= m.start() <= fn_body_range[1]
            for m in init_matches
        )
    else:
        all_inside = False

    failed += check(
        "1. ym(...,\"init\",...) встречается ровно 1 раз и только внутри loadYandexMetrika",
        len(init_matches) == 1 and all_inside,
        f"найдено {len(init_matches)} вхождений, "
        f"{'все внутри' if all_inside else 'есть снаружи функции'}"
    )

    # 2. window.loadYandexMetrika определена
    failed += check(
        "2. window.loadYandexMetrika определена",
        bool(fn_match),
        "ищу 'window.loadYandexMetrika = function () {'"
    )

    # 3. Стаб ym создается всегда (буфер ym.a для вызовов до загрузки tag.js).
    #    Паттерн из стандартного snippet Метрики: m[i]=m[i]||function(){...}.
    failed += check(
        "3. Стаб ym с буфером ym.a (для inline reachGoal до accept)",
        bool(re.search(r'm\[i\]\s*=\s*m\[i\]\s*\|\|\s*function', src)),
        "не нашел паттерн 'm[i]=m[i]||function'"
    )

    # 4. Авто-загрузка при ранее данном согласии.
    #    Условие if (localStorage.getItem("cookieConsent") === "accepted")
    #    в head-блоке, до баннера.
    auto_load = re.search(
        r'localStorage\.getItem\(["\']cookieConsent["\']\)\s*===\s*["\']accepted["\'].*?'
        r'loadYandexMetrika\s*\(\s*\)',
        src, re.DOTALL
    )
    failed += check(
        "4. Авто-загрузка Метрики при cookieConsent === 'accepted'",
        bool(auto_load),
        "не нашел блок проверки accepted с вызовом loadYandexMetrika()"
    )

    # 5. <noscript>-пиксель Метрики удален.
    #    Без JS пользователь не может дать согласие — пиксель тоже не должен срабатывать.
    failed += check(
        "5. <noscript>-пиксель Метрики удален",
        "mc.yandex.ru/watch" not in src,
        "найдена ссылка на mc.yandex.ru/watch — был noscript-пиксель?"
    )

    # 6. Счетчик YM_COUNTER используется (не подменен случайно)
    failed += check(
        f"6. Счетчик {YM_COUNTER} используется",
        YM_COUNTER in src,
        f"не нашел {YM_COUNTER} в файле"
    )

    # --- Consent: баннер ---
    print("\nConsent: баннер")

    # 7. Есть #cookie-banner в DOM
    failed += check(
        "7. id=\"cookie-banner\" присутствует",
        'id="cookie-banner"' in src,
        "не нашел div с id=cookie-banner"
    )

    # 8. Есть кнопки accept/decline
    failed += check(
        "8. id=\"cookie-accept\" и id=\"cookie-decline\" присутствуют",
        'id="cookie-accept"' in src and 'id="cookie-decline"' in src,
        "одна из кнопок отсутствует"
    )

    # 9. localStorage.getItem("cookieConsent") встречается >= 2 раз
    #    (head — авто-загрузка; скрипт баннера — guard и/или storage handler).
    consent_get_count = len(
        re.findall(r'localStorage\.getItem\(["\']cookieConsent["\']\)', src))
    failed += check(
        "9. localStorage.getItem(\"cookieConsent\") встречается >= 2 раз",
        consent_get_count >= 2,
        f"найдено {consent_get_count}"
    )

    # 10. Оба consent-значения 'accepted' и 'declined' встречаются в коде.
    #     Раньше тест считал setItem-вхождения, но при рефакторинге в одну
    #     функцию setConsent() это становилось ложным фейлом. Проверка
    #     наличия литералов устойчивее: если кто-то удалит handler decline-кнопки
    #     или авто-загрузку для accepted — соответствующее значение пропадет.
    has_accepted = "'accepted'" in src or '"accepted"' in src
    has_declined = "'declined'" in src or '"declined"' in src
    failed += check(
        "10. Оба значения 'accepted' и 'declined' встречаются в коде",
        has_accepted and has_declined,
        f"accepted: {has_accepted}, declined: {has_declined}"
    )

    # --- Consent: показ только на auth-экране ---
    print("\nConsent: показ только на auth-экране")

    # 11. setTimeout с проверкой видимости auth-screen.
    #     Защита от моргания у залогиненных: Firebase успевает скрыть auth-screen
    #     до того, как баннер покажется.
    failed += check(
        "11. setTimeout для отложенного показа баннера (защита от моргания)",
        bool(re.search(r'setTimeout\s*\(', src)) and "isAuthVisible" in src,
        "не нашел setTimeout с isAuthVisible"
    )

    # 12. MutationObserver на #auth-screen.
    #     Если юзер залогинился, не выбрав consent — баннер должен скрыться.
    failed += check(
        "12. MutationObserver следит за изменением auth-screen",
        "MutationObserver" in src and "auth-screen" in src,
        "не нашел MutationObserver или ссылку на auth-screen"
    )

    # --- Consent: cross-tab sync и bfcache ---
    print("\nConsent: cross-tab sync и bfcache")

    # 13. storage event listener для синхронизации между вкладками.
    failed += check(
        "13. addEventListener(\"storage\", ...) для cross-tab sync",
        bool(re.search(
            r'addEventListener\s*\(\s*["\']storage["\']', src)),
        "не нашел подписку на storage event"
    )

    # 14. pageshow listener для bfcache.
    # При возврате через "назад" страница восстанавливается из кеша со старым
    # DOM. Скрипт повторно не выполняется — pageshow с persisted=true даёт
    # точку перепроверки: если на лендинге юзер выбрал consent, здесь применяем.
    failed += check(
        "14. addEventListener(\"pageshow\", ...) для bfcache",
        bool(re.search(
            r'addEventListener\s*\(\s*["\']pageshow["\']', src)),
        "не нашел подписку на pageshow event"
    )

    # --- Итог ---
    total = 14
    passed = total - failed
    print(f"\n{'=' * 50}")
    if failed == 0:
        print(f"\u2713 Все проверки прошли ({passed}/{total})")
        return 0
    print(f"\u2717 Провалено {failed} из {total}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
