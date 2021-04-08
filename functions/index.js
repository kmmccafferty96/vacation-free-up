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
    free or discounted vacation. Based upon your completed survey, we have chosen the best resort for your next vacation in the Upper
    Peninsula of Michigan or Northern Wisconsin. The resort selected is
    ${isPineMountain(val.mostInterestingActivity) ? 'Pine Mountain Ski and Golf Resort (www.pinemountainresort.com) located in Iron Mountain, Michigan' : 'The Four Seasons Island Resort (www.thefourseasonswi.com) located in Pembine, Wisconsin'}.
    \r\n\r\n
    In the next couple days, you will receive an email from Vacation Free UP with information and how to reserve your vacation. In the meantime, do
    not hesitate to research the resort's web site provided above to learn more.
    \r\n\r\n
    Vacation Free UP will also provide details on how to reserve your stay and any rules for this offer. Thank you again for your interest
    in Upper Peninsula of Michigan and Northern Wisconsin resorts. We look forward to seeing you soon.
    \r\n\r\n
    Note: If 48 hours have passed and you have still not received the offer, please reply to this email and we will get it sorted out.
    \r\n\r\nThank you,\r\nVacation Free UP\r\nwww.vacationfreeup.com`;

    mailOptions.html = `<p>Dear ${surveyeeFullName},</p>
    <p>Thank you for completing the VacationFreeUP.com survey and congratulations on receiving a
    free or discounted vacation. Based upon your completed survey, we have chosen the best resort for your next vacation in the Upper
    Peninsula of Michigan or Northern Wisconsin. The resort selected is
    ${isPineMountain(val.mostInterestingActivity) ? '<a href="https://www.pinemountainresort.com"><span style="font-weight: bold;">Pine Mountain Ski and Golf Resort</span></a> located in Iron Mountain, Michigan' : '<a href="https://www.thefourseasonswi.com"><span style="font-weight: bold;">The Four Seasons Island Resort</span></a> located in Pembine, Wisconsin'}.
    </p><p>
    In the next couple days, you will receive an email from Vacation Free UP with information and how to reserve your vacation. In the meantime, do
    not hesitate to research the resort's web site provided above to learn more.
    </p><p>
    Vacation Free UP will also provide details on how to reserve your stay and any rules for this offer. Thank you again for your interest
    in Upper Peninsula of Michigan and Northern Wisconsin resorts. We look forward to seeing you soon.
    </p><p>
    Note: If 48 hours have passed and you have still not received the offer, please reply to this email and we will get it sorted out.
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

exports.scheduledSendOfferEmail = functions.pubsub.schedule('10 11 * * *').onRun(async (context) => {
  var ref = database.ref('survey-submission-list');

  var surveyEmails = [];

  // Build surveyEmails array
  ref
    .orderByChild('ticketEmailSent')
    .equalTo(false)
    .once('value', async (snapshot) => {
      snapshot.forEach((s) => {
        const val = s.val();

        if (!val.ticketEmailSent) {
          const surveyeeFullName = `${val.contactInformation.firstName} ${val.contactInformation.lastName}`;
          const surveyeeEmail = val.contactInformation.email;
          const activity = val.mostInterestingActivity;
          const isPine = isPineMountain(activity);
          const surveyEmail = {
            key: s.key,
            to: surveyeeEmail,
            surveyeeFullName,
            surveyeeEmail,
            isPine
          };

          functions.logger.log(`Adding offer email for ${surveyeeFullName} (${surveyeeEmail})`);

          // Build email
          surveyEmail.textMessage = `Dear ${surveyeeFullName},\r\n\r\n
            ${getInitialText()}\r\n\r\n
            Offer(s)\r\n\r\n
            ${getOfferText(activity, true)}\r\n\r\n
            Visit ${isPine ? `www.pinemountainresort.com` : `www.thefourseasonswi.com`} for more information on lodging, food, and activities prior to your visit.\r\n\r\n
            Rules and regulations of offer.\r\n
            ${getRulesAndRegulations().join('\r\n')}
          `;

          surveyEmail.htmlMessage = `<div style="max-width: 900px; width: 100%; background-color: white;font-size:16px;">
          ${getLetterHeaderHTML(isPine)}
          <div style="padding: 25px 20px;">
            <p>
              Dear ${surveyeeFullName},
            </p>
            <p>
              ${getInitialText()}
            </p>
            <p>
              <span style="text-decoration:underline;font-weight:bold;">Offer(s)</span>
            </p>
            <p>
            ${getOfferText(activity, false)}
            </p>
            ${getImageHTML(activity)}
            <hr>
            <p>
              Visit ${isPine ? `<a href="https://www.pinemountainresort.com/">www.pinemountainresort.com</a>` : `<a href="https://www.thefourseasonswi.com/">www.thefourseasonswi.com</a>`} for more information on lodging, food, and activities prior to your visit.
            </p>
            <p style="font-size:12px;">
              <span style="font-weight:bold;text-decoration:underline;">Rules and regulations of offer.</span><br>
              ${getRulesAndRegulations().join('<br>')}
            </p>
          </div>
          ${getLetterFooterHTML(isPine)}
        </div>`;

          surveyEmails.push(surveyEmail);
        }
      });

      // Loop surveyEmails array and send emails
      for (let i = 0; i < surveyEmails.length; i++) {
        const mailOptions = {
          from: '"Vacation Free UP" <vacationfreeup@gmail.com>',
          to: surveyEmails[i].surveyeeEmail,
          subject: `Vacation Offer from ${surveyEmails[i].isPine ? 'Pine Mountain Ski & Golf Resort' : 'The Four Seasons Island Resort'}`,
          text: surveyEmails[i].textMessage,
          html: surveyEmails[i].htmlMessage
        };

        try {
          await vacationFreeUpMailTransport.sendMail(mailOptions);
          functions.logger.log(
            `Offer email to surveyee ${surveyEmails[i].surveyeeFullName} sent to:`,
            surveyEmails[i].surveyeeEmail
          );
          database.ref(`survey-submission-list/${surveyEmails[i].key}/ticketEmailSent`).set(true);
        } catch (error) {
          functions.logger.error(
            `There was an error while sending the offer email to the surveyee ${surveyEmails[i].surveyeeFullName}:`,
            error
          );
        }
      }
    });

  return null;
});

exports.createRowInSpreadsheet = functions.database
  .ref('/survey-submission-list/{surveyId}')
  .onCreate(async (snapshot, context) => {
    const val = snapshot.val();
    var jwt = getJwt();
    var apiKey = getApiKey();
    var spreadsheetId = '1oNWU0w5kN96kwMbXXqpnEK8ZQrY2heRPidKhUk89RyA';
    var range = 'A1';
    var row = [
      val.activities ? val.activities.join(', ') : '',
      val.mostInterestingActivity,
      val.contactInformation.firstName,
      val.contactInformation.lastName,
      val.contactInformation.email,
      val.contactInformation.address1,
      val.contactInformation.address2,
      val.contactInformation.city,
      val.contactInformation.state,
      val.contactInformation.zip,
      val.additionalSpecials,
      val.dateTimeTaken,
      val.uniqueId
    ];
    appendSheetRow(jwt, apiKey, spreadsheetId, range, row);
  });

function getJwt() {
  var credentials = require('./credentials.json');
  return new google.auth.JWT(credentials.client_email, null, credentials.private_key, [
    'https://www.googleapis.com/auth/spreadsheets'
  ]);
}

function getApiKey() {
  var apiKeyFile = require('./api_key.json');
  return apiKeyFile.key;
}

function appendSheetRow(jwt, apiKey, spreadsheetId, range, row) {
  const sheets = google.sheets({ version: 'v4' });
  sheets.spreadsheets.values.append(
    {
      spreadsheetId: spreadsheetId,
      range: range,
      auth: jwt,
      key: apiKey,
      valueInputOption: 'RAW',
      resource: { values: [row] }
    },
    function (err, result) {
      if (err) {
        throw err;
      } else {
        functions.logger.log('Updated sheet: ' + result.data.updates.updatedRange);
      }
    }
  );
}

/** Returns true if the offer is for Pine Mountain, false if it's for Four Seasons. */
function isPineMountain(activity) {
  const pmActivities = ['White Water Rafting'];
  return pmActivities.includes(activity);
}

function getImageHTML(activity) {
  const imageFileName = getImageFileName(activity);
  let html = '';

  if (imageFileName) {
    html = `<div style="text-align:center;">
      <img style="width:100%;max-width:600px;border:4px solid #a3862f;" src="https://www.vacationfreeup.com/assets/activities/${imageFileName}" />
    </div>`;
  }

  return html;
}

function getImageFileName(activity) {
  switch (activity) {
    case 'Golf':
      return `golf.jpg`;

    case 'White Water Rafting':
      return `rafting.jpg`;

    case 'Waterfall Guided Tour':
      return `waterfall.jpg`;

    case 'Fine Dining':
      return `dining.jpg`;

    case 'Skiing':
      return `skiing.jpg`;

    case 'ATV/UTV/Snowmobiling':
      return `ATV.jpg`;

    case 'Romantic Getaway':
      return `romantic.jpg`;

    case 'Outdoor Activities - Biking, Canoeing, Kayaking, Hiking':
      return `biking.jpg`;

    case 'Boating':
      return `boating.jpg`;
  }
}

function getOfferText(activity, isPlainText) {
  switch (activity) {
    case 'Golf':
      return `Two days of unlimited golf for 2 guests ($200 value) at The Rivers Golf Course when you book any 2-night
      weekday (Sunday – Thursday) stay at the Four Seasons Island Resort. Use Code ${formatRedemptionCode('FSGOLF2021', isPlainText)} at time of booking.`;

    case 'White Water Rafting':
      return `(2) White Water Rafting Tickets ($99 value) when you book any 2-night weekday (Sunday – Thursday)
      stay at Pine Mountain Ski & Golf Resort. Use Code ${formatRedemptionCode('PMWHITEWATER2021', isPlainText)} at time of booking.
      ${getDoubleLineBreak(isPlainText)}
      (2) White Water Rafting Tickets ($99 value) when you book any 2-night weekday (Sunday – Thursday) stay at
      the Four Seasons Island Resort. Use Code ${formatRedemptionCode('FSWHITEWATER2021', isPlainText)} at time of booking.`;

    case 'Waterfall Guided Tour':
      return `(2) Waterfall Guided Tours ($99 value) when you book any 2-night weekday (Sunday – Thursday) stay at the Four
      Seasons Island Resort. Use Code ${formatRedemptionCode('FSWATERFALL2021', isPlainText)} at time of booking.`;

    case 'Fine Dining':
      return `$100 gift card used toward dinner in the Diamond room with purchase of a 2-night weekday (Sunday – Thursday)
      stay at Four Seasons Island Resort. Use code ${formatRedemptionCode('FourSeasonsDR100', isPlainText)} at time of booking.`;

    case 'Skiing':
      return `(2) free lift tickets to Pine Mountain Ski & Golf Resort with purchase of a 2-night weekend (Friday & Saturday)
      stay at Four Seasons Island Resort. Use code ${formatRedemptionCode('PMSKIING', isPlainText)} at time of booking.`;

    case 'ATV/UTV/Snowmobiling':
      return `$100 gift card used towards dining in the Boundary Waters Sports Bar & Grille with purchase of a 2-night weekday
      (Sunday – Thursday) stay at Four Seasons Island Resort.  Use code ${formatRedemptionCode('FourSeasonsBW100', isPlainText)} at time of booking.`;

    case 'Romantic Getaway':
      return `Bottle of Champagne with Chocolate and a $50 gift card used toward dinner in The Diamond Room with purchase of a 2-night weekday
      (Sunday – Thursday) stay. Use code ${formatRedemptionCode('FourSeasonsDR50', isPlainText)} at time of booking.  `

    case 'Outdoor Activities - Biking, Canoeing, Kayaking, Hiking':
      return `(2) 2 hours of biking and 2 hours of kayaking with purchase of a 2-night weekday (Sunday – Thursday) stay at Four Seasons
      Island Resort. Use code ${formatRedemptionCode('FourSeasonsACTIVITIES', isPlainText)} at time of booking.`;

    case 'Boating':
      return `(1) Guided pontoon tour ride, up to 8 people on the Menominee River ($150 value) when you book any 2-night weekday
      (Sunday – Thursday) stay at the Four Seasons Island Resort. Use Code ${formatRedemptionCode('FSPONTOON2021', isPlainText)} at time of booking.`;
  }
}

function getDoubleLineBreak(isPlainText) {
  return isPlainText ? '\r\n\r\n' : '<br><br>';
}

function formatRedemptionCode(code, isPlainText) {
  return isPlainText ? code : `<span style="font-weight:bold;">${code}</span>`;
}

function getInitialText() {
  return `Please review your free or discounted vacation information below. Please call a resort reservation specialist to book your stay with the code provided. Also, note this is a limited time offer and subject to availability.`;
}

function getRulesAndRegulations() {
  return [
    'Limited to 1 special per household.',
    'Cannot be combined with any other specials.',
    'Must be booked 21 days in advance, subject to availability.',
    'Must bring copy of offer, valid ID required, must be 21 or older.',
    'Limit 2 adults per lodge room.',
    'Excludes holiday weekends.',
    'Gift cards are valid for food and beverage only.',
    'Reservation must be booked within 30 days of receiving this offer.',
    'Reservations are cancelable within 30 days of stay for any reason.',
    'Excludes daily resort fee if applicable.'
  ];
}

function getLetterHeaderHTML(isPineMountain) {
  if (isPineMountain) {
    return `<a href="https://www.pinemountainresort.com/">
      <img src="https://www.vacationfreeup.com/assets/pm_letterhead_top.jpg" alt="Pine Mountain Resort Letter Header" style="width: 100%;">
    </a>`;
  } else {
    return `<a href="https://www.thefourseasonswi.com/">
      <img src="https://www.vacationfreeup.com/assets/fs_letterhead_top.jpg" alt="The Four Seasons Island Resort Letter Header" style="width: 100%;">
    </a>`;
  }
}

function getLetterFooterHTML(isPineMountain) {
  if (isPineMountain) {
    return `<img src="https://www.vacationfreeup.com/assets/pm_letterhead_bottom.jpg" alt="Pine Mountain Resort Letter Footer" style="width: 100%;">`;
  } else {
    return `<img src="https://www.vacationfreeup.com/assets/fs_letterhead_bottom.jpg" alt="The Four Seasons Island Resort Letter Footer" style="width: 100%;">`;
  }
}
