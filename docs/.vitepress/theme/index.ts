import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import SlideFigure from './components/SlideFigure.vue'
import VersionSwitch from './components/VersionSwitch.vue'
import NotFound from './components/NotFound.vue'
import CourseTable from './components/CourseTable.vue'
import CourseCards from './components/CourseCards.vue'
import 'katex/dist/katex.min.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(VersionSwitch),
      'not-found': () => h(NotFound)
    })
  },
  enhanceApp({ app }) {
    app.component('SlideFigure', SlideFigure)
    app.component('CourseTable', CourseTable)
    app.component('CourseCards', CourseCards)
  }
}
