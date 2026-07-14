import { test, expect } from '@playwright/test';

test.describe('ECR System End-to-End Tests', () => {

  test('Staff Portal Login & Sidebar Navigation Journey', async ({ page }) => {
    // 1. Visit the LoginPage
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Error Correction System');

    // 2. Click on Staff Portal tab (should be default, but verify button click)
    await page.click('button:has-text("Staff Portal")');

    // 3. Fill login credentials
    await page.fill('input[placeholder="Enter your email"]', 'velandimplementation@gmail.com');
    await page.fill('input[type="password"]', 'Password@123');

    // 4. Click Submit
    await page.click('button[type="submit"]');

    // 5. Verify successful navigation to Staff Dashboard
    await expect(page).toHaveURL('/');
    
    // 6. Verify Dashboard title text based on GM role
    await expect(page.locator('h1')).toContainText('General Manager Dashboard');

    // 7. Verify Sidebar link presence
    await expect(page.locator('.sidebar-nav')).toBeVisible();
    await expect(page.locator('a:has-text("Reports")')).toBeVisible();

    // 8. Logout
    await page.click('.btn-logout');
    await expect(page).toHaveURL('/login');
  });

  test('Admin Portal Login & Navigation Journey', async ({ page }) => {
    // 1. Visit LoginPage
    await page.goto('/login');

    // 2. Click on Admin Portal Tab
    await page.click('button:has-text("Admin Portal")');

    // 3. Fill admin credentials
    await page.fill('input[placeholder="admin@velan.com"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');

    // 4. Submit
    await page.click('button[type="submit"]');

    // 5. Admin portal redirects to '/users' (Admin Console)
    await expect(page).toHaveURL('/users');

    // 6. Verify sidebar section title for admins
    await expect(page.locator('.nav-section-title:has-text("Admin")')).toBeVisible();

    // 7. Logout
    await page.click('.btn-logout');
    await expect(page).toHaveURL('/login');
  });
});
