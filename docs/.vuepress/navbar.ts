/**
 * @see https://theme-plume.vuejs.press/config/navigation/ 查看文档了解配置详情
 *
 * Navbar 配置文件，它在 `.vuepress/plume.config.ts` 中被导入。
 */

import { defineNavbarConfig } from 'vuepress-theme-plume'

export default defineNavbarConfig([
  // { text: '首页', link: '/' },
  
      { text: '开发者文档', link: '/col_doc/1_developNotes/README.md' },
      { text: '发行文档', link: '/col_doc/2_releaseNotes/README.md' },
      { text: '汐洛指南', link: '/col_doc/3_sillotGuides/README.md' },
  {
    text: '博客',
    items: [
      { text: '所有博客', link: '/blog/' },
      { text: '标签', link: '/blog/tags/' },
      { text: '归档', link: '/blog/archives/' },
    ]
  },
  {
    text: '更多',
    items: [
      { text: '测试用例', link: '/demo/README.md' },
      { text: '发布', link: '/publish/README.md' },
      { text: '数据统计', link: '/col_doc/4_stats/README.md' },
      { text: '友链', link: '/friends/' },
      { text: '署名编辑', link: '/authors/' },
    ]
  },
])
