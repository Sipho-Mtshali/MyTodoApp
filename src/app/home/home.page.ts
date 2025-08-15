import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ModalController, AlertController, ToastController, ActionSheetController } from '@ionic/angular';
import { TaskService } from '../services/task.service';
import { Task, TaskCategory, TaskStats, TaskFilter } from '../models/task.model';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit {
  @ViewChild('particles', { static: false }) particlesRef!: ElementRef;

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  categories: TaskCategory[] = [];
  taskStats: TaskStats = {
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
    avgCompletionTime: 0,
    productivityScore: 0,
    byCategory: {},
    byPriority: { high: 0, medium: 0, low: 0 }
  };

  // Form state
  showAddTaskForm: boolean = false;
  newTask: Partial<Task> = this.getEmptyTask();
  today: string = new Date().toISOString();
  statsAnimating: boolean = false;
  
  // Filter state
  selectedCategory: string | null = null;
  searchQuery: string = '';
  currentFilter: TaskFilter = {
    showCompleted: true,
    sortBy: 'date',
    sortOrder: 'desc',
    dateRange: 'all'
  };

  constructor(
    private taskService: TaskService,
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    this.loadData();
    this.setupDefaultCategories();
  }

  ngAfterViewInit() {
    this.createFloatingParticles();
  }

  async loadData() {
    await this.loadTasks();
    await this.loadCategories();
    this.updateStats();
    this.applyFilters();
  }

  async loadTasks() {
    this.tasks = await this.taskService.getTasks();
  }

  async loadCategories() {
    this.categories = await this.taskService.getCategories();
    this.updateCategoryTaskCounts();
  }

  private setupDefaultCategories() {
    const defaultCategories: Omit<TaskCategory, 'id' | 'taskCount'>[] = [
      { name: 'Personal', color: '#667eea', icon: 'person' },
      { name: 'Work', color: '#feca57', icon: 'briefcase' },
      { name: 'Shopping', color: '#48dbfb', icon: 'basket' },
      { name: 'Health', color: '#ff6b6b', icon: 'fitness' },
      { name: 'Learning', color: '#a55eea', icon: 'school' }
    ];

    defaultCategories.forEach(async (cat) => {
      const exists = this.categories.find(c => c.name === cat.name);
      if (!exists) {
        await this.taskService.addCategory(cat);
      }
    });
  }

  private getEmptyTask(): Partial<Task> {
    return {
      title: '',
      description: '',
      priority: 'medium',
      category: 'personal',
      reminderSet: false,
      estimatedTime: undefined
    };
  }

  toggleAddTaskForm() {
    this.showAddTaskForm = !this.showAddTaskForm;
    if (!this.showAddTaskForm) {
      this.newTask = this.getEmptyTask();
    }
  }

  cancelAddTask() {
    this.showAddTaskForm = false;
    this.newTask = this.getEmptyTask();
  }

  async addTask() {
    if (!this.newTask.title?.trim()) {
      this.showToast('Please enter a task title', 'warning');
      return;
    }

    const taskData: Omit<Task, 'id'> = {
      title: this.newTask.title.trim(),
      description: this.newTask.description?.trim() || '',
      completed: false,
      createdAt: new Date(),
      priority: this.newTask.priority as 'low' | 'medium' | 'high',
      category: this.newTask.category || 'personal',
      dueDate: this.newTask.dueDate ? new Date(this.newTask.dueDate) : undefined,
      dueTime: this.newTask.dueTime,
      reminderSet: this.newTask.reminderSet || false,
      estimatedTime: this.newTask.estimatedTime,
      isNew: true
    };

    try {
      const task = await this.taskService.addTask(taskData);
      this.tasks.unshift(task);
      
      if (task.reminderSet && task.dueDate) {
        await this.scheduleReminder(task);
      }

      this.showAddTaskForm = false;
      this.newTask = this.getEmptyTask();
      this.updateStats();
      this.applyFilters();
      this.animateStats();
      
      this.showToast('Task added successfully!', 'success');
      
      setTimeout(() => {
        if (task.isNew) {
          task.isNew = false;
        }
      }, 1000);
    } catch (error) {
      this.showToast('Error adding task', 'danger');
    }
  }

  async toggleTask(task: Task) {
    const wasCompleted = task.completed;
    task.completed = !task.completed;
    
    if (task.completed) {
      task.completedAt = new Date();
      if (task.estimatedTime) {
        const timeSpent = Math.round((new Date().getTime() - task.createdAt.getTime()) / (1000 * 60));
        task.timeSpent = timeSpent;
      }
    } else {
      task.completedAt = undefined;
      task.timeSpent = undefined;
    }
    
    await this.taskService.updateTask(task);
    this.updateStats();
    this.animateStats();
    
    const message = task.completed ? 'Task completed! 🎉' : 'Task marked as incomplete';
    this.showToast(message, task.completed ? 'success' : 'medium');
  }

  async deleteTask(task: Task) {
    const alert = await this.alertController.create({
      header: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            task.isDeleting = true;
            setTimeout(async () => {
              await this.taskService.deleteTask(task.id);
              this.tasks = this.tasks.filter(t => t.id !== task.id);
              this.updateStats();
              this.applyFilters();
              this.showToast('Task deleted', 'medium');
            }, 400);
          }
        }
      ]
    });
    await alert.present();
  }

  async shareTask(task: Task) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Share Task',
      buttons: [
        { text: 'Copy Task Details', icon: 'copy-outline', handler: () => this.copyTaskToClipboard(task) },
        { text: 'Share via Email', icon: 'mail-outline', handler: () => this.shareViaEmail(task) },
        { text: 'Export as Text', icon: 'document-text-outline', handler: () => this.exportTaskAsText(task) },
        { text: 'Cancel', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async editTask(task: Task) {
    this.showToast('Edit functionality coming soon!', 'medium');
  }

  async openTaskDetail(task: Task) {
    this.showToast(`Opening details for: ${task.title}`, 'medium');
  }

  filterByCategory(categoryId: string) {
    this.selectedCategory = this.selectedCategory === categoryId ? null : categoryId;
    this.applyFilters();
  }

  clearCategoryFilter() {
    this.selectedCategory = null;
    this.applyFilters();
  }

  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.tasks];

    if (this.selectedCategory) {
      filtered = filtered.filter(task => task.category === this.selectedCategory);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
      );
    }

    if (!this.currentFilter.showCompleted) {
      filtered = filtered.filter(task => !task.completed);
    }

    filtered.sort((a, b) => {
      switch (this.currentFilter.sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    if (this.currentFilter.sortOrder === 'asc') {
      filtered.reverse();
    }

    this.filteredTasks = filtered;
  }

  updateStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = this.tasks.filter(t => t.dueDate && !t.completed && new Date(t.dueDate) < new Date()).length;

    this.taskStats.total = total;
    this.taskStats.completed = completed;
    this.taskStats.pending = pending;
    this.taskStats.overdue = overdue;

    // Category counts
    const byCategory: Record<string, number> = {};
    this.categories.forEach(cat => {
      byCategory[cat.name] = this.tasks.filter(t => t.category === cat.name).length;
    });
    this.taskStats.byCategory = byCategory;

    // Priority counts
    const byPriority = { high: 0, medium: 0, low: 0 };
    this.tasks.forEach(t => {
      byPriority[t.priority]++;
    });
    this.taskStats.byPriority = byPriority;
  }

  animateStats() {
    this.statsAnimating = true;
    setTimeout(() => this.statsAnimating = false, 800);
  }

  updateCategoryTaskCounts() {
    this.categories.forEach(cat => {
      cat.taskCount = this.tasks.filter(t => t.category === cat.name).length;
    });
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 1500,
      position: 'top'
    });
    toast.present();
  }

  async copyTaskToClipboard(task: Task) {
    await navigator.clipboard.writeText(`${task.title}\n${task.description || ''}`);
    this.showToast('Task copied to clipboard!', 'success');
  }

  async shareViaEmail(task: Task) {
    const subject = encodeURIComponent(`Task: ${task.title}`);
    const body = encodeURIComponent(task.description || '');
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }

  exportTaskAsText(task: Task) {
    const element = document.createElement('a');
    const file = new Blob([`${task.title}\n${task.description || ''}`], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${task.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  createFloatingParticles() {
    // Example particle animation logic (optional)
    if (!this.particlesRef) return;
    const canvas = this.particlesRef.nativeElement as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; r: number; dx: number; dy: number }[] = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 1,
        dx: (Math.random() - 0.5) * 1,
        dy: (Math.random() - 0.5) * 1
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx = -p.dx;
        if (p.y < 0 || p.y > canvas.height) p.dy = -p.dy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
      });
      requestAnimationFrame(animate);
    };
    animate();
  }

  async scheduleReminder(task: Task) {
    // Placeholder for future reminder logic (local notifications, etc.)
    console.log('Reminder set for task:', task.title);
  }
}
