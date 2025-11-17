<template>
  <div class="flash flash-warn flash-full border-top-0 text-center text-bold py-2">
    <div class="banner-content">
      <svg class="lock-icon" width="1.2rem" height="1.2rem" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4V4zm4-2.5a2.5 2.5 0 0 0-2.5 2.5v2h5V4A2.5 2.5 0 0 0 8 1.5zM3.75 7.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5z"></path>
      </svg>
      <span class="split-w"></span>
      此文章已锁定，只能由所有者与管理员编辑
    </div>
  </div>
</template>

<script>
export default {
  name: 'LockBanner'
}
</script>

<style>
@import "../styles/banner_top.css";
</style>