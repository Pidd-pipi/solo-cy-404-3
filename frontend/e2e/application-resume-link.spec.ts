import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createApplicationViaUi, DEFAULT_RESUME_TITLE, readStorage, STORAGE_KEYS } from './helpers';

test.describe('求职进展与简历关联（真实持久化）', () => {
  test('首次进入：默认简历立即持久化，刷新后身份不变', async ({ page }) => {
    let firstResumeId = '';
    await test.step('首次进入，默认简历已写入真实存储', async () => {
      await page.goto('/resumes');
      const resumes = await readStorage(page, STORAGE_KEYS.resumes);
      expect(resumes, '首次进入后默认简历应立即持久化').toHaveLength(1);
      expect(resumes[0].title).toBe(DEFAULT_RESUME_TITLE);
      firstResumeId = resumes[0].id;
      expect(await readStorage(page, STORAGE_KEYS.activeResumeId)).toBe(firstResumeId);
    });

    await test.step('刷新后默认简历 id 不变', async () => {
      await page.reload();
      const resumes = await readStorage(page, STORAGE_KEYS.resumes);
      expect(resumes).toHaveLength(1);
      expect(resumes[0].id, '刷新后默认简历 id 必须保持稳定').toBe(firstResumeId);
    });
  });

  test('刷新：申请、阶段、时间线与简历关联保持一致', async ({ page }) => {
    await createApplicationViaUi(page, {
      company: '刷新科技',
      position: '前端工程师',
      resumeTitle: DEFAULT_RESUME_TITLE,
    });
    await page.getByRole('button', { name: '推进到已投递' }).click();
    const appsBefore = await readStorage(page, STORAGE_KEYS.applications);
    expect(appsBefore).toHaveLength(1);
    expect(appsBefore[0].stage).toBe('已投递');
    expect(appsBefore[0].timeline).toHaveLength(2);

    await page.reload();

    const resumes = await readStorage(page, STORAGE_KEYS.resumes);
    const appsAfter = await readStorage(page, STORAGE_KEYS.applications);
    expect(appsAfter, '刷新后申请记录必须完整').toEqual(appsBefore);
    expect(appsAfter[0].resumeId, '刷新后申请仍指向原简历').toBe(resumes[0].id);
    await expect(page.getByText(/已关联简历/)).toBeVisible();
    await expect(page.getByText(/已删除，申请已保留/), '刷新后不得误报失联').toHaveCount(0);
  });

  test('重新打开：关闭并重开浏览器后，申请、阶段、时间线与关联一致', async ({ playwright, baseURL }, testInfo) => {
    // 持久化 profile 目录：localStorage 落盘，关闭浏览器进程后再重开，验证真实持久化
    const userDataDir = testInfo.outputPath('chrome-profile');
    const boot = async () => {
      const context = await playwright.chromium.launchPersistentContext(userDataDir, { baseURL, headless: true });
      const page = context.pages()[0] ?? (await context.newPage());
      return { context, page };
    };

    let expectedApps: unknown;
    let expectedResumes: unknown;
    await test.step('首个会话：创建申请并推进到笔试', async () => {
      const { context, page } = await boot();
      await createApplicationViaUi(page, {
        company: '重开科技',
        position: '后端工程师',
        resumeTitle: DEFAULT_RESUME_TITLE,
      });
      await page.getByRole('button', { name: '推进到已投递' }).click();
      await page.getByRole('button', { name: '推进到笔试' }).click();
      expectedApps = await readStorage(page, STORAGE_KEYS.applications);
      expectedResumes = await readStorage(page, STORAGE_KEYS.resumes);
      await context.close();
    });

    await test.step('重新打开：数据从磁盘恢复且一致', async () => {
      const { context, page } = await boot();
      await page.goto('/applications');
      expect(await readStorage(page, STORAGE_KEYS.applications), '重开后申请必须完整').toEqual(expectedApps);
      expect(await readStorage(page, STORAGE_KEYS.resumes), '重开后简历必须完整').toEqual(expectedResumes);
      await expect(page.locator('article').getByText('笔试', { exact: true })).toBeVisible();
      await expect(page.getByText(/已关联简历/)).toBeVisible();
      await expect(page.getByText(/已删除，申请已保留/), '重开后不得误报失联').toHaveCount(0);
      await page.getByRole('button', { name: '时间线 · 3' }).click();
      await expect(page.getByText('待投递 → 已投递', { exact: true })).toBeVisible();
      await expect(page.getByText('已投递 → 笔试', { exact: true })).toBeVisible();
      await context.close();
    });
  });

  test('完整备份往返：导出→清空→恢复后申请、阶段、时间线、关联一致', async ({ page }, testInfo) => {
    await createApplicationViaUi(page, {
      company: '备份科技',
      position: '产品经理',
      resumeTitle: DEFAULT_RESUME_TITLE,
    });
    await page.getByRole('button', { name: '推进到已投递' }).click();
    const resumesBefore = await readStorage(page, STORAGE_KEYS.resumes);
    const appsBefore = await readStorage(page, STORAGE_KEYS.applications);

    const backupPath = testInfo.outputPath('workspace-backup.json');
    await test.step('导出备份文件', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: '导出备份' }).click(),
      ]);
      await download.saveAs(backupPath);
      const backup = JSON.parse(await readFile(backupPath, 'utf-8'));
      expect(backup.resumes).toEqual(resumesBefore);
      expect(backup.applications).toEqual(appsBefore);
      expect(backup.applications[0].resumeId).toBe(backup.resumes[0].id);
      expect(backup.applications[0].timeline).toHaveLength(2);
    });

    await test.step('清空本地数据', async () => {
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      expect(await readStorage(page, STORAGE_KEYS.applications)).toBeNull();
    });

    await test.step('恢复备份：数据完整回来', async () => {
      const navigated = page.waitForEvent('framenavigated');
      await page.locator('input[type=file]').setInputFiles(backupPath);
      await navigated;
      expect(await readStorage(page, STORAGE_KEYS.applications), '恢复后申请必须完整').toEqual(appsBefore);
      expect(await readStorage(page, STORAGE_KEYS.resumes), '恢复后简历必须完整').toEqual(resumesBefore);
      await expect(page.locator('article').getByText('已投递', { exact: true })).toBeVisible();
      await expect(page.getByText(/已关联简历/)).toBeVisible();
      await expect(page.getByText(/已删除，申请已保留/), '备份恢复后不得误报失联').toHaveCount(0);
    });
  });

  test('旧备份缺少 applications 字段：恢复后申请与关联原样保留', async ({ page }, testInfo) => {
    await createApplicationViaUi(page, {
      company: '旧备份科技',
      position: '测试工程师',
      resumeTitle: DEFAULT_RESUME_TITLE,
    });
    await page.getByRole('button', { name: '推进到已投递' }).click();
    const appsBefore = await readStorage(page, STORAGE_KEYS.applications);

    await test.step('恢复不含 applications 字段的旧备份', async () => {
      const resumes = await readStorage(page, STORAGE_KEYS.resumes);
      const oldBackup = {
        exportedAt: '2025-01-01T00:00:00.000Z',
        resumes,
        activeResumeId: resumes[0].id,
        profile: {
          fullName: '旧备份用户', headline: '', phone: '', email: '',
          location: '', website: '', avatarUrl: '', targetRole: '', summary: '',
        },
        selectedTemplateId: 'atelier',
        theme: 'light',
      };
      const backupPath = testInfo.outputPath('old-backup.json');
      await writeFile(backupPath, JSON.stringify(oldBackup, null, 2));
      const navigated = page.waitForEvent('framenavigated');
      await page.locator('input[type=file]').setInputFiles(backupPath);
      await navigated;
    });

    const appsAfter = await readStorage(page, STORAGE_KEYS.applications);
    expect(appsAfter, '旧备份缺少新字段时，现有申请必须原样保留').toEqual(appsBefore);
    const resumesAfter = await readStorage(page, STORAGE_KEYS.resumes);
    expect(appsAfter[0].resumeId, '恢复后申请仍指向原简历').toBe(resumesAfter[0].id);
    await expect(page.getByRole('heading', { name: '求职进展工作台' }), '旧备份恢复后应用正常打开').toBeVisible();
    await expect(page.getByText(/已关联简历/)).toBeVisible();
    await expect(page.getByText(/已删除，申请已保留/), '旧备份恢复后不得误报失联').toHaveCount(0);
  });

  test('旧备份中的申请缺少时间线等新字段：恢复时规范化且阶段保留', async ({ page }, testInfo) => {
    await page.goto('/applications');
    const resumes = await readStorage(page, STORAGE_KEYS.resumes);
    const legacyApp = {
      id: 'legacy_app_1',
      company: '旧数据公司',
      position: '旧版岗位',
      stage: '面试',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const backup = {
      exportedAt: '2025-01-01T00:00:00.000Z',
      resumes,
      activeResumeId: resumes[0].id,
      profile: {
        fullName: '旧备份用户', headline: '', phone: '', email: '',
        location: '', website: '', avatarUrl: '', targetRole: '', summary: '',
      },
      selectedTemplateId: 'atelier',
      theme: 'light',
      applications: [legacyApp],
    };
    const backupPath = testInfo.outputPath('legacy-app-backup.json');
    await writeFile(backupPath, JSON.stringify(backup, null, 2));

    const navigated = page.waitForEvent('framenavigated');
    await page.locator('input[type=file]').setInputFiles(backupPath);
    await navigated;

    const apps = await readStorage(page, STORAGE_KEYS.applications);
    expect(apps).toHaveLength(1);
    expect(apps[0].stage, '旧数据阶段必须保留').toBe('面试');
    expect(apps[0].timeline, '缺失的时间线应按当前阶段补一条').toHaveLength(1);
    expect(apps[0].timeline[0].to).toBe('面试');
    expect(apps[0].contact).toBe('');
    expect(apps[0].resumeId).toBeNull();
    await expect(page.getByRole('heading', { name: '求职进展工作台' }), '旧数据恢复后应用正常打开').toBeVisible();
    await expect(page.locator('article').getByText('面试', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '时间线 · 1' })).toBeVisible();
  });

  test('移除简历：申请保留并报失联，重新关联后阶段时间线不变', async ({ page }) => {
    await createApplicationViaUi(page, {
      company: '失联科技',
      position: '算法工程师',
      resumeTitle: DEFAULT_RESUME_TITLE,
    });
    await page.getByRole('button', { name: '推进到已投递' }).click();

    await test.step('删除关联的简历', async () => {
      page.on('dialog', (dialog) => dialog.accept());
      await page.goto('/resumes');
      await page.getByRole('button', { name: '简历操作' }).click();
      await page.getByRole('menuitem', { name: '删除' }).click();
      expect(await readStorage(page, STORAGE_KEYS.resumes)).toHaveLength(0);
    });

    await test.step('申请保留并提示关联丢失', async () => {
      await page.goto('/applications');
      await expect(page.getByText(/已删除，申请已保留/)).toBeVisible();
      const apps = await readStorage(page, STORAGE_KEYS.applications);
      expect(apps, '简历被移除后申请必须保留').toHaveLength(1);
      expect(apps[0].stage).toBe('已投递');
      expect(apps[0].timeline).toHaveLength(2);
    });

    await test.step('重新关联到新简历', async () => {
      await page.goto('/resumes');
      await page.getByRole('button', { name: '新建简历' }).click();
      await page.waitForURL(/\/resumes\/.+\/edit/);
      const newResume = (await readStorage(page, STORAGE_KEYS.resumes))[0];
      await page.goto('/applications');
      await page.locator('article').getByRole('combobox').selectOption({ label: newResume.title });
      await expect(page.getByText(new RegExp(`已关联简历：${newResume.title}`))).toBeVisible();
      await expect(page.getByText(/已删除，申请已保留/)).toHaveCount(0);
      const apps = await readStorage(page, STORAGE_KEYS.applications);
      expect(apps[0].resumeId).toBe(newResume.id);
      expect(apps[0].stage, '重新关联不改变阶段').toBe('已投递');
      expect(apps[0].timeline, '重新关联不改写时间线').toHaveLength(2);
    });
  });

  test('复制简历：申请不重复，仍关联原简历', async ({ page }) => {
    await createApplicationViaUi(page, {
      company: '复制科技',
      position: '运营专员',
      resumeTitle: DEFAULT_RESUME_TITLE,
    });

    await test.step('复制简历', async () => {
      await page.goto('/resumes');
      await page.getByRole('button', { name: '简历操作' }).click();
      await page.getByRole('menuitem', { name: '复制' }).click();
      expect(await readStorage(page, STORAGE_KEYS.resumes)).toHaveLength(2);
    });

    const resumes = await readStorage(page, STORAGE_KEYS.resumes);
    const original = resumes.find((r: { title: string }) => !r.title.includes('副本'));
    const apps = await readStorage(page, STORAGE_KEYS.applications);
    expect(apps, '复制简历不得复制申请').toHaveLength(1);
    expect(apps[0].resumeId, '申请仍关联原简历').toBe(original.id);

    await page.goto('/applications');
    await expect(page.locator('article'), '工作台只展示一条申请').toHaveCount(1);
    await expect(page.getByText(new RegExp(`已关联简历：${original.title}`))).toBeVisible();
  });
});
