import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-document-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-header.component.html',
  styleUrl: './document-header.component.scss',
})
export class DocumentHeaderComponent {
  documentName = input.required<string>();

  zoom = input.required<number>();

  minZoom = input.required<number>();

  maxZoom = input.required<number>();

  placementMode = input.required<boolean>();

  clearAllDisabled = input.required<boolean>();

  canUndo = input.required<boolean>();

  zoomOut = output<void>();

  zoomIn = output<void>();

  togglePlacement = output<void>();

  clearAll = output<void>();

  undo = output<void>();
  
  save = output<void>();
}
