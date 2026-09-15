import { expect, Page } from '@playwright/test';
import { APPLICATION_STAGES } from '../src/types/application';

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

/**
 * 断言存储中所有申请满足核心不变量：
 * stage 与时间线最后一步一致；时间线从创建记录开始，每一步只能相邻推进或回退。
 */
export async function expectLegalApplications(page: Page): Promise<void> {
  const apps = (await readStorage<any[]>(page, STORAGE_KEYS.applications)) ?? [];
  for (const app of apps) {
    const timeline = app.timeline as { from: string | null; to: string }[];
    expect(timeline.length, `申请「${app.company}」的时间线不能为空`).toBeGreaterThan(0);
    expect(app.stage, `申请「${app.company}」的阶段必须与时间线末步一致`).toBe(timeline[timeline.length - 1].to);
    expect(timeline[0].from, `申请「${app.company}」的时间线必须从创建记录开始`).toBeNull();
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i].from, `申请「${app.company}」第 ${i + 1} 步必须衔接上一步`).toBe(timeline[i - 1].to);
      const distance = Math.abs(
        APPLICATION_STAGES.indexOf(timeline[i].from as (typeof APPLICATION_STAGES)[number]) -
          APPLICATION_STAGES.indexOf(timeline[i].to as (typeof APPLICATION_STAGES)[number]),
      );
      expect(distance, `申请「${app.company}」第 ${i + 1} 步只能相邻推进或回退`).toBe(1);
    }
  }
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
