// plugins/vuepress-plugin-sillot-author/stores/author.ts

import { defineStore } from 'pinia';
import type { AuthorConfig } from '../types';

export const useAuthorStore = defineStore('author', {
   persist: true, // 启用持久化存储
  state: () => ({
    authors: {} as Record<string, AuthorConfig>,
  }),
  
  actions: {
    setAuthors(authors: Record<string, AuthorConfig>) {
      this.authors = authors;
    },
    
    getAuthorBySlug(slug: string): AuthorConfig | undefined {
      return this.authors[slug];
    }
  },
  
  getters: {
    allAuthors: (state) => Object.values(state.authors),
  }
});