export interface AuthorInfo {
  name: string
  slug: string
  avatar?: string
  verified?: boolean
}

export interface AuthorConfig extends AuthorInfo {
  posts: PostMeta[]
}

export interface PostMeta {
  title: string
  path: string
  date: string
}

export interface ThemeAuthorConfig extends AuthorInfo {
  description?: string
}
