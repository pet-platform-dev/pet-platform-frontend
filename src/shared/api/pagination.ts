export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};
