import { Page } from '@playwright/test';

export const STORAGE_KEYS = {
  resumes: 'smart-resume:resumes',
  applications: 'smart-resume:applications',
  activeResumeId: 'smart-resume:activeResumeId',
} as const;

/** 直接读取浏览器真实 localStorage（测试断言用的唯一存储入口） */
export async function readStorage<T = any>(page: Page, key: string): Promise<T> {
  return page.evaluate((k) => {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

export const DEFAULT_RESUME_TITLE = '产品经理求职简历';

interface NewApplication {
  company: string;
  position: string;
  location?: string;
  deadline?: string;
  contact?: string;
  resumeTitle?: string;
}

/** 通过真实 UI 录入一条岗位申请 */
export async function createApplicationViaUi(page: Page, input: NewApplication): Promise<void> {
  await page.goto('/applications');
  await page.getByRole('button', { name: '记录申请' }).click();
  await page.getByLabel(/^公司/).fill(input.company);
  await page.getByLabel(/^岗位/).fill(input.position);
  if (input.location) {
    await page.getByLabel('所在地').fill(input.location);
  }
  if (input.deadline) {
    await page.getByLabel('截止时间').fill(input.deadline);
  }
  if (input.contact) {
    await page.getByLabel('联系人').fill(input.contact);
  }
  if (input.resumeTitle) {
    await page.getByLabel('关联简历').selectOption({ label: input.resumeTitle });
  }
  await page.getByRole('button', { name: '添加申请' }).click();
}
