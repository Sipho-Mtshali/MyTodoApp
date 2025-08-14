export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  isNew?: boolean;
  isDeleting?: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: Date;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
}

export interface TaskFilter {
  showCompleted: boolean;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  sortBy: 'date' | 'priority' | 'alphabetical';
  sortOrder: 'asc' | 'desc';
}