import { test, expect } from '@playwright/test';

test.describe('Author First Challenge Tab-by-Tab Modal Flow', () => {
  test('Admin Problem Suites displays Author First Challenge and steps through tabs with Save & Continue', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    // 1. Navigate to Admin Mission Control on port 8082
    await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });

    // 2. Unlock if proctor key lock screen is shown
    const proctorInput = page.locator('input[type="password"], input[placeholder*="key" i], input[placeholder*="proctor" i]');
    if (await proctorInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await proctorInput.fill('1337');
      const unlockBtn = page.locator('button:has-text("Unlock"), button:has-text("Enter")');
      await unlockBtn.click();
    }

    // 3. Navigate to "02 Problem Suites" tab
    const problemSuitesTab = page.locator('button:has-text("Problem Suites"), button:has-text("02")').first();
    await expect(problemSuitesTab).toBeVisible({ timeout: 5000 });
    await problemSuitesTab.click();

    // 4. Verify Problem Suites panel is loaded
    await expect(page.locator('text=Problem Suite & Cryptographic Testcase Vault').first()).toBeVisible({ timeout: 5000 });

    // 5. Check for "Author First Challenge" or "Add Problem"
    const authorFirstBtn = page.locator('button:has-text("Author First Challenge")').first();
    const addProblemBtn = page.locator('button:has-text("Add Problem")').first();

    const triggerBtn = (await authorFirstBtn.isVisible().catch(() => false)) ? authorFirstBtn : addProblemBtn;
    await expect(triggerBtn).toBeVisible({ timeout: 5000 });
    await triggerBtn.click();

    // 6. Verify Tab-by-Tab Modal is mounted
    const modal = page.locator('text=Author Challenge').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 7. Verify all 4 step tabs exist
    const tab1 = page.locator('button:has-text("Specifications")').first();
    const tab2 = page.locator('button:has-text("Function Contract")').first();
    const tab3 = page.locator('button:has-text("Problem Statement")').first();
    const tab4 = page.locator('button:has-text("Test Suite & Vault")').first();

    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(tab4).toBeVisible();

    // 8. Tab 1 verification: Fill in Title
    const titleInput = page.locator('#spec-title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Network Path Collision Sentinel');

    // Verify slug auto-generated
    const slugInput = page.locator('#spec-slug');
    await expect(slugInput).toHaveValue(/network-path-collision-sentinel/);

    // 9. Click "Save & Continue" to go to Tab 2
    const saveAndContinueBtn = page.locator('#author-save-continue-btn');
    await expect(saveAndContinueBtn).toBeVisible();
    await saveAndContinueBtn.click({ force: true });

    // 10. Verify now on Tab 2: Function Contract
    await expect(page.locator('text=Function Execution Contract').first()).toBeVisible({ timeout: 3000 });
    const fnNameInput = page.locator('input[placeholder*="networkRoute" i]').first();
    await expect(fnNameInput).toBeVisible();

    // 11. Click "Save & Continue" to go to Tab 3
    await saveAndContinueBtn.click({ force: true });

    // 12. Verify now on Tab 3: Problem Statement
    await expect(page.locator('text=Detailed Problem Statement').first()).toBeVisible({ timeout: 3000 });

    // 13. Click "Save & Continue" to go to Tab 4
    await saveAndContinueBtn.click({ force: true });

    // 14. Verify now on Tab 4: Test Suite & Vault
    await expect(page.locator('text=Testcase Suite').first()).toBeVisible({ timeout: 3000 });

    // 15. Verify on Tab 4 the button becomes "Publish Challenge Direct" (send direct at the end)
    const publishDirectBtn = page.locator('button:has-text("Publish Challenge Direct")').first();
    await expect(publishDirectBtn).toBeVisible();

    // 16. Verify Back button works
    const backBtn = page.locator('button:has-text("Back")').first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page.locator('text=Detailed Problem Statement').first()).toBeVisible();

    // 17. Verify direct tab navigation by clicking Tab 1
    await tab1.click();
    await expect(titleInput).toBeVisible();

    // 18. Verify Cancel button closes modal
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
