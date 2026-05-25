import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const OUT  = 'C:/tmp/audit';
fs.mkdirSync(OUT, { recursive: true });

const EMAIL    = 'audit_mobile_test@poupaup.dev';
const PASSWORD = 'Audit@12345!';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();

  // ── 1. Página de login ──
  await page.goto(BASE + '/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: OUT + '/01-login.png', fullPage: true });
  console.log('01 login captured');

  // ── 2. Registrar ou logar ──
  // Tenta login; se falhar, registra
  const emailInput = page.locator('input[type="email"]').first();
  const passInput  = page.locator('input[type="password"]').first();
  await emailInput.fill(EMAIL);
  await passInput.fill(PASSWORD);
  await page.screenshot({ path: OUT + '/02-login-filled.png', fullPage: true });

  // Clica no botão de login
  const loginBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")').first();
  await loginBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + '/03-after-login.png', fullPage: true });
  console.log('03 after login captured — url:', page.url());

  // Se ainda na página de login, tenta criar conta
  if (page.url().includes('login')) {
    // Procura link de cadastro
    const signupLink = page.locator('a:has-text("cadastr"), a:has-text("Criar"), a:has-text("Registr")').first();
    if (await signupLink.count() > 0) {
      await signupLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: OUT + '/03b-signup.png', fullPage: true });
      const emailS = page.locator('input[type="email"]').first();
      const passS  = page.locator('input[type="password"]').first();
      await emailS.fill(EMAIL);
      await passS.fill(PASSWORD);
      const submitS = page.locator('button[type="submit"]').first();
      await submitS.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: OUT + '/03c-after-signup.png', fullPage: true });
    }
  }

  // ── 3. Dashboard ──
  if (!page.url().includes('dashboard')) {
    await page.goto(BASE + '/dashboard');
    await page.waitForTimeout(3000);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: OUT + '/04-dashboard-top.png', fullPage: false });
  await page.screenshot({ path: OUT + '/04-dashboard-full.png', fullPage: true });
  console.log('04 dashboard captured');

  // ── 4. Scroll para ver conteúdo completo ──
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/05-dashboard-scroll.png', fullPage: false });

  // ── 5. Verificar se bottom nav aparece ──
  const bottomNav = page.locator('.mobile-bottom-nav');
  const navVisible = await bottomNav.isVisible();
  console.log('bottom nav visible:', navVisible);

  // ── 6. Verificar sidebar ──
  const sidebar = page.locator('aside[data-tour="tour-sidebar"]');
  const sidebarVisible = await sidebar.isVisible();
  console.log('sidebar visible (should be false on mobile):', sidebarVisible);

  // ── 7. Simular pull-to-refresh (reload) ──
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '/06-after-reload.png', fullPage: false });
  console.log('06 after reload captured');

  // Check sidebar again after reload
  const sidebarAfterReload = await page.locator('aside[data-tour="tour-sidebar"]').isVisible();
  console.log('sidebar visible after reload (should be false):', sidebarAfterReload);

  // ── 8. Navegação ──
  await page.goto(BASE + '/dashboard/gastos');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '/07-gastos.png', fullPage: false });
  console.log('07 gastos captured');

  await page.goto(BASE + '/dashboard/lancamento');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '/08-lancamento.png', fullPage: false });
  console.log('08 lancamento captured');

  await browser.close();
  console.log('\nAll screenshots saved to', OUT);
})().catch(e => { console.error(e); process.exit(1); });
