import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Task } from '../models/task.model';


@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly STORAGE_KEY = 'premium-tasks';
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

  async getTasks(): Promise<Task[]> {
    await this.ensureStorageReady();
    const tasks = await this.storage.get(this.STORAGE_KEY);
    
    if (!tasks) {
      return [];
    }
    
    // Parse dates back from storage
    return tasks.map((task: any) => ({
      ...task,
      createdAt: new Date(task.createdAt)
    }));
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.set(this.STORAGE_KEY, tasks);
  }

  async addTask(taskData: Omit<Task, 'id'>): Promise<Task> {
    const tasks = await this.getTasks();
    const newTask: Task = {
      ...taskData,
      id: this.generateId(),
    };
    
    tasks.unshift(newTask);
    await this.saveTasks(tasks);
    return newTask;
  }

  async updateTask(updatedTask: Task): Promise<Task> {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(task => task.id === updatedTask.id);
    
    if (index !== -1) {
      tasks[index] = { ...updatedTask };
      await this.saveTasks(tasks);
    }
    
    return updatedTask;
  }

  async deleteTask(taskId: string): Promise<void> {
    const tasks = await this.getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    await this.saveTasks(filteredTasks);
  }

  async deleteAllTasks(): Promise<void> {
    await this.ensureStorageReady();
    await this.storage.remove(this.STORAGE_KEY);
  }

  async deleteCompletedTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const activeTasks = tasks.filter(task => !task.completed);
    await this.saveTasks(activeTasks);
  }

  async getTaskStats(): Promise<{total: number, completed: number, pending: number}> {
    const tasks = await this.getTasks();
    const completed = tasks.filter(task => task.completed).length;
    const total = tasks.length;
    const pending = total - completed;
    
    return { total, completed, pending };
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Utility methods for advanced features
  async exportTasks(): Promise<string> {
    const tasks = await this.getTasks();
    return JSON.stringify(tasks, null, 2);
  }

  async importTasks(tasksJson: string): Promise<void> {
    try {
      const tasks = JSON.parse(tasksJson);
      if (Array.isArray(tasks)) {
        // Validate and convert dates
        const validTasks = tasks.map(task => ({
          ...task,
          createdAt: new Date(task.createdAt),
          id: task.id || this.generateId()
        }));
        await this.saveTasks(validTasks);
      }
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }
}