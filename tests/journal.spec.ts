import { expect, test } from '@playwright/test'

const adminPassword = 'playwright-admin-password-123456'

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(adminPassword)
  await page.getByRole('button', { name: '登录编辑台' }).click()
  await expect(page.getByRole('heading', { name: '编辑台' })).toBeVisible()
}

test('search, type filters, pagination and unpublished routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '观看之后，继续思考。' })).toBeVisible()
  await page.getByRole('searchbox', { name: '检索作品' }).count().then(async count => {
    if (count) await page.getByRole('searchbox', { name: '检索作品' }).fill('无从得知')
    else await page.getByRole('textbox', { name: '检索作品' }).fill('无从得知')
  })
  await page.getByRole('button', { name: '检索', exact: true }).click()
  await expect(page.getByRole('heading', { name: '观看，也是一种重新学习倾听' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '关系中的沉默：从可观察的表达开始' })).toHaveCount(0)
  await page.goto('/works')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.getByRole('button', { name: '上一页' }).click()
  await expect(page).toHaveURL(/page=1/)
  await page.getByRole('button', { name: '诗歌', exact: true }).click()
  await expect(page.locator('.work-row')).toHaveCount(2)
  await page.goto('/works/review-sample')
  await expect(page.getByRole('heading', { name: '这一页暂未收录。' })).toBeVisible()
})

test('AI poem submission, manual work and comment review, privacy and withdrawal', async ({ page }) => {
  await page.goto('/submit')
  await page.getByRole('radio', { name: '诗歌', exact: true }).check()
  await page.getByLabel('作品标题').fill('自动化测试诗作')
  await page.getByLabel('作者笔名').fill('测试笔名')
  await page.getByLabel('私密联系邮箱').fill('private-writer@example.com')
  await page.getByLabel('真实写作依据').fill('这是演示测试，不描述实际节目情节。')
  await page.getByLabel('正文', { exact: true }).fill('第一行\n第二行\n\n第三行')
  await page.getByLabel('AI 使用情况').selectOption('generated')
  await page.getByLabel('AI 工具与使用环节').fill('测试工具生成主体，由作者核实。')
  await page.getByRole('checkbox', { name: /我确认作品基于事实/ }).check()
  await page.getByRole('checkbox', { name: /我已阅读/ }).check()
  await page.getByRole('button', { name: '阅读预览' }).click()
  await expect(page.getByRole('dialog').locator('.poetry-body')).toHaveText('第一行\n第二行\n\n第三行')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '提交演示稿' }).click()
  await expect(page.getByRole('heading', { name: '演示稿已进入待审列表' })).toBeVisible()
  await page.getByRole('link', { name: '回到作品库' }).click()
  await expect(page.getByRole('heading', { name: '自动化测试诗作', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: '审核演示', exact: true }).first().click()
  await page.getByLabel('管理员密码').fill(adminPassword)
  await page.getByRole('button', { name: '登录编辑台' }).click()
  const row = page.locator('.admin-row').filter({ hasText: '自动化测试诗作' })
  await row.getByRole('button', { name: '审阅' }).click()
  await expect(page.getByRole('dialog')).toContainText('private-writer@example.com')
  await expect(page.getByRole('button', { name: '审核通过并公开' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /已核对内容边界/ }).check()
  await page.getByRole('button', { name: '审核通过并公开' }).click()
  await page.getByRole('button', { name: '已公开', exact: true }).click()
  await page.getByRole('link', { name: '自动化测试诗作', exact: true }).click()
  const articlePath = new URL(page.url()).pathname
  await expect(page.locator('.poetry-body')).toHaveText('第一行\n第二行\n\n第三行')
  await expect(page.locator('body')).not.toContainText('private-writer@example.com')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  await page.getByLabel('笔名', { exact: true }).fill('评论读者')
  await page.getByLabel('评论', { exact: true }).fill('一条待审的评论。')
  await page.getByRole('button', { name: '提交评论' }).click()
  await expect(page.locator('.comments-list')).toHaveCount(0)
  await page.getByRole('link', { name: '审核演示', exact: true }).first().click()
  await page.getByRole('button', { name: /^评论/ }).click()
  await page.getByRole('button', { name: '通过并公开' }).click()
  await page.locator('.masthead nav').getByRole('link', { name: '作品库', exact: true }).click()
  await page.getByRole('link', { name: '自动化测试诗作', exact: true }).click()
  await expect(page.locator('.comments-list')).toContainText('一条待审的评论。')
  await page.getByRole('link', { name: '审核演示', exact: true }).first().click()
  await page.getByRole('button', { name: '稿件', exact: false }).click()
  await page.getByRole('button', { name: '已公开', exact: true }).click()
  await page.locator('.admin-row').filter({ hasText: '自动化测试诗作' }).getByRole('button', { name: '撤下' }).click()
  await page.getByRole('button', { name: '确认撤下' }).click()
  await page.locator('.masthead nav').getByRole('link', { name: '作品库', exact: true }).click()
  await expect(page.getByRole('heading', { name: '自动化测试诗作' })).toHaveCount(0)
  await page.goto(articlePath)
  // A full reload resets the local prototype. The generated ID is still not a public route.
  await expect(page.getByRole('heading', { name: '这一页暂未收录。' })).toBeVisible()
})

test('issue drafts are not public, publishing creates a readable issue', async ({ page }) => {
  await loginAdmin(page)
  await page.getByRole('button', { name: /^期刊/ }).click()
  await page.getByRole('button', { name: '新建一期' }).click()
  await page.getByLabel('期号', { exact: true }).fill('002')
  await page.getByLabel('标题', { exact: true }).fill('新的观察样刊')
  await page.getByLabel('本期导语').fill('测试导语')
  await page.getByLabel('卷首语').fill('测试卷首语')
  await page.getByLabel('关系中的沉默：从可观察的表达开始').check()
  await page.getByRole('button', { name: '保存为草稿' }).click()
  await page.locator('.masthead nav').getByRole('link', { name: '期刊', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新的观察样刊' })).toHaveCount(0)
  await page.getByRole('link', { name: '审核演示', exact: true }).first().click()
  await page.getByRole('button', { name: /^期刊/ }).click()
  await page.locator('.admin-issues article').filter({ hasText: '新的观察样刊' }).getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByRole('button', { name: '发布演示期刊' }).click()
  await page.getByRole('link', { name: '查看新的观察样刊' }).click()
  await expect(page.getByRole('heading', { name: '新的观察样刊', exact: true })).toBeVisible()
  await expect(page.locator('#issue-contents .work-row')).toHaveCount(1)
})

test('submission validation keeps text and enforces permissions', async ({ page }) => {
  await page.goto('/submit')
  await page.getByLabel('作品标题').fill('保留输入的标题')
  await page.getByRole('radio', { name: '授权转载' }).check()
  await page.getByRole('button', { name: '提交演示稿' }).click()
  await expect(page.getByLabel('作品标题')).toHaveValue('保留输入的标题')
  await expect(page.getByText('请填写原作者署名', { exact: true })).toBeVisible()
  await expect(page.getByText('请说明已获得的转载与收录授权', { exact: true })).toBeVisible()
})

test('desktop and mobile layout, images, keyboard and runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 960 })
    for (const route of ['/', '/works', '/works/sample-03', '/issues/first-issue', '/submit', '/admin']) {
      await page.goto(route)
      await page.locator('.masthead').waitFor()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      for (const image of await page.locator('img:visible').all()) {
        expect(await image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
      }
      if ((width === 1440 || width === 390) && (route === '/' || route === '/issues/first-issue')) {
        await page.screenshot({ path: `test-results/${width}-${route === '/' ? 'home' : 'issue'}.png`, fullPage: true })
      }
    }
  }
  await page.goto('/submit')
  await page.getByRole('button', { name: '阅读预览' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})
