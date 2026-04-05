#!/usr/bin/env python3
"""
Тесты лендинга Spring Tracker.
Запуск: python3 test_landing.py <path_to_file>
Завершается с кодом 1 если есть падения.
"""
import sys, re

def load(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def run_tests(html):
    results = []

    def test(name, ok, fail_msg, ok_msg='OK'):
        results.append((name, ok, ok_msg if ok else fail_msg))

    # 1. Нет CF email-protection в HTML
    cf_count = len(re.findall(r'email-protection', html))
    test('Нет CF email-protection',
         cf_count == 0,
         f'Найдено {cf_count} вхождений email-protection')

    # 2. Нет __cf_email__ спанов
    cf_span = len(re.findall(r'__cf_email__', html))
    test('Нет __cf_email__ спанов',
         cf_span == 0,
         f'Найдено {cf_span} спанов __cf_email__')

    # 3. Нет CF decode скриптов
    cf_scripts = len(re.findall(r'email-decode\.min\.js', html))
    test('Нет CF decode скриптов',
         cf_scripts == 0,
         f'Найдено {cf_scripts} CF decode скриптов')

    # 4. Есть mailto: ссылки
    mailto_count = len(re.findall(r'mailto:', html))
    test('Есть mailto: ссылки',
         mailto_count >= 3,
         f'Найдено только {mailto_count} mailto: (ожидается >= 3)',
         f'Найдено {mailto_count} mailto: ссылок')

    # 5. HTML не обрезан — закрыт </html>
    test('Файл закрыт </html>',
         html.strip().endswith('</html>'),
         'Файл не заканчивается </html> — возможно обрезан')

    # 6. </body> на месте
    test('Тег </body> закрыт',
         '</body>' in html,
         '</body> не найден')

    # 7. Typewriter IIFE закрыт
    test('Typewriter скрипт не обрезан',
         '})();' in html or '})()' in html,
         'IIFE не закрыт — typewriter скрипт обрезан')

    # 8. getElementById('typewriter') есть
    test('getElementById typewriter есть',
         "getElementById('typewriter')" in html or 'getElementById("typewriter")' in html,
         'getElementById typewriter не найден')

    # 9. overflow-x: hidden в CSS
    test('overflow-x: hidden в CSS',
         'overflow-x: hidden' in html or 'overflow-x:hidden' in html,
         'overflow-x: hidden не найден')

    # 10. Viewport meta
    test('Viewport meta есть',
         'width=device-width' in html,
         'Viewport meta не найден')

    # 11. Mobile media query
    test('@media max-width: 480px есть',
         'max-width: 480px' in html or 'max-width:480px' in html,
         'Нет @media (max-width: 480px)')

    # 12. white-space: nowrap не переопределен в мобильном media query
    mobile_block = re.search(r'max-width:\s*480px\s*\)(.*?)(?=@media|\Z)', html, re.S)
    mobile_nowrap = False
    if mobile_block:
        mobile_nowrap = 'white-space: nowrap' in mobile_block.group(1) or 'white-space:nowrap' in mobile_block.group(1)
    test('white-space: nowrap не задан в mobile query',
         not mobile_nowrap,
         'white-space: nowrap найден внутри @media (max-width: 480px) — сломает typewriter')

    # 13. OG теги
    has_og_title = 'og:title' in html
    has_og_image = 'og:image' in html
    test('OG теги og:title и og:image',
         has_og_title and has_og_image,
         f'Не найдено: {", ".join([x for x,v in [("og:title",has_og_title),("og:image",has_og_image)] if not v])}')

    # 14. Нет незакрытых <script> (грубая проверка баланса)
    opens = len(re.findall(r'<script[\s>]', html))
    closes = len(re.findall(r'</script>', html))
    test('Теги <script> сбалансированы',
         opens == closes,
         f'<script>: {opens} открывающих, {closes} закрывающих')

    # 15. centered-section padding на мобильном
    test('Мобильный padding для centered-section',
         'centered-section' in html and ('padding: 56px 16px' in html or 'padding:56px 16px' in html or 'padding: 60px 16px' in html),
         'centered-section не имеет мобильного padding в 480px query')

    return results

def main():
    if len(sys.argv) < 2:
        print('Usage: python3 test_landing.py <file>')
        sys.exit(1)

    path = sys.argv[1]
    try:
        html = load(path)
    except Exception as e:
        print(f'ОШИБКА: не могу прочитать файл: {e}')
        sys.exit(1)

    results = run_tests(html)

    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total = len(results)

    print(f'\n=== Тесты лендинга: {path} ===\n')
    for name, ok, msg in results:
        icon = '✓' if ok else '✗'
        print(f'  {icon} {name}')
        if not ok:
            print(f'      → {msg}')

    print(f'\n  Итог: {passed}/{total} прошло, {failed} упало\n')

    if failed > 0:
        sys.exit(1)
    sys.exit(0)

if __name__ == '__main__':
    main()
