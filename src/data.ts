import type { Issue, Submission, Work, WorkType } from './domain'

const sampleBasis = '本条为界面排版示例，不对应真实节目片段、作者投稿或个人经历。正式收稿需由作者提供真实依据。'
const generalBody = `## 从观察开始

讨论一段关系之前，可以先区分三个层次：被呈现的言语与行动、观看者的解释，以及仍然未知的部分。

同一个停顿可能被读成犹豫，也可能只是剪辑留下的间隙。分析的起点不是替人物确认答案，而是说明自己的材料、视角和推理过程。

## 一种分析路径

首先记录可以观察的内容，再提出可能的解释。不同学科可以对同一份材料提出不同的问题，但概念本身并不能代替证据。

> 对材料保持耐心，也为另一种解释留下空间。

如果把这个过程放回日常关系，重要的也许不是尽快给一个人分类，而是理解双方在怎样的条件下表达、倾听和回应。

## 材料的边界

这是一篇用于阅读界面测试的示例文字，没有援引节目中的具体事件，也不对任何真实人物作判断。正式文章应列出实际使用的节目期数、文本或参考资料。`

function makeWork(
  id: string, title: string, type: WorkType, subject: string[], tags: string[], summary: string, body = generalBody,
): Work {
  return {
    id, title, type, author: '编辑部排版示例', summary, body, disciplines: subject, tags,
    basis: type === 'analysis' ? '' : sampleBasis,
    note: '本地原型中的示例作品，不是真实投稿。', references: '', episode: '',
    spoiler: false, aiUsage: 'generated', rights: 'original', sourceAuthor: '', sourceUrl: '',
    status: 'published', publishedAt: `2026-11-09T${String(20 - Number(id.match(/\d+$/)?.[0] || '1')).padStart(2, '0')}:00:00+08:00`,
    sample: true,
  }
}

export const initialWorks: Work[] = [
  makeWork('sample-01', '关系中的沉默：从可观察的表达开始', 'analysis', ['心理学', '社会学'],
    ['关系', '表达', '倾听'], '区分被呈现的言语、观看者的解释与未知的部分，尝试为关系分析建立一条更清晰的观察路径。'),
  makeWork('sample-02', '理解他人之前，我们如何理解自己的位置', 'analysis', ['社会学'],
    ['角色', '边界'], '从角色与情境出发，讨论观察者的位置如何影响判断。不急于归因，也不把一种视角当作唯一解释。'),
  makeWork('sample-03', '那些没有被一句话说完的', 'poetry', [], ['倾听', '语言'], '',
    '一句话落下\n仍有未被听见的部分\n\n停顿不是答案\n也不必急着填满\n\n让表达留在纸上\n让理解再走一段'),
  makeWork('sample-04', '当“为你好”成为一种沟通方式', 'analysis', ['教育学', '心理学'],
    ['关心', '自主性'], '以教育与沟通的视角讨论关心、期待和自主性之间的张力，重视表达意图与接受感受的区别。'),
  makeWork('sample-05', '观看，也是一种重新学习倾听', 'prose', [], ['观看', '日常'], '',
    '观看一段公开的谈话时，我们常常比说话的人更早得出结论。一个词、一处停顿，似乎就足够组成一段解释。\n\n但“看见”与“理解”之间，还有一段需要慢慢走完的距离。把感受写下来，可以让这一段距离变得具体：哪些来自画面，哪些来自自己的经验，哪些仍然无从得知。\n\n这段文字是阅读排版示例。它不代替真实的个人叙述，也没有描述节目中未被核实的事件。'),
  makeWork('sample-06', '关系能否被建模：变量之外的日常', 'analysis', ['数学与计算', '社会学'],
    ['模型', '反馈'], '模型可以帮助整理互动中的变量与反馈，却不能抹平人与具体情境。分析也需要说明不能解释的部分。'),
  makeWork('sample-07', '把一句话还给它的上下文', 'prose', [], ['文本', '观察'], '',
    '一句话被截取出来以后，会变得格外确定。它可以被重复，也可以被迅速放进我们熟悉的故事里。\n\n而上下文往往没有那么整齐。表达有顺序，回应有对象，观察也有边界。重新把它们放在一起，并不是为了替任何人辩护，而是为了不让自己的理解停在最方便的地方。\n\n以上为非真实投稿的编辑排版文字，不援引任何具体节目对话。'),
  makeWork('sample-08', '在词语之间', 'poetry', [], ['语言', '距离'], '',
    '字与字之间\n留出一个空格\n\n不是要把距离填满\n只是让另一种声音\n也有地方停留'),
]

export const initialSubmissions: Submission[] = [{
  ...makeWork('review-sample', '关于“理解”的一份观察笔记', 'analysis', ['心理学'], ['理解'],
    '待审流程示例：尝试区分解释他人与倾听他人之间的差异。'),
  status: 'pending', publishedAt: '', email: 'sample@example.invalid', authorization: '', aiDetail: '界面排版示例，主体由 AI 生成。',
}]

export const initialIssues: Issue[] = [{
  id: 'issue-001', slug: 'first-issue', number: '001', title: '在关系之中',
  description: '从观看出发，回到理解、表达与人与人之间。',
  editorial: '我们尝试把观看之后留下的思考，整理成可以慢慢阅读的文字。让分析有材料，让表达有来处，也让不同学科、不同体裁在同一本刊物里相遇。\n\n这是《后会有期刊》的创刊排版样刊。所收文字均为界面示例，不代表真实投稿或对节目事实的分析。',
  cover: '/assets/issue-001.png', workIds: ['sample-01', 'sample-04', 'sample-03', 'sample-05'],
  status: 'published', publishedAt: '2026-11-09', sample: true,
}]
