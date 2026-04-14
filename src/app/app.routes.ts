import { Routes } from '@angular/router';
import { DocumentViewComponent } from './document-view/document-view.component';

export const routes: Routes = [
  { path: 'document/:id', component: DocumentViewComponent },
  { path: '', pathMatch: 'full', redirectTo: 'document/1' },
  { path: '**', redirectTo: 'document/1' },
];
