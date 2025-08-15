import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Task, TaskCategory, TaskStats, TaskReminder } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly TASKS_KEY = 'premium-tasks';
  private readonly CATEGORIES_KEY = 'task-categories';
  private readonly REMINDERS_KEY = 'task-reminders';
  private readonly SETTINGS_KEY = 'app-settings';
  private storageReady = false;

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    await this.storage.create();
    this.storageReady = true;
  }

  private async ensureStorageReady() {
    if (!this.storageReady) {
      await this.init();
    }
  }

  // Task Management
  async getTasks(): Promise<Task[]> {
    await this.ensureStorageReady();
    const tasks = await this.storage.get(this.TASKS_KEY);
    
    if (!tasks) {
      return [];
    }
    
    // Parse dates back from storage
    return tasks.map((task: any) => ({
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
      reminderTime: task.reminderTime ? new Date(task.reminderTime) : undefined
    }));
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.set(this.TASKS_KEY, tasks);
  }

  async addTask(taskData: Omit<Task, 'id'>): Promise<Task> {
    const tasks = await this.getTasks();
    const newTask: Task = {
      ...taskData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    tasks.unshift(newTask);
    await this.saveTasks(tasks);
    return newTask;
  }

  async updateTask(updatedTask: Task): Promise<Task> {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(task => task.id === updatedTask.id);
    
    if (index !== -1) {
      tasks[index] = { 
        ...updatedTask, 
        updatedAt: new Date() 
      };
      await this.saveTasks(tasks);
    }
    
    return updatedTask;
  }

  async deleteTask(taskId: string): Promise<void> {
    const tasks = await this.getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    await this.saveTasks(filteredTasks);
    
    // Also remove any associated reminders
    await this.removeReminder(taskId);
  }

  async deleteAllTasks(): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.remove(this.TASKS_KEY);
    await this.storage.remove(this.REMINDERS_KEY);
  }

  async deleteCompletedTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const activeTasks = tasks.filter(task => !task.completed);
    await this.saveTasks(activeTasks);
  }

  async duplicateTask(taskId: string): Promise<Task> {
    const tasks = await this.getTasks();
    const originalTask = tasks.find(task => task.id === taskId);
    
    if (!originalTask) {
      throw new Error('Task not found');
    }

    const duplicateTaskData: Omit<Task, 'id'> = {
      ...originalTask,
      title: `${originalTask.title} (Copy)`,
      completed: false,
      completedAt: undefined,
      timeSpent: undefined,
      isNew: true
    };

    return this.addTask(duplicateTaskData);
  }

  // Category Management
  async getCategories(): Promise<TaskCategory[]> {
    await this.ensureStorageReady();
    const categories = await this.storage.get(this.CATEGORIES_KEY);
    return categories || [];
  }

  async saveCategories(categories: TaskCategory[]): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.set(this.CATEGORIES_KEY, categories);
  }

  async addCategory(categoryData: Omit<TaskCategory, 'id' | 'taskCount'>): Promise<TaskCategory> {
    const categories = await this.getCategories();
    const newCategory: TaskCategory = {
      ...categoryData,
      id: this.generateId(),
      taskCount: 0
    };
    
    categories.push(newCategory);
    await this.saveCategories(categories);
    return newCategory;
  }

  async updateCategory(updatedCategory: TaskCategory): Promise<TaskCategory> {
    const categories = await this.getCategories();
    const index = categories.findIndex(cat => cat.id === updatedCategory.id);
    
    if (index !== -1) {
      categories[index] = updatedCategory;
      await this.saveCategories(categories);
    }
    
    return updatedCategory;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const categories = await this.getCategories();
    const filteredCategories = categories.filter(cat => cat.id !== categoryId);
    await this.saveCategories(filteredCategories);
    
    // Update tasks with this category to 'personal'
    const tasks = await this.getTasks();
    const updatedTasks = tasks.map(task => 
      task.category === categoryId 
        ? { ...task, category: 'personal', updatedAt: new Date() }
        : task
    );
    await this.saveTasks(updatedTasks);
  }

  // Reminder Management
  async getReminders(): Promise<TaskReminder[]> {
    await this.ensureStorageReady();
    const reminders = await this.storage.get(this.REMINDERS_KEY);
    
    if (!reminders) {
      return [];
    }
    
    return reminders.map((reminder: any) => ({
      ...reminder,
      reminderTime: new Date(reminder.reminderTime)
    }));
  }

  async saveReminders(reminders: TaskReminder[]): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.set(this.REMINDERS_KEY, reminders);
  }

  async setReminder(taskId: string, reminderTime: Date, type: 'due' | 'beforeDue' | 'overdue' = 'due'): Promise<void> {
    const reminders = await this.getReminders();
    const existingIndex = reminders.findIndex(r => r.taskId === taskId && r.type === type);
    
    const reminder: TaskReminder = {
      taskId,
      reminderTime,
      type,
      sent: false
    };

    if (existingIndex !== -1) {
      reminders[existingIndex] = reminder;
    } else {
      reminders.push(reminder);
    }

    await this.saveReminders(reminders);
  }

  async removeReminder(taskId: string): Promise<void> {
    const reminders = await this.getReminders();
    const filteredReminders = reminders.filter(r => r.taskId !== taskId);
    await this.saveReminders(filteredReminders);
  }

  async markReminderAsSent(taskId: string, type: 'due' | 'beforeDue' | 'overdue'): Promise<void> {
    const reminders = await this.getReminders();
    const reminder = reminders.find(r => r.taskId === taskId && r.type === type);
    
    if (reminder) {
      reminder.sent = true;
      await this.saveReminders(reminders);
    }
  }

  // Statistics and Analytics
  async getTaskStats(): Promise<TaskStats> {
    const tasks = await this.getTasks();
    const categories = await this.getCategories();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = tasks.filter(t => t.completed);
    const pending = tasks.filter(t => !t.completed);
    const overdue = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now);

    // Calculate productivity metrics
    const completedToday = completed.filter(t => t.completedAt && t.completedAt >= today);
    const completedThisWeek = completed.filter(t => t.completedAt && t.completedAt >= weekStart);
    const completedThisMonth = completed.filter(t => t.completedAt && t.completedAt >= monthStart);

    // Calculate average completion time
    const tasksWithTime = completed.filter(t => t.timeSpent);
    const avgCompletionTime = tasksWithTime.length > 0 
      ? Math.round(tasksWithTime.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / tasksWithTime.length)
      : 0;

    // Calculate productivity score
    let productivityScore = 0;
    if (tasks.length > 0) {
      const completionRate = (completed.length / tasks.length) * 100;
      const overdueRate = (overdue.length / tasks.length) * 100;
      const onTimeCompletions = completed.filter(t => 
        t.dueDate && t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate)
      ).length;
      const onTimeRate = completed.length > 0 ? (onTimeCompletions / completed.length) * 100 : 0;
      
      productivityScore = Math.max(0, Math.min(100, 
        Math.round(completionRate - (overdueRate * 0.5) + (onTimeRate * 0.2))
      ));
    }

    // Statistics by category
    const byCategory: { [key: string]: number } = {};
    categories.forEach(cat => {
      byCategory[cat.name] = completed.filter(t => t.category === cat.id).length;
    });

    // Statistics by priority
    const byPriority = {
      high: completed.filter(t => t.priority === 'high').length,
      medium: completed.filter(t => t.priority === 'medium').length,
      low: completed.filter(t => t.priority === 'low').length
    };

    return {
      total: tasks.length,
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
      completedToday: completedToday.length,
      completedThisWeek: completedThisWeek.length,
      completedThisMonth: completedThisMonth.length,
      avgCompletionTime,
      productivityScore,
      byCategory,
      byPriority
    };
  }

  // Import/Export functionality
  async exportTasks(): Promise<string> {
    const tasks = await this.getTasks();
    const categories = await this.getCategories();
    const reminders = await this.getReminders();
    
    const exportData = {
      tasks,
      categories,
      reminders,
      exportDate: new Date(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async importTasks(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (importData.tasks && Array.isArray(importData.tasks)) {
        // Validate and convert dates
        const tasks = importData.tasks.map((task: any) => ({
          ...task,
          id: task.id || this.generateId(),
          createdAt: new Date(task.createdAt),
          updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          reminderTime: task.reminderTime ? new Date(task.reminderTime) : undefined
        }));
        
        await this.saveTasks(tasks);
      }

      if (importData.categories && Array.isArray(importData.categories)) {
        const categories = importData.categories.map((cat: any) => ({
          ...cat,
          id: cat.id || this.generateId()
        }));
        
        await this.saveCategories(categories);
      }

      if (importData.reminders && Array.isArray(importData.reminders)) {
        const reminders = importData.reminders.map((reminder: any) => ({
          ...reminder,
          reminderTime: new Date(reminder.reminderTime)
        }));
        
        await this.saveReminders(reminders);
      }
    } catch (error) {
      throw new Error('Invalid import data format');
    }
  }

  // Search functionality
  async searchTasks(query: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    const searchQuery = query.toLowerCase().trim();
    
    if (!searchQuery) return tasks;
    
    return tasks.filter(task => 
      task.title.toLowerCase().includes(searchQuery) ||
      (task.description && task.description.toLowerCase().includes(searchQuery)) ||
      task.category.toLowerCase().includes(searchQuery) ||
      task.priority.toLowerCase().includes(searchQuery)
    );
  }

  // Bulk operations
  async bulkUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<void> {
    const tasks = await this.getTasks();
    
    tasks.forEach(task => {
      if (taskIds.includes(task.id)) {
        Object.assign(task, updates, { updatedAt: new Date() });
      }
    });
    
    await this.saveTasks(tasks);
  }

  async bulkDeleteTasks(taskIds: string[]): Promise<void> {
    const tasks = await this.getTasks();
    const remainingTasks = tasks.filter(task => !taskIds.includes(task.id));
    await this.saveTasks(remainingTasks);
    
    // Remove associated reminders
    for (const taskId of taskIds) {
      await this.removeReminder(taskId);
    }
  }

  // Settings management
  async getSettings(): Promise<any> {
    await this.ensureStorageReady();
    return await this.storage.get(this.SETTINGS_KEY) || {};
  }

  async saveSettings(settings: any): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.set(this.SETTINGS_KEY, settings);
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Task templates
  async getTaskTemplates(): Promise<Partial<Task>[]> {
    return [
      { title: 'Daily standup meeting', category: 'work', priority: 'medium', estimatedTime: 30 },
      { title: 'Review weekly reports', category: 'work', priority: 'high', estimatedTime: 60 },
      { title: 'Grocery shopping', category: 'personal', priority: 'medium', estimatedTime: 45 },
      { title: 'Exercise/workout', category: 'health', priority: 'high', estimatedTime: 60 },
      { title: 'Read for 30 minutes', category: 'learning', priority: 'low', estimatedTime: 30 }
    ];
  }

  async createTaskFromTemplate(template: Partial<Task>): Promise<Task> {
    const taskData: Omit<Task, 'id'> = {
      title: template.title || 'New Task',
      description: template.description || '',
      completed: false,
      createdAt: new Date(),
      priority: template.priority || 'medium',
      category: template.category || 'personal',
      estimatedTime: template.estimatedTime,
      reminderSet: false
    };

    return this.addTask(taskData);
  }
}