import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { FirebaseService } from '../../core/services/firebase.service';
import { states } from './states';

@Component({
  selector: 'app-survey-form',
  templateUrl: './survey-form.component.html',
  styleUrls: ['./survey-form.component.scss'],
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: { showError: true }
    }
  ]
})
export class SurveyFormComponent implements OnInit {
  form: FormGroup = new FormGroup({});
  states = states;
  activities: string[] = [];
  loading = false;
  areMultipleActivitiesSelected = false;

  get activitiesFormArray(): FormArray {
    return this.form.controls.activities as FormArray;
  }

  constructor(private dialog: MatDialog, private formBuilder: FormBuilder, private firebaseService: FirebaseService) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  /** Adds the form value to the activities form array when one is checked. */
  onCheckboxChange(e: any): void {
    if (e.checked) {
      this.activitiesFormArray.push(new FormControl(e.source.value));
    } else {
      let i = 0;
      this.activitiesFormArray.controls.forEach((item: AbstractControl) => {
        if (item.value === e.source.value) {
          this.activitiesFormArray.removeAt(i);
          return;
        }
        i++;
      });
    }

    this.areMultipleActivitiesSelected = this.activitiesFormArray.length > 1;
  }

  /** Submits the survey response. */
  submitForm(): void {
    this.loading = true;
    this.form.controls.dateTimeTaken.setValue(new Date().toUTCString());

    // If only one activity is selected, set that activity to the most interesting activity.
    if (this.activitiesFormArray.length === 1) {
      this.form.controls.mostInterestingActivity.setValue(this.activitiesFormArray.value[0]);
    }

    this.firebaseService
      .addSurveySubmission(this.form.value)
      .then(
        () => this.openDialog(true),
        () => this.openDialog(false)
      )
      .catch(() => this.openDialog(false));
  }

  private initializeForm(): void {
    this.form = this.formBuilder.group({
      activities: this.formBuilder.array([]),
      mostInterestingActivity: [undefined, [Validators.required]],
      contactInformation: this.formBuilder.group({
        firstName: [undefined, [Validators.required]],
        lastName: [undefined, [Validators.required]],
        email: [undefined, [Validators.required, Validators.email]],
        address1: [undefined, [Validators.required]],
        address2: undefined,
        city: [undefined, [Validators.required]],
        state: [undefined, [Validators.required]],
        zip: [undefined, [Validators.required, Validators.pattern(/^[0-9]{5}(?:-[0-9]{4})?$/)]]
      }),
      additionalSpecials: false,
      recaptcha: [undefined, [Validators.required]],
      dateTimeTaken: [undefined],
      uniqueId: this.generateRandomId(12),
      ticketEmailSent: [false]
    });

    this.populateActivities();
  }

  private populateActivities(): void {
    this.activities = [
      'Golf',
      'White Water Rafting',
      'Waterfall Guided Tour',
      'Fine Dining',
      'Skiing',
      'ATV/UTV/Snowmobiling',
      'Romantic Getaway',
      'Outdoor Activities - Biking, Canoeing, Kayaking, Hiking',
      'Boating'
    ];
  }

  /** Opens the dialog */
  private openDialog(success: boolean): void {
    this.loading = false;
    this.dialog.open(DialogComponent, {
      maxWidth: '600px',
      disableClose: true,
      data: { success }
    });
  }

  private generateRandomId(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}

export interface DialogData {
  success: boolean;
}

@Component({
  selector: 'app-dialog',
  template: `<div *ngIf="success">
      <p>
        Thank you for completing this survey. Your free or discounted vacation will be processed and sent out
        shortly.
      </p>
      <p>
        Limit 1 special per household. Cannot be combined with any other specials.
      </p>
      <p>You may now close this window.</p>
    </div>
    <div *ngIf="!success">
      <p>
        This email has already been used. Please check your spam if you haven't received an email from us. If you
        believe this is an error, please refresh and try again or email us at vacationfreeup@gmail.com.
      </p>
    </div>`
})
export class DialogComponent implements OnInit {
  success = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {}

  ngOnInit(): void {
    this.success = this.data.success;
  }
}
