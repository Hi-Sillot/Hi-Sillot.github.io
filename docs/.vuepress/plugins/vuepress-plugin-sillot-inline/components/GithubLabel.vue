<template>
  <span 
    :id="`label-${labelId}`"
    class="IssueLabel hx_IssueLabel IssueLabel--big lh-condensed js-label-link d-inline-block v-align-middle"
    :data-name="fullName"
    :style="labelStyle"
  >
    {{ fullName }}
  </span>
</template>

<script>
import { LABEL_MAP } from '../shared/component-data'

function generateLabelId() {
  return Math.random().toString(16).slice(2, 8)
}

export default {
  name: 'GithubLabel',
  props: {
    name: {
      type: String,
      required: true,
      validator: (value) => Object.keys(LABEL_MAP).includes(value)
    }
  },
  data() {
    return {
      labelId: generateLabelId()
    }
  },
  computed: {
    fullName() {
      return LABEL_MAP[this.name]?.fullName || this.name
    },
    labelStyle() {
      const color = LABEL_MAP[this.name]?.color
      if (!color) return {}

      return {
        '--label-r': color.r,
        '--label-g': color.g,
        '--label-b': color.b,
        '--label-h': color.h,
        '--label-s': color.s,
        '--label-l': color.l
      }
    }
  }
}
</script>

<style scoped>
@import "../styles/github_labels.css";

.IssueLabel {
  margin: 0px 3px 0px 3px;
}
</style>