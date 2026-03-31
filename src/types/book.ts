export interface Book {
  id: number;
  title: string;
  author: string;
  file_path: string;
  is_copied: boolean;
  cover_thumb_path: string | null;
  tags: string[];
  category: string;
  last_page: number;
  total_pages: number;
  added_at: string;
  last_opened_at: string;
}
