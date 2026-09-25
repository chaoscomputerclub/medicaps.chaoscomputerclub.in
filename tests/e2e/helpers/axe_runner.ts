import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface AccessibilityAuditResult {
  pageUrl: string;
  violationsCount: number;
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string;
      failureSummary: string;
    }>;
  }>;
}

export class AccessibilityRunner {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public async audit(options?: { excludeSelectors?: string[] }): Promise<AccessibilityAuditResult> {
    const builder = new AxeBuilder({ page: this.page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('.monaco-editor')
      .exclude('[data-monaco-editor]');

    if (options?.excludeSelectors) {
      for (const sel of options.excludeSelectors) {
        builder.exclude(sel);
      }
    }

    const results = await builder.analyze();

    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact || 'minor',
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((node) => ({
        html: node.html,
        target: node.target.join(' > '),
        failureSummary: node.failureSummary || 'No summary available',
      })),
    }));

    return {
      pageUrl: this.page.url(),
      violationsCount: violations.length,
      violations,
    };
  }
}
