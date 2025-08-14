import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- Add this
import { IonicModule } from '@ionic/angular';   // <-- Add this
import { TaskService } from '../services/task.service';
import { Task } from '../models/task.model';
import { FormsModule } from '@angular/forms'; // <-- Add this for forms

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule],
})
export class HomePage implements OnInit, AfterViewInit {
  @ViewChild('particles', { static: false }) particlesRef!: ElementRef;

  tasks: Task[] = [];
  newTaskText: string = '';
  showSuccessBorder: boolean = false;
  statsAnimating: boolean = false;

  // Stats getters
  get totalTasks(): number {
    return this.tasks.length;
  }

  get completedTasks(): number {
    return this.tasks.filter(task => task.completed).length;
  }

  get pendingTasks(): number {
    return this.tasks.filter(task => !task.completed).length;
  }

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.loadTasks();
  }

  ngAfterViewInit() {
    this.createFloatingParticles();
  }

  async loadTasks() {
    this.tasks = await this.taskService.getTasks();
  }

  async addTask() {
    if (!this.newTaskText.trim()) {
      return;
    }

    const newTask: Omit<Task, 'id'> = {
      text: this.newTaskText.trim(),
      completed: false,
      createdAt: new Date(),
      isNew: true
    };

    const task = await this.taskService.addTask(newTask);
    this.tasks.unshift(task);
    this.newTaskText = '';
    
    // Show success feedback
    this.showSuccessBorder = true;
    this.animateStats();
    
    setTimeout(() => {
      this.showSuccessBorder = false;
      if (task.isNew) {
        task.isNew = false;
      }
    }, 1000);
  }

  async toggleTask(task: Task) {
    task.completed = !task.completed;
    await this.taskService.updateTask(task);
    this.animateStats();
  }

  async deleteTask(task: Task) {
    // Add exit animation
    task.isDeleting = true;
    
    setTimeout(async () => {
      await this.taskService.deleteTask(task.id);
      this.tasks = this.tasks.filter(t => t.id !== task.id);
      this.animateStats();
    }, 400);
  }

  trackByTaskId(index: number, task: Task): string {
    return task.id;
  }

  scrollToTop() {
    // Scroll to top functionality
    const content = document.querySelector('ion-content');
    if (content) {
      content.scrollToTop(300);
    }
  }

  private animateStats() {
    this.statsAnimating = true;
    setTimeout(() => {
      this.statsAnimating = false;
    }, 500);
  }

  private createFloatingParticles() {
    if (!this.particlesRef) return;

    setInterval(() => {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDuration = (Math.random() * 3 + 5) + 's';
      particle.style.opacity = (Math.random() * 0.5 + 0.3).toString();
      
      this.particlesRef.nativeElement.appendChild(particle);
      
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 8000);
    }, 2000);
  }
}