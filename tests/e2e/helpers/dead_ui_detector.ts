import { Page, Locator } from '@playwright/test';
import * as crypto from 'crypto';

export interface InteractionStateBaseline {
  url: string;
  domSubtreeHash: string;
  localStorageChecksum: string;
  openDialogCount: number;
  ariaExpanded: string | null;
  ariaChecked: string | null;
}

export interface DeadUIEvaluationResult {
  isDead: boolean;
  confidenceScore: number;
  classification: 'EXPECTED_NOOP' | 'POTENTIALLY_BROKEN' | 'DEFINITELY_BROKEN' | 'FUNCTIONAL';
  reason: string;
  diffDetails: {
    urlChanged: boolean;
    domMutated: boolean;
    networkTriggered: boolean;
    storageMutated: boolean;
    dialogToggled: boolean;
    ariaStateToggled: boolean;
  };
}

export class DeadUIDetector {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private async captureBaseline(element: Locator): Promise<InteractionStateBaseline> {
    const url = this.page.url();

    const domSubtree = await element
      .evaluate((el) => {
        const container = el.closest('[data-testid], section, form, main, nav, aside, body') || el.parentElement || el;
        return container.outerHTML;
      })
      .catch(() => '');

    const domSubtreeHash = crypto.createHash('sha256').update(domSubtree).digest('hex');

    const localStorageData = await this.page.evaluate(() => JSON.stringify(window.localStorage)).catch(() => '{}');
    const localStorageChecksum = crypto.createHash('sha256').update(localStorageData).digest('hex');

    const openDialogCount = await this.page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"], [data-radix-portal]')
      .count();

    const ariaExpanded = await element.getAttribute('aria-expanded').catch(() => null);
    const ariaChecked = await element.getAttribute('aria-checked').catch(() => null);

    return {
      url,
      domSubtreeHash,
      localStorageChecksum,
      openDialogCount,
      ariaExpanded,
      ariaChecked,
    };
  }

  public async evaluateElement(element: Locator): Promise<DeadUIEvaluationResult> {
    const isVisible = await element.isVisible().catch(() => false);
    if (!isVisible) {
      return {
        isDead: false,
        confidenceScore: 0.0,
        classification: 'EXPECTED_NOOP',
        reason: 'Element is hidden or not rendered in active viewport',
        diffDetails: {
          urlChanged: false,
          domMutated: false,
          networkTriggered: false,
          storageMutated: false,
          dialogToggled: false,
          ariaStateToggled: false,
        },
      };
    }

    const isDisabled = await element.evaluate((el) => {
      const hasAttr = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      const style = window.getComputedStyle(el);
      const isPointerNone = style.pointerEvents === 'none';
      return hasAttr || isPointerNone;
    }).catch(() => false);

    if (isDisabled) {
      return {
        isDead: false,
        confidenceScore: 0.0,
        classification: 'EXPECTED_NOOP',
        reason: 'Element is intentionally disabled or gated with pointer-events: none',
        diffDetails: {
          urlChanged: false,
          domMutated: false,
          networkTriggered: false,
          storageMutated: false,
          dialogToggled: false,
          ariaStateToggled: false,
        },
      };
    }

    let networkRequestsDispatched = 0;
    const requestListener = () => {
      networkRequestsDispatched++;
    };
    this.page.on('request', requestListener);

    const baseline = await this.captureBaseline(element);

    try {
      await element.click({ timeout: 2500 });
    } catch (err: unknown) {
      this.page.off('request', requestListener);
      return {
        isDead: true,
        confidenceScore: 0.9,
        classification: 'POTENTIALLY_BROKEN',
        reason: `Element click failed actionability check: ${(err as Error).message}`,
        diffDetails: {
          urlChanged: false,
          domMutated: false,
          networkTriggered: false,
          storageMutated: false,
          dialogToggled: false,
          ariaStateToggled: false,
        },
      };
    }

    await this.page.waitForTimeout(350);
    this.page.off('request', requestListener);

    const currentUrl = this.page.url();
    const urlChanged = currentUrl !== baseline.url;

    const currentSubtree = await element
      .evaluate((el) => {
        const container = el.closest('[data-testid], section, form, main, nav, aside, body') || el.parentElement || el;
        return container.outerHTML;
      })
      .catch(() => '');
    const currentSubtreeHash = crypto.createHash('sha256').update(currentSubtree).digest('hex');
    const domMutated = currentSubtreeHash !== baseline.domSubtreeHash;

    const currentStorage = await this.page.evaluate(() => JSON.stringify(window.localStorage)).catch(() => '{}');
    const currentStorageChecksum = crypto.createHash('sha256').update(currentStorage).digest('hex');
    const storageMutated = currentStorageChecksum !== baseline.localStorageChecksum;

    const currentDialogCount = await this.page
      .locator('dialog[open], [role="dialog"], [role="alertdialog"], [data-radix-portal]')
      .count();
    const dialogToggled = currentDialogCount !== baseline.openDialogCount;

    const currentAriaExpanded = await element.getAttribute('aria-expanded').catch(() => null);
    const currentAriaChecked = await element.getAttribute('aria-checked').catch(() => null);
    const ariaStateToggled =
      currentAriaExpanded !== baseline.ariaExpanded || currentAriaChecked !== baseline.ariaChecked;

    const networkTriggered = networkRequestsDispatched > 0;

    const diffDetails = {
      urlChanged,
      domMutated,
      networkTriggered,
      storageMutated,
      dialogToggled,
      ariaStateToggled,
    };

    if (urlChanged || networkTriggered || dialogToggled || ariaStateToggled) {
      return {
        isDead: false,
        confidenceScore: 0.0,
        classification: 'FUNCTIONAL',
        reason: 'Action triggered navigation, modal state change, aria toggle, or remote API mutation',
        diffDetails,
      };
    }

    if (domMutated) {
      return {
        isDead: false,
        confidenceScore: 0.1,
        classification: 'FUNCTIONAL',
        reason: 'Action resulted in local DOM state mutation',
        diffDetails,
      };
    }

    return {
      isDead: true,
      confidenceScore: 0.98,
      classification: 'DEFINITELY_BROKEN',
      reason: 'Element accepted click event but produced zero DOM changes, zero network requests, zero storage mutations, zero aria state changes, and zero navigation.',
      diffDetails,
    };
  }
}
