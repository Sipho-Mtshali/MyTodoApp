export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt?: Date;
  dueDate?: Date;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  isNew?: boolean;
  isDeleting?: boolean;
  reminderSet?: boolean;
  reminderTime?: Date;
  sharedWith?: string[];
  completedAt?: Date;
  timeSpent?: number; // in minutes
  estimatedTime?: number; // in minutes
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  taskCount: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  avgCompletionTime: number;
  productivityScore: number;
  byCategory: { [key: string]: number };
  byPriority: { high: number; medium: number; low: number };
}

export interface TaskFilter {
  showCompleted: boolean;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  sortBy: 'date' | 'priority' | 'alphabetical' | 'dueDate' | 'category';
  sortOrder: 'asc' | 'desc';
  dateRange?: 'today' | 'week' | 'month' | 'all';
  searchQuery?: string;
}

export interface TaskReminder {
  taskId: string;
  reminderTime: Date;
  type: 'due' | 'beforeDue' | 'overdue';
  sent: boolean;
}

export interface SharedTask {
  taskId: string;
  sharedBy: string;
  sharedWith: string;
  permissions: 'view' | 'edit' | 'complete';
  sharedAt: Date;
}