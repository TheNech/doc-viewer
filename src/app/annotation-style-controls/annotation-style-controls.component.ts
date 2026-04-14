import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { AnnotationStyle } from '../models/annotation.model';

@Component({
  selector: 'app-annotation-style-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './annotation-style-controls.component.html',
  styleUrl: './annotation-style-controls.component.scss',
})
export class AnnotationStyleControlsComponent {
  chromeStyle = input.required<AnnotationStyle>();
  closeAriaLabel = input.required<string>();
  closeTitle = input.required<string>();

  fontSizeInput = output<Event>();
  toggleItalic = output<void>();
  toggleBold = output<void>();
  toggleUnderline = output<void>();
  closeClick = output<void>();

  onCloseClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeClick.emit();
  }
}
