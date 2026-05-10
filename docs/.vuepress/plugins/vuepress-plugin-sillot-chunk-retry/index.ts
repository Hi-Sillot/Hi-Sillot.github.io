import type { Plugin } from '@vuepress/core'
import { path } from '@vuepress/utils'
import type { Plugin as VitePlugin } from 'vite'

const TAG = 'vuepress-plugin-sillot-chunk-retry'

const STATUS_INDICATOR_CSS = `#chunk-retry-status{position:fixed;top:var(--vp-nav-height,64px);left:0;width:100%;height:3px;z-index:9999999;pointer-events:none;opacity:0;transition:opacity .4s ease,background .4s ease}#chunk-retry-status.recovering{opacity:1;background:#58a6ff;box-shadow:0 0 8px rgba(88,166,255,.6);animation:chunk-retry-pulse 1.5s ease-in-out infinite}#chunk-retry-status.success{opacity:1;background:#3fb950;box-shadow:0 0 8px rgba(63,185,80,.5);animation:none}#chunk-retry-status.fail{opacity:1;background:#f85149;box-shadow:0 0 8px rgba(248,81,73,.5);animation:none}@keyframes chunk-retry-pulse{0%,100%{opacity:1}50%{opacity:.5}}`

const STATUS_INDICATOR_SCRIPT = `!function(){var s=document.createElement('style');s.id='chunk-retry-status-styles';s.textContent="${STATUS_INDICATOR_CSS.replace(/"/g, '\\"')}";document.head.appendChild(s);var b=document.createElement('div');b.id='chunk-retry-status';document.body?document.body.appendChild(b):document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(b)});var _t=null,_rt=null,_rc=0,_MAX_R=3;function _show(cls){if(_t)clearTimeout(_t);b.className=cls;if(cls==='success')_t=setTimeout(function(){b.className=''},3000);if(cls==='fail')_t=setTimeout(function(){b.className=''},8000)}function _isChunk(u){if(!u)return false;return/\\.(js|mjs)(\\?|$)/i.test(u)}function _reload(){if(window.__chunkRetryReady)return;_rc++;if(_rc>_MAX_R){_show('fail');return}_show('recovering');if(_rt)clearTimeout(_rt);_rt=setTimeout(function(){if(window.__chunkRetryReady)return;var u=location.href;var sep=u.indexOf('?')===-1?'?':'&';location.replace(u.split(sep)[0]+sep+'_retry='+_rc+'_'+Date.now())},1500)}function _onErr(){if(window.__chunkRetryReady)return;if(!b.className)_show('recovering');if(_rt)clearTimeout(_rt);_rt=setTimeout(function(){if(!window.__chunkRetryReady)_reload()},3000)}window.addEventListener('vite:preloadError',function(e){if(window.__chunkRetryReady)return;_onErr();if(e.promise)e.promise.catch(function(){if(!window.__chunkRetryReady)_onErr()})});window.addEventListener('unhandledrejection',function(e){if(window.__chunkRetryReady)return;var m=e.reason&&e.reason.message;if(m&&(/Failed.to.fetch.dynamically.imported.module/.test(m)||/Importing.a.module.script.failed/.test(m)||/error.dynamically.importing.module/.test(m))){_onErr()}});window.addEventListener('error',function(e){if(window.__chunkRetryReady)return;var t=e.target;if(t&&t.tagName==='SCRIPT'&&_isChunk(t.src)){_onErr()}},true)}();`

const statusIndicatorVitePlugin = (): VitePlugin => ({
  name: `${TAG}:inject-status-indicator`,
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replace(
        '</head>',
        `<script>${STATUS_INDICATOR_SCRIPT}</script></head>`,
      )
    },
  },
})

export default (): Plugin => ({
  name: TAG,
  clientConfigFile: path.resolve(__dirname, './client.ts'),

  extendsBundlerOptions(bundlerOptions: any) {
    bundlerOptions.viteOptions ??= {}
    bundlerOptions.viteOptions.plugins ??= []
    bundlerOptions.viteOptions.plugins.push(statusIndicatorVitePlugin())
  },
})
