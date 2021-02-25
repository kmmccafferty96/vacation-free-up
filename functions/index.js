'use strict';

const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

var database = admin.database();

const vacationFreeUpEmail = functions.config().vacationfreeupgmail.email;
const vacationFreeUpPassword = functions.config().vacationfreeupgmail.password;
const vacationFreeUpMailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: vacationFreeUpEmail,
    pass: vacationFreeUpPassword
  }
});

exports.setServerDateOnRecord = functions.database
  .ref('/survey-submission-list/{surveyId}')
  .onCreate(async (snapshot, context) => {
    try {
      database.ref(`survey-submission-list/${snapshot.key}/dateTimeTaken`).set(new Date().toUTCString());
      functions.logger.log(`dateTimeTaken set on ${snapshot.key}`);
    } catch (error) {
      functions.logger.error(`There was an error setting dateTimeTaken for ${snapshot.key}:`, error);
    }

    return null;
  });

exports.sendSurveyConfirmationEmail = functions.database
  .ref('/survey-submission-list/{surveyId}')
  .onCreate(async (snapshot, context) => {
    const val = snapshot.val();
    const surveyeeFullName = `${val.contactInformation.firstName} ${val.contactInformation.lastName}`;
    const surveyeeEmail = val.contactInformation.email;

    const mailOptions = {
      from: '"Vacation Free UP" <vacationfreeup@gmail.com>',
      to: surveyeeEmail,
      subject: `Vacation Free UP Survey Confirmation`
    };

    // Build email
    mailOptions.text = `Dear ${surveyeeFullName},\r\n\r\nThank you for completing the VacationFreeUP.com survey and congratulations on receiving a
    free or discounted vacation.  Based upon your completed survey, we have chosen two of the best resorts for your next vacation in the Upper
    Peninsula of Michigan or Northern Wisconsin. The two resorts selected are The Four Seasons Island Resort (www.thefourseasonswi.com) located
    in Pembine, WI and Pine Mountain Ski and Golf Resort (www.pinemountainresort.com) located in Iron Mountain, Michigan.
    \r\n\r\n
    In the next few days, you will receive an email from Vacation Free UP with information and how to reserve your vacation. In the meantime, do
    not hesitate to research both resorts web sites provided above so you can select the resort which best fits your interests.
    \r\n\r\n
    Vacation Free UP will also provide details on how to reserve your stay and any rules for this offer.  Thank you again for your interest
    in Upper Peninsula of Michigan and Northern Wisconsin resorts.  We look forward to seeing you soon.
    \r\n\r\n
    Note: If 48 hours have passed and you have still not received a ticket, please reply to this email and we will get it sorted out.
    \r\n\r\nThank you,\r\nVacation Free UP\r\nwww.vacationfreeup.com`;

    mailOptions.html = `<p>Dear ${surveyeeFullName},</p>
    <p>Thank you for completing the VacationFreeUP.com survey and congratulations on receiving a
    free or discounted vacation.  Based upon your completed survey, we have chosen two of the best resorts for your next vacation in the Upper
    Peninsula of Michigan or Northern Wisconsin. The two resorts selected are <span style="font-weight: bold;">The Four Seasons Island Resort</span> (www.thefourseasonswi.com) located
    in Pembine, WI and <span style="font-weight: bold;">Pine Mountain Ski and Golf Resort</span> (www.pinemountainresort.com) located in Iron Mountain, Michigan.
    </p><p>
    In the next few days, you will receive an email from Vacation Free UP with information and how to reserve your vacation. In the meantime, do
    not hesitate to research both resorts web sites provided above so you can select the resort which best fits your interests.
    </p><p>
    Vacation Free UP will also provide details on how to reserve your stay and any rules for this offer.  Thank you again for your interest
    in Upper Peninsula of Michigan and Northern Wisconsin resorts.  We look forward to seeing you soon.
    </p><p>
    Note: If 48 hours have passed and you have still not received a ticket, please reply to this email and we will get it sorted out.
    </p>
    <p>Thank you,<br>Vacation Free UP<br><a href="https://www.vacationfreeup.com">www.vacationfreeup.com</a></p>`;

    try {
      await vacationFreeUpMailTransport.sendMail(mailOptions);
      functions.logger.log(`Confirmation email to surveyee ${surveyeeFullName} sent to:`, surveyeeEmail);
    } catch (error) {
      functions.logger.error(
        `There was an error while sending the confirmation email to the surveyee ${surveyeeFullName}:`,
        error
      );
    }

    return null;
  });
