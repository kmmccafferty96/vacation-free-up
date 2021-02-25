import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/database';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  dbRef: firebase.database.Reference;

  constructor(private db: AngularFireDatabase) {
    this.dbRef = this.db.database.ref('survey-submission-list');
  }

  addSurveySubmission(formValue: any): Promise<any> {
    return this.dbRef.child(this.encodeEmail(formValue.contactInformation.email).toLowerCase()).set(formValue);
  }

  private encodeEmail(email: string): string {
    return email.replace(/\./g, ',');
  }
}
