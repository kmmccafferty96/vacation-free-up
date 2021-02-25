import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { DialogComponent, SurveyFormComponent } from './components/survey-form/survey-form.component';

@NgModule({
  declarations: [AppComponent, DialogComponent, SurveyFormComponent],
  imports: [CommonModule, BrowserModule, CoreModule, BrowserAnimationsModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
