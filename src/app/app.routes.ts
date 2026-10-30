import { Routes } from '@angular/router';

const page = () => import('./comparison/comparison-page').then((m) => m.ComparisonPage);

export const routes: Routes = [
  { path: '', loadComponent: page },
  { path: 'c/:id', loadComponent: page },
  { path: '**', redirectTo: '' },
];
