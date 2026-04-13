// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';

// --- Desktop ---
test.describe('Desktop (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('страница открывается и заголовок верный', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Spring Tracker/);
  });

  test('нет горизонтального скролла', async ({ page }) => {
    await page.goto(BASE_URL);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('typewriter не стартует раньше окончания анимации ростка', async ({ page }) => {
    // Захватываем текст синхронно в момент DOMContentLoaded — до любых таймеров
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        window.__twAtDCL = document.getElementById('typewriter')?.textContent || '';
      });
    });
    await page.goto(BASE_URL);
    const twAtDCL = await page.evaluate(() => window.__twAtDCL || '');
    expect(twAtDCL.replace(/\s/g, '')).toBe('');

    // После 2.5с текст уже должен появиться
    await page.waitForTimeout(2500);
    const textAt2_5s = await page.locator('#typewriter').innerText();
    expect(textAt2_5s.length).toBeGreaterThan(3);
  });

  test('typewriter напечатал текст', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => {
      const el = document.getElementById('typewriter');
      return el && el.innerText.replace(/\s/g, '').length > 3;
    }, { timeout: 8000 });
    const text = await page.locator('#typewriter').innerText();
    expect(text.length).toBeGreaterThan(3);
  });

  test('email отображается как текст, не как [email protected]', async ({ page }) => {
    await page.goto(BASE_URL);
    const content = await page.content();
    expect(content).not.toContain('__cf_email__');
    expect(content).not.toContain('email-protection');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('qt.trek@gmail.com');
  });

  test('nav присутствует и не скрыт', async ({ page }) => {
    await page.goto(BASE_URL);
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('кнопка "Начать" ведёт на /app.html', async ({ page }) => {
    await page.goto(BASE_URL);
    const btn = page.locator('a.btn-primary').first();
    await expect(btn).toBeVisible();
    const href = await btn.getAttribute('href');
    expect(href).toContain('app.html');
  });

  test('все 4 секции присутствуют', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('#skills')).toBeVisible();
    await expect(page.locator('.faq-section')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('FAQ раскрывается по клику', async ({ page }) => {
    await page.goto(BASE_URL);
    const firstQ = page.locator('.faq-item').first();
    await firstQ.click();
    const answer = firstQ.locator('.faq-a');
    await expect(answer).toBeVisible();
  });

  test('лайтбокс открывается по клику на телефон', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('.phone-frame').first().click();
    const lightbox = page.locator('.lightbox');
    await expect(lightbox).toHaveClass(/active/, { timeout: 2000 });
  });

  test('лайтбокс закрывается по Escape', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('.phone-frame').first().click();
    await page.keyboard.press('Escape');
    const lightbox = page.locator('.lightbox');
    await expect(lightbox).not.toHaveClass(/active/);
  });
});

// --- Mobile ---
test.describe('Mobile (375x812, iPhone SE)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('нет горизонтального скролла на мобильном', async ({ page }) => {
    await page.goto(BASE_URL);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('typewriter работает на мобильном', async ({ page }) => {
    await page.goto(BASE_URL);
    const tw = page.locator('#typewriter');
    await expect(tw).not.toBeEmpty({ timeout: 5000 });
  });

  test('hero контент не обрезан', async ({ page }) => {
    await page.goto(BASE_URL);
    const hero = page.locator('.hero');
    const box = await hero.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  });

  test('nav кнопка видна на мобильном', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('.nav-btn')).toBeVisible();
  });

  test('email виден на мобильном', async ({ page }) => {
    await page.goto(BASE_URL);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('qt.trek@gmail.com');
  });

  test('footer не выходит за границы экрана', async ({ page }) => {
    await page.goto(BASE_URL);
    const footer = page.locator('footer');
    const box = await footer.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  });
});

// --- SEO и мета ---
test.describe('SEO и мета-теги', () => {
  test('og:title присутствует', async ({ page }) => {
    await page.goto(BASE_URL);
    const og = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(og).toBeTruthy();
    expect(og).toContain('Spring Tracker');
  });

  test('og:image присутствует', async ({ page }) => {
    await page.goto(BASE_URL);
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toBeTruthy();
  });

  test('meta description присутствует', async ({ page }) => {
    await page.goto(BASE_URL);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc.length).toBeGreaterThan(20);
  });

  test('canonical ссылка присутствует', async ({ page }) => {
    await page.goto(BASE_URL);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();
  });
});
