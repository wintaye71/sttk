'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL;

//new text



// Imports dependencies and set up http server
const
  { uuid } = require('uuidv4'),
  { format } = require('util'),
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  firebase = require("firebase-admin"),
  ejs = require("ejs"),
  fs = require('fs'),
  multer = require('multer'),
  app = express();

const uuidv4 = uuid();
const session = require('express-session')

app.use(body_parser.json());
app.use(body_parser.urlencoded());
app.set('trust proxy', 1);
app.use(session({
  secret: 'effystonem',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));
app.use(express.static("images"));

const bot_questions = {
  "q1": "Please enter date (yyyy-mm-dd)",
  "q2": "Please enter time (hh:mm)",
  "q3": "Please enter full name",
  "q4": "Please select gender",
  "q5": "Please enter phone number",
  "q6": "Please enter email",
  "q7": "Please leave a message"
}

let current_question = '';

let user_id = '';

let userInputs = [];

let selectedDoc = '';
let selectedDept = '';
let selectedRegorCon = '';
let updateReference = '';

//const datepicker = require('js-datepicker');

/*
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
})*/

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024  //no larger than 5mb
  }

});

// parse application/x-www-form-urlencoded


app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');




var firebaseConfig = {
  credential: firebase.credential.cert({
    "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "project_id": process.env.FIREBASE_PROJECT_ID,
  }),
  databaseURL: process.env.FIREBASE_DB_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
};



firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();
let bucket = firebase.storage().bucket();

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {

  // Parse the request body from the POST
  let body = req.body;



  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    body.entry.forEach(function (entry) {

      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id;

      user_id = sender_psid;

      if (!userInputs[user_id]) {
        userInputs[user_id] = {};
      }


      if (webhook_event.message) {
        if (webhook_event.message.quick_reply) {
          handleQuickReply(sender_psid, webhook_event.message.quick_reply.payload);
        } else {
          handleMessage(sender_psid, webhook_event.message);
        }
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


app.use('/uploads', express.static('uploads'));


app.get('/', function (req, res) {
  res.send('your app is up and running');
});

app.get('/test', function (req, res) {
  res.render('test.ejs');
});

app.post('/test', function (req, res) {
  const sender_psid = req.body.sender_id;
  let response = { "text": "You  click delete button" };
  callSend(sender_psid, response);
});

var sess;
app.get('/login', function (req, res) {
  sess = req.session;

  if (sess.login) {
    res.send('You are already login. <a href="logout">logout</a>');
  } else {
    res.render('login.ejs');
  }

});


app.get('/logout', function (req, res) {
  //sess = req.session;   
  req.session.destroy(null);
  res.redirect('login');
});

app.post('/login', function (req, res) {
  sess = req.session;

  let username = req.body.username;
  let password = req.body.password;

  if (username == 'admin' && password == 'test123') {
    sess.username = 'admin';
    sess.login = true;
    res.render('home.ejs');
  } else if (username == 'Dr. Phyu Sin Win' && password == 'Doc001') {
    sess.username = 'Dr. Phyu Sin Win';
    sess.login = true;
    res.render('homeDoc.ejs', { doctor: username });
  } else if (username == 'Dr. Cho Nwe Zin' && password == 'Doc002') {
    sess.username = 'Dr. Cho Nwe Zin';
    sess.login = true;
    res.render('homeDoc.ejs', { doctor: username });
  } else if (username == 'Dr. Kyaw Thu' && password == 'Doc003') {
    sess.username = 'Dr. Kyaw Thu';
    sess.login = true;
    res.render('homeDoc.ejs', { doctor: username });
  } else if (username == 'Dr. Kyaw Thu' && password == 'Doc004') {
    sess.username = 'Dr. Maung Oo';
    sess.login = true;
    res.render('homeDoc.ejs', { doctor: username });
  }

  else {
    res.send('login failed');
  }
});

app.get('/publicpage', function (req, res) {
  res.render('publicpage.ejs');
});

app.get('/home', function (req, res) {
  res.render('home.ejs');
});

app.get('/homedoctor', function (req, res) {
  res.render('homeDoc.ejs');
});





app.get('/admin/appointments', async function (req, res) {

  const appointmentsRef = db.collection('appointments').orderBy('created_on', 'desc');
  const snapshot = await appointmentsRef.get();

  if (snapshot.empty) {
    res.send('no data');
  }

  let data = [];

  snapshot.forEach(doc => {
    let appointment = {};
    appointment = doc.data();
    appointment.doc_id = doc.id;

    data.push(appointment);

  });

  console.log('DATA:', data);

  res.render('appointments.ejs', { data: data });

});

app.get('/admin/updateappointment/:doc_id', async function (req, res) {
  let doc_id = req.params.doc_id;

  const appoinmentRef = db.collection('appointments').doc(doc_id);
  const doc = await appoinmentRef.get();
  if (!doc.exists) {
    console.log('No such document!');
  } else {
    console.log('Document data:', doc.data());
    let data = doc.data();
    data.doc_id = doc.id;

    console.log('Document data:', data);
    res.render('editappointment.ejs', { data: data });
  }

});


app.post('/admin/updateappointment', function (req, res) {
  console.log('REQ:', req.body);

  let data = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    gender: req.body.gender,
    doctor: req.body.doctor,
    department: req.body.department,
    visit: req.body.visit,
    date: req.body.date,
    time: req.body.time,
    message: req.body.message,
    status: req.body.status,
    doc_id: req.body.doc_id,
    ref: req.body.ref,
    comment: req.body.comment
  }

  db.collection('appointments').doc(req.body.doc_id)
    .update(data).then(() => {
      res.redirect('/admin/appointments');
    }).catch((err) => console.log('ERROR:', error));

});



/*********************************************
Consultations
**********************************************/
app.get('/admin/consultations', async function (req, res) {

  const consultRef = db.collection('consult').orderBy('created_on', 'desc');
  const snapshot = await consultRef.get();

  if (snapshot.empty) {
    res.send('no data');
  }

  let data = [];

  snapshot.forEach(doc => {
    let consult = {};
    consult = doc.data();
    consult.doc_id = doc.id;

    data.push(consult);

  });

  console.log('DATA:', data);

  res.render('consultations.ejs', { data: data });

});

app.get('/admin/updateconsultation/:doc_id', async function (req, res) {
  let doc_id = req.params.doc_id;

  const consultRef = db.collection('consult').doc(doc_id);
  const doc = await consultRef.get();
  if (!doc.exists) {
    console.log('No such document!');
  } else {
    console.log('Document data:', doc.data());
    let data = doc.data();
    data.doc_id = doc.id;

    console.log('Document data:', data);
    res.render('editconsultations.ejs', { data: data });
  }

});


app.post('/admin/updateconsultation', function (req, res) {
  console.log('REQ:', req.body);
  let data = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    gender: req.body.gender,
    age: req.body.age,
    doctor: req.body.doctor,
    department: req.body.department,
    message: req.body.message,
    answers: req.body.answers,
    image: req.body.image,
    status: req.body.status,
    doc_id: req.body.doc_id,
    reference: req.body.reference,
    comment: req.body.comment
  }

  db.collection('consult').doc(req.body.doc_id)
    .update(data).then(() => {
      res.redirect('/admin/consultations');
    }).catch((err) => console.log('ERROR:', error));

});


/*********************************************
Consultations Doctor View
**********************************************/
app.get('/doctor/consultations', async function (req, res) {

  let doctor = sess.username;
  const consultRef = db.collection('consult');
  const snapshot = await consultRef.where('doctor', '==', doctor).get();

  if (snapshot.empty) {
    res.send('no data');
  }

  let data = [];

  snapshot.forEach(doc => {
    let consult = {};
    consult = doc.data();
    consult.doc_id = doc.id;

    data.push(consult);

  });

  console.log('DATA:', data);

  res.render('consultationsDoctor.ejs', { data: data });

});

app.get('/doctor/updateconsultation/:doc_id', async function (req, res) {
  let doc_id = req.params.doc_id;
  let doctor = sess.username;
  const consultRef = db.collection('consult').doc(doc_id);
  const doc = await consultRef.get();
  if (!doc.exists) {
    console.log('No such document!');
  } else {
    console.log('Document data:', doc.data());
    let data = doc.data();
    data.doc_id = doc.id;

    console.log('Document data:', data);
    res.render('editconsultationsByDoctor.ejs', { data: data });
  }

});


app.post('/doctor/updateconsultation', function (req, res) {
  console.log('REQ:', req.body);
  let data = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    gender: req.body.gender,
    age: req.body.age,
    doctor: req.body.doctor,
    department: req.body.department,
    message: req.body.message,
    answers: req.body.answers,
    image: req.body.image,
    status: req.body.status,
    doc_id: req.body.doc_id,
    reference: req.body.reference,
    comment: req.body.comment
  }

  db.collection('consult').doc(req.body.doc_id)
    .update(data).then(() => {
      res.redirect('/doctor/consultations');
    }).catch((err) => console.log('ERROR:', error));

});



/*********************************************
Gallery page
**********************************************/
app.get('/showimages/:sender_id/', function (req, res) {
  const sender_id = req.params.sender_id;

  let data = [];

  db.collection("images").limit(20).get()
    .then(function (querySnapshot) {
      querySnapshot.forEach(function (doc) {
        let img = {};
        img.id = doc.id;
        img.url = doc.data().url;

        data.push(img);

      });
      console.log("DATA", data);
      res.render('gallery.ejs', { data: data, sender_id: sender_id, 'page-title': 'welcome to my page' });

    }

    )
    .catch(function (error) {
      console.log("Error getting documents: ", error);
    });
});


app.post('/imagepick', function (req, res) {

  const sender_id = req.body.sender_id;
  const doc_id = req.body.doc_id;

  console.log('DOC ID:', doc_id);

  db.collection('images').doc(doc_id).get()
    .then(doc => {
      if (!doc.exists) {
        console.log('No such document!');
      } else {
        const image_url = doc.data().url;

        console.log('IMG URL:', image_url);

        let response = {
          "attachment": {
            "type": "template",
            "payload": {
              "template_type": "generic",
              "elements": [{
                "title": "Is this the image you like?",
                "image_url": image_url,
                "buttons": [
                  {
                    "type": "postback",
                    "title": "Yes!",
                    "payload": "yes",
                  },
                  {
                    "type": "postback",
                    "title": "No!",
                    "payload": "no",
                  }
                ],
              }]
            }
          }
        }


        callSend(sender_id, response);
      }
    })
    .catch(err => {
      console.log('Error getting document', err);
    });

});



/*********************************************
END Gallery Page
**********************************************/

//webview test
app.get('/webview/:sender_id', function (req, res) {
  const sender_id = req.params.sender_id;
  res.render('consultationwebview.ejs', { title: "Consultation", doctor: selectedDoc, dept: selectedDept, sender_id: sender_id });
});

app.post('/webview', upload.single('file'), function (req, res) {
  let doctor = selectedDoc;
  let department = selectedDept;
  let name = req.body.name;
  let gender = req.body.gender;
  let age = req.body.age;
  let phone = req.body.phone;
  let email = req.body.email;
  let message = req.body.message;
  let img_url = "";
  let sender = req.body.sender;
  let reference = generateRandom(6);
  let status = "pending";
  let created_on = new Date();
  //data.created_on = new Date();
  console.log("NAME:", name);
  console.log("REQ FILE:", req.file);

  let file = req.file;
  if (file) {
    uploadImageToStorage(file).then((img_url) => {
      db.collection('consult').doc(reference).set({
        name: name,
        gender: gender,
        age: age,
        phone: phone,
        email: email,
        doctor: doctor,
        department: department,
        message: message,
        image: img_url,
        created_on: created_on,
        reference: reference,
        status: status
      }).then(success => {
        console.log('DATA SAVED', success);
        let text = "Thank you. We have received your questions to consult." + "\u000A";
        text += "We wil reply you to confirm soon" + "\u000A";
        text += "Your booking reference number is: " + reference;
        //let response = { "text": text };
        //callSend(sender, response);
        showConsultationReply(sender, text);
      }).catch(error => {
        console.log(error);
      });
    }).catch((error) => {
      console.error(error);
    });
  } else {
    db.collection('consult').doc(reference).set({
      name: name,
      gender: gender,
      age: age,
      phone: phone,
      email: email,
      doctor: doctor,
      department: department,
      message: message,
      image: img_url,
      created_on: created_on,
      reference: reference,
      status: status
    }).then(success => {
      console.log('DATA SAVED', success);
      let text = "Thank you. We have received your questions to consult." + "\u000A";
      text += "We wil reply you to confirm soon" + "\u000A";
      text += "Your booking reference number is: " + reference;
      showConsultationReply(sender, text);
    }).catch(error => {
      console.log(error);
    });

  }

});

app.get('/webview2/:sender_id', function (req, res) {
  const sender_id = req.params.sender_id;
  res.render('registrationPendingWebview.ejs', { title: "Booking Update", updateData: updateData, sender_id: sender_id });
});

app.post('/webview2', upload.single('file'), function (req, res) {
  updateData = [];
  let name = req.body.name;
  let sender = req.body.sender;
  let doc_id = req.body.doc_id;
  let created_on = new Date();
  console.log('REQ:', req.body);
  console.log('REQ NAME:', name);
  console.log('REQ MESSAGE:', req.body.message);
  let data = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    gender: req.body.gender,
    doctor: req.body.doctor,
    department: req.body.department,
    date: req.body.date,
    time: req.body.time,
    message: req.body.message,
    status: req.body.status,
    created_on: created_on,
    ref: req.body.ref
  }



  db.collection('appointments').doc(doc_id)
    .update(data).then(() => {
      console.log('Update Successful');
      let text = "Your booking is successfully updated.\n";
      text += "Name : " + req.body.name + "\n";
      text += "Doctor : " + req.body.doctor + "\n";
      text += "Department : " + req.body.department + "\n";
      text += "Date : " + req.body.date + "\n";
      text += "Time : " + req.body.time + "\n";
      text += "Message : " + req.body.message + "\n";
      text += "Gender : " + req.body.gender + "\n";
      text += "Phone : " + req.body.phone + "\n";
      text += "Email : " + req.body.email + "\n";
      text += "Reference : " + req.body.ref + "\n";
      showupdatesuccessfulReply(sender, text);

    }).catch(error => {
      console.log(error);
    });

});

app.get('/webview3/:sender_id', function (req, res) {
  const sender_id = req.params.sender_id;
  res.render('consultationPendingWebview.ejs', { title: "Booking Update", updateData: updateData2, sender_id: sender_id });
});

app.post('/webview3', upload.single('file'), function (req, res) {
  updateData2 = [];
  let name = req.body.name;
  let sender = req.body.sender;
  let doc_id = req.body.doc_id;
  let created_on = new Date();
  console.log('REQ:', req.body);
  console.log('REQ NAME:', name);
  console.log('REQ MESSAGE:', req.body.message);
  let data = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    gender: req.body.gender,
    doctor: req.body.doctor,
    department: req.body.department,
    date: req.body.date,
    time: req.body.time,
    message: req.body.message,
    status: req.body.status,
    created_on: created_on,
    reference: req.body.reference,
    image: req.body.image
  }



  db.collection('consult').doc(doc_id)
    .update(data).then(() => {
      console.log('Update Successful');
      let text = "Your booking is successfully updated.\n";
      text += "Name : " + req.body.name + "\n";
      text += "Doctor : " + req.body.doctor + "\n";
      text += "Department : " + req.body.department + "\n";
      text += "Date : " + req.body.date + "\n";
      text += "Time : " + req.body.time + "\n";
      text += "Message : " + req.body.message + "\n";
      text += "Gender : " + req.body.gender + "\n";
      text += "Phone : " + req.body.phone + "\n";
      text += "Email : " + req.body.email + "\n";
      text += "Reference : " + req.body.reference + "\n";
      showupdatesuccessfulReply(sender, text);

    }).catch(error => {
      console.log(error);
    });

});



let updateData = [];
async function isValidBooking(refer, sender_psid) {
  try {

    const appointmentsRef = db.collection('appointments');
    const snapshot = await appointmentsRef.where('ref', '==', refer).get();
    if (snapshot.empty) {
      noDataConsultation(sender_psid);
      console.log('DATA:', 'no data');
      return;
    } else {
      snapshot.forEach(doc => {
        let appointment = {};
        appointment = doc.data();
        appointment.doc_id = doc.id;

        updateData.push(appointment);

      });
      console.log('DATA:', updateData);
      updateData.forEach(function (appointment) {
        if (appointment.status == 'confirm') {
          console.log('appointment.status:', appointment.status);
          registrationConfirmReply(sender_psid);
          return;
        } else {
          console.log('appointment.status:', appointment.status);
          registrationPending(sender_psid);
          //res.render('editappointments.ejs', { data: data });
          return;
        }
      });
    }
    return updateData;
  } catch (err) {
    throw err;
  }
}

const registrationConfirmReply = (sender_psid) => {
  let response = { "text": "Your reference number is already confirm. Therefore you cannot update your booking." };
  callSend(sender_psid, response);
}

const consultationsPendingReply = (sender_psid) => {
  let response = { "text": "Your reference number is in process. Please recheck later." };
  callSend(sender_psid, response);
}

const consultationsResultReply = (sender_psid, replyText) => {
  let response = { "text": replyText };
  callSend(sender_psid, response);
}

const showConsultationReply = (sender_psid, replyText) => {
  let response = { "text": replyText };
  callSend(sender_psid, response);
}

const showupdatesuccessfulReply = (sender_psid, replyText) => {
  let response = { "text": replyText };
  callSend(sender_psid, response);
}

//Set up Get Started Button. To run one time
//eg https://fbstarter.herokuapp.com/setgsbutton
app.get('/setgsbutton', function (req, res) {
  setupGetStartedButton(res);
});

//Set up Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/setpersistentmenu
app.get('/setpersistentmenu', function (req, res) {
  setupPersistentMenu(res);
});

//Remove Get Started and Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/clear
app.get('/clear', function (req, res) {
  removePersistentMenu(res);
});

//whitelist domains
//eg https://fbstarter.herokuapp.com/whitelists
app.get('/whitelists', function (req, res) {
  whitelistDomains(res);
});


// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {


  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check token and mode
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

/**********************************************
Function to Handle when user send quick reply message
***********************************************/

function handleQuickReply(sender_psid, received_message) {

  console.log('QUICK REPLY', received_message);

  received_message = received_message.toLowerCase();

  if (received_message.startsWith("gender:")) {
    let gender = received_message.slice(7);
    console.log('GENDER ENTERED', gender);
    userInputs[user_id].gender = gender;
    current_question = 'q5';
    botQuestions(current_question, sender_psid);

  } else if (received_message.startsWith("visit:")) {
    let visit = received_message.slice(6);

    userInputs[user_id].visit = visit;

    switch (visit) {
      case "first time":
        current_question = 'q1';
        botQuestions(current_question, sender_psid);
        break;
      case "follow up":
        current_question = 'q1';
        botQuestions(current_question, sender_psid);
        break;
    }
  } else if (received_message.startsWith("department:")) {
    let dept = received_message.slice(11);
    userInputs[user_id].department = dept;
    selectedDept = dept;
    switch (dept) {
      case "cardiac surgery":
        showCardiacSurgeryDoctor(sender_psid);
        break;
      case "ear nose throat":
        showEarNoseThroatDoctor(sender_psid);
        break;
      case "general medicine":
        showGeneralMedicineDoctor(sender_psid);
        break;
      case "hepatology":
        showHepatologyDoctor(sender_psid);
        break;
      case "neurology":
        showNeurologyDoctor(sender_psid);
        break;
      case "obstetrics":
        showObstetricsDoctor(sender_psid);
        break;
      case "ophthalmology":
        showOphthalmologyDoctor(sender_psid);
        break;
      case "orthopedic":
        showOrthopedicDoctor(sender_psid);
        break;
      case "paediatrics":
        showPaediatricsDoctor(sender_psid);
        break;
      case "respiratory":
        showRespiratoryDoctor(sender_psid);
        break;
      default:
        showGeneralMedicineDoctor(sender_psid);
    }
  } else if (received_message.startsWith("depart:")) {
    let dept = received_message.slice(7);
    userInputs[user_id].department = dept;
    selectedDept = dept;
    switch (dept) {
      case "psychiatry":
        showPsychiatryDoctor(sender_psid);
        break;
      case "general medicine":
        showGMDoctorConsult(sender_psid);
        break;
      default:
        showGMDoctorConsult(sender_psid);
    }
  } else if (received_message.startsWith("update:")) {
    let regcon = received_message.slice(7);
    selectedRegorCon = regcon;
    console.log("Selected Regor Con", selectedRegorCon);
    switch (regcon) {
      case "registration":
        enterRegistrationReference(sender_psid);
        //checkRegistrationReference(sender_psid);
        break;
      case "consultation":
        enterConsultationReference(sender_psid);
        break;
      default:
        enterRegistrationReference(sender_psid);
    }
  }
  else {

    switch (received_message) {
      case "on":
        showQuickReplyOn(sender_psid);
        break;
      case "off":
        showQuickReplyOff(sender_psid);
        break;
      case "confirm-appointment":
        saveAppointment(userInputs[user_id], sender_psid);
        break;
      default:
        defaultReply(sender_psid);
    }

  }



}

/**********************************************
Function to Handle when user send text message
***********************************************/

const handleMessage = (sender_psid, received_message) => {

  console.log('TEXT REPLY', received_message);
  //let message;
  let response;

  if (received_message.attachments) {
    handleAttachments(sender_psid, received_message.attachments);
  } else if (current_question == 'q1') {
    console.log('DATE ENTERED', received_message.text);
    userInputs[user_id].date = received_message.text;
    current_question = 'q2';
    botQuestions(current_question, sender_psid);
  } else if (current_question == 'q2') {
    console.log('TIME ENTERED', received_message.text);
    userInputs[user_id].time = received_message.text;
    current_question = 'q3';
    botQuestions(current_question, sender_psid);
  } else if (current_question == 'q3') {
    console.log('FULL NAME ENTERED', received_message.text);
    userInputs[user_id].name = received_message.text;
    current_question = 'q4';
    botQuestions(current_question, sender_psid);
  } else if (current_question == 'q4') {
    console.log('GENDER ENTERED', received_message.text);
    userInputs[user_id].gender = received_message.text;
    current_question = 'q5';
    botQuestions(current_question, sender_psid);
  } else if (current_question == 'q5') {
    console.log('PHONE NUMBER ENTERED', received_message.text);
    userInputs[user_id].phone = received_message.text;
    current_question = 'q6';
    botQuestions(current_question, sender_psid);
  } else if (current_question == 'q6') {
    console.log('EMAIL ENTERED', received_message.text);
    userInputs[user_id].email = received_message.text;
    current_question = 'q7';
    botQuestions(current_question, sender_psid);
  } else if (current_question == 'q7') {
    console.log('MESSAGE ENTERED', received_message.text);
    userInputs[user_id].message = received_message.text;
    current_question = '';
    confirmAppointment(sender_psid);
  } else if (selectedRegorCon == "registration") {
    updateReference = received_message.text;
    console.log('Registration: updateReference:', received_message.text);
    selectedRegorCon = "";
    checkRegistrationReferenceNumber(sender_psid);
  } else if (selectedRegorCon == "consultation") {
    updateReference = received_message.text;
    selectedRegorCon = "";
    console.log('Consultation: updateReference:', received_message.text);
    checkConsultationReferenceNumber(sender_psid);
  } else if (viewReference == "consultations") {
    updateReference = received_message.text;
    viewReference = "";
    console.log('VIEW REFERENCE: updateReference:', received_message.text);
    checkConsultationReferenceNumber3(sender_psid);
  }
  else {

    let user_message = received_message.text;

    user_message = user_message.toLowerCase();

    switch (user_message) {
      case "hi":
        userChoice(sender_psid);
        break;
      case "hospital":
        //hospitalAppointment(sender_psid);
        userChoice(sender_psid);
        break;
      case "text":
        textReply(sender_psid);
        break;
      case "quick":
        quickReply(sender_psid);
        break;
      case "button":
        buttonReply(sender_psid);
        break;
      case "webview":
        webviewTest(sender_psid);
        break;
      case "show images":
        showImages(sender_psid)
        break;
      default:
        userChoice(sender_psid);
    }


  }

}

/*********************************************
Function to handle when user send attachment
**********************************************/


const handleAttachments = (sender_psid, attachments) => {

  console.log('ATTACHMENT', attachments);


  let response;
  let attachment_url = attachments[0].payload.url;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Is this the right picture?",
          "subtitle": "Tap a button to answer.",
          "image_url": attachment_url,
          "buttons": [
            {
              "type": "postback",
              "title": "Yes!",
              "payload": "yes-attachment",
            },
            {
              "type": "postback",
              "title": "No!",
              "payload": "no-attachment",
            }
          ],
        }]
      }
    }
  }
  callSend(sender_psid, response);
}


/*********************************************
Function to handle when user click button
**********************************************/
const handlePostback = (sender_psid, received_postback) => {

  let payload = received_postback.payload;

  console.log('BUTTON PAYLOAD', payload);
  if (payload.startsWith("choice:")) {
    let user_choice = payload.slice(7);
    console.log('USER CHOICE IS: ', user_choice);
    switch (user_choice) {
      case "Registration":
        hospitalAppointment(sender_psid);
        break;
      case "Consultation":
        consultationAppointment(sender_psid);
        break;
      case "Update Booking":
        updateBooking(sender_psid);
        break;
      case "View Results":
        viewResults(sender_psid);
        break;
      case "Reception":
        receptionPhoneNo(sender_psid);
        break;
      case "Ambulance":
        ambulancePhoneNo(sender_psid);
        break;
      case "Emergency":
        emergencyPhoneNo(sender_psid);
        break;
      default:
        defaultReply(sender_psid);
    }
  } else if (payload.startsWith("Doctor:")) {
    let doctor_name = payload.slice(7);
    console.log('SELECTED DOCTOR IS: ', doctor_name);
    userInputs[user_id].doctor = doctor_name;
    console.log('TEST', userInputs);
    firstOrFollowUp(sender_psid);
  } else if (payload.startsWith("ConsultDoctor:")) {
    let doctor_name = payload.slice(14);
    selectedDoc = doctor_name;
    console.log('SELECTED DOCTOR IS: ', doctor_name);
    //userInputs[user_id].doctor = doctor_name;
    console.log('TEST', userInputs);
    fillConsultationForm(sender_psid);
  } else {
    switch (payload) {
      case "yes":
        showButtonReplyYes(sender_psid);
        break;
      case "no":
        showButtonReplyNo(sender_psid);
        break;
      default:
        defaultReply(sender_psid);
    }

  }



}


const generateRandom = (length) => {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/*********************************************
GALLERY SAMPLE
**********************************************/

const showImages = (sender_psid) => {
  let response;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "show images",
          "buttons": [
            {
              "type": "web_url",
              "title": "enter",
              "url": "https://fbstarter.herokuapp.com/showimages/" + sender_psid,
              "webview_height_ratio": "full",
              "messenger_extensions": true,
            },

          ],
        }]
      }
    }
  }
  callSendAPI(sender_psid, response);
}


/*********************************************
END GALLERY SAMPLE
**********************************************/


function webviewTest(sender_psid) {
  let response;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Consult your doctor while you stay safe at home",
          "buttons": [
            {
              "type": "web_url",
              "title": "Consultation",
              "url": APP_URL + "webview/" + sender_psid,
              "webview_height_ratio": "full",
              "messenger_extensions": true,
            },

          ],
        }]
      }
    }
  }
  callSendAPI(sender_psid, response);
}

/**************
start hospital
**************/

const userChoice = (sender_psid) => {
  let response1 = { "text": "Welcome to STTK Hospital. How may I help you?" };
  let response2 = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Appointment Registration",
          "subtitle": "Make your appointment",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/appointment.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Registration",
              "payload": "choice:Registration",
            },
          ],
        }, {
          "title": "Consultation",
          "subtitle": "Consult your doctor while you stay safe at home",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/consultation.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Consultation",
              "payload": "choice:Consultation",
            },
          ],
        }, {
          "title": "Update Booking",
          "subtitle": "You can update your booking.",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/updatebooking.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Update Booking",
              "payload": "choice:Update Booking",
            },
          ],
        }, {
          "title": "Consultations Results",
          "subtitle": "You can view your consultations results.",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/consultationResult.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "View Results",
              "payload": "choice:View Results",
            },
          ],
        },
        {
          "title": "Reception Desk",
          "subtitle": "Communicating in a positive and confident manner with those over the phone, call me",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/reception.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Reception Desk",
              "payload": "choice:Reception",
            },
          ],
        }, {
          "title": "Ambulance Service",
          "subtitle": "Ambulance Service saving lives in emergency",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/ambulance.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Ambulance Service",
              "payload": "choice:Ambulance",
            },
          ],
        }, {
          "title": "Emergency Phone No",
          "subtitle": "If someone is seriously ill or injuried, call this phone no.",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/emergency.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Emergency",
              "payload": "choice:Emergency",
            },
          ],
        }, {
          "title": "Locate @",
          "subtitle": "Location of STTK hospital",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/location.jpg?raw=true",
          "default_action": {
            "type": "web_url",
            "url": "https://www.google.com/maps/place/Sitta+Thukha/@22.0235931,96.4621906,18.62z/data=!4m5!3m4!1s0x30cc9e9b3d092cdf:0xb1bac5f6278b5b8c!8m2!3d22.0238096!4d96.4622194",
            "webview_height_ratio": "full",
          },
          /*"buttons": [
              {
              "type":"web_url",
              "url":"https://petersfancybrownhats.com",
              "title":"View Location"
            },
              {
                "type": "postback",
                "title": "Locate at",
                "payload": "choice:Location",
              },               
            ],*/
        }

        ]
      }
    }
  }


  callSend(sender_psid, response1).then(() => {
    return callSend(sender_psid, response2);
  });

}

const hospitalAppointment = (sender_psid) => {
  let response1 = {
    "text": "Which areas are you looking for the hospital in?",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "Cardiac Surgery",
        "payload": "department:Cardiac Surgery",
      }, {
        "content_type": "text",
        "title": "Ear Nose Throat",
        "payload": "department:Ear Nose Throat",
      }, {
        "content_type": "text",
        "title": "General Medicine",
        "payload": "department:General Medicine",
      }, {
        "content_type": "text",
        "title": "Hepatology",
        "payload": "department:Hepatology",
      }, {
        "content_type": "text",
        "title": "Neurology",
        "payload": "department:Neurology",
      }, {
        "content_type": "text",
        "title": "Obstetrics",
        "payload": "department:Obstetrics",
      }, {
        "content_type": "text",
        "title": "Ophthalmology",
        "payload": "department:Ophthalmology",
      }, {
        "content_type": "text",
        "title": "Orthopedic",
        "payload": "department:Orthopedic",
      }, {
        "content_type": "text",
        "title": "Paediatrics",
        "payload": "department:Paediatrics",
      }, {
        "content_type": "text",
        "title": "Respiratory",
        "payload": "department:Respiratory",
      }
    ]
  };

  callSend(sender_psid, response1);
}

const consultationAppointment = (sender_psid) => {
  let response1 = {
    "text": "Which areas are you looking for the hospital to consult?",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "Psychiatry",
        "payload": "depart:Psychiatry",
      }, {
        "content_type": "text",
        "title": "General Medicine",
        "payload": "depart:General Medicine",
      }
    ]
  };
  callSend(sender_psid, response1);
}

const updateBooking = (sender_psid) => {
  let response1 = {
    "text": "Which areas are you update: Registration or Consultation?",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "Registration Update",
        "payload": "update:Registration",
      }, {
        "content_type": "text",
        "title": "Consultation Update",
        "payload": "update:Consultation",
      }
    ]
  };
  callSend(sender_psid, response1);
}


const showCardiacSurgeryDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Khin Mg Htwe",
          "subtitle": "M.B.B.S., M.Med.Sc(Surgery)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/cardiacsurgery.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Khin Mg Htwe",
              "payload": "Doctor:Dr. Khin Mg Htwe",
            },
          ],
        }, {
          "title": "Dr. Wunna Tun",
          "subtitle": "M.B.B.S., M.Med.Sc(Surgery)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/cardiacsurgery.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Wunna Tun",
              "payload": "Doctor:Dr. Wunna Tun",
            },
          ],
        }, {
          "title": "Dr. Soe Min",
          "subtitle": "M.B.B.S., M.Med.Sc(Surgery)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/cardiacsurgery.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Soe Min",
              "payload": "Doctor:Dr. Soe Min",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);

}


const showEarNoseThroatDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Khin Khin Phyu",
          "subtitle": "M.B.B.S., M.Med.Sc(ORL)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/earnosethroat.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Khin Khin Phyu",
              "payload": "Doctor:Dr. Khin Khin Phyu",
            },
          ],
        }, {
          "title": "Dr. Moe Thidar Lin",
          "subtitle": "M.B.B.S., M.Med.Sc(ENT)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/earnosethroat.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Moe Thidar Lin",
              "payload": "Doctor:Dr. Moe Thidar Lin",
            },
          ],
        }, {
          "title": "Dr. Cho Mar Tin",
          "subtitle": "M.B.B.S., M.Med.Sc(ENT)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/earnosethroat.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Cho Mar Tin",
              "payload": "Doctor:Dr. Cho Mar Tin",
            },
          ],
        }
        ]
      }
    }
  }
  callSend(sender_psid, response);
}


const showGeneralMedicineDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Ma Ma Gyi",
          "subtitle": "M.B.B.S., MRCP(UK), FRCP(Edin), FACTM(Aus)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/generalmedicine.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Ma Ma Gyi",
              "payload": "Doctor:Dr. Ma Ma Gyi",
            },
          ],
        }, {
          "title": "Dr. U Myat Chit",
          "subtitle": "M.B.B.S., M.Med.Sc(Int:Med), DTM&H (Landon)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/generalmedicine.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. U Myat Chit",
              "payload": "Doctor:Dr. U Myat Chit",
            },
          ],
        }, {
          "title": "Dr. Tin Htut",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/generalmedicine.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Tin Htut",
              "payload": "Doctor:Dr. Tin Htut",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showHepatologyDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Thandar Tun",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med), MRCP (UK), FRCP(Edin), Dr. Med.Sc (Hepatology)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/hepatology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Thandar Tun",
              "payload": "Doctor:Dr. Thandar Tun",
            },
          ],
        }, {
          "title": "Dr. Kyaw Thet Tun",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/hepatology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Kyaw Thet Tun",
              "payload": "Doctor:Dr. Kyaw Thet Tun",
            },
          ],
        }, {
          "title": "Dr. Win Ei Ei",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/hepatology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Win Ei Ei",
              "payload": "Doctor:Dr. Win Ei Ei",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}


const showNeurologyDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Myint Oo",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med), MRCP (UK), FRCP",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/neurology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Myint Oo",
              "payload": "Doctor:Dr. Myint Oo",
            },
          ],
        }, {
          "title": "Dr. Moe Moe Zaw",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med), MRCP (UK), Dr. Med.Sc (Neurology)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/neurology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Moe Moe Zaw",
              "payload": "Doctor:Dr. Moe Moe Zaw",
            },
          ],
        }, {
          "title": "Dr. Kyi Kyi Maw",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int:Med), MRCP (UK)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/neurology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Kyi Kyi Maw",
              "payload": "Doctor:Dr. Kyi Kyi Maw",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showObstetricsDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Myint Myint Aye",
          "subtitle": "M.B.,B.S. M.Med.Sc (OG), MRCOG (UK)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/obstetric.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Myint Myint Aye",
              "payload": "Doctor:Dr. Myint Myint Aye",
            },
          ],
        }, {
          "title": "Dr. Myint Thet Mon",
          "subtitle": "M.B.,B.S. M.Med.Sc (OG), Dip. Med.Sc(OG) Dr. Med.Sc (OG)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/obstetric.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Myint Thet Mon",
              "payload": "Doctor:Dr. Myint Thet Mon",
            },
          ],
        }, {
          "title": "Dr. Kyi Kyi Myint",
          "subtitle": "M.B.,B.S. M.Med.Sc (OG)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/obstetric.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Kyi Kyi Myint",
              "payload": "Doctor:Dr. Kyi Kyi Myint",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showOphthalmologyDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Thin Kyu Aye",
          "subtitle": "M.B.,B.S. M.Med.Sc (Ophth), D.C.E.H (London), F.L.C.S (Ophth), F.A.C.S (USA)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/ophthalmology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Thin Kyu Aye",
              "payload": "Doctor:Dr. Thin Kyu Aye",
            },
          ],
        }, {
          "title": "Dr. Sandar Myint",
          "subtitle": "M.B.,B.S. M.Med.Sc (Ophth)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/ophthalmology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Sandar Myint",
              "payload": "Doctor:Dr. Sandar Myint",
            },
          ],
        }, {
          "title": "Dr. Amy Aung",
          "subtitle": "M.B.,B.S. M.Med.Sc (Ophth)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/ophthalmology.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Amy Aung",
              "payload": "Doctor:Dr. Amy Aung",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showOrthopedicDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Khaing Soe Tun",
          "subtitle": "M.B.,B.S. M.Med.Sc (Ortho)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/orthopedic.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Khaing Soe Tun",
              "payload": "Doctor:Dr. Khaing Soe Tun",
            },
          ],
        }, {
          "title": "Dr. Nay Myo Tun",
          "subtitle": "M.B.,B.S. M.Med.Sc (Ortho), Dr. Med. Sc, F.I.C.S (Ortho)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/orthopedic.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Nay Myo Tun",
              "payload": "Doctor:Dr. Nay Myo Tun",
            },
          ],
        }, {
          "title": "Dr. Nay Tun",
          "subtitle": "M.B.,B.S. M.Med.Sc (Ortho)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/orthopedic.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Nay Tun",
              "payload": "Doctor:Dr. Nay Tun",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showPaediatricsDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Thida",
          "subtitle": "M.B.,B.S. M.Med.Sc (Paed;), MRCP (UK), FRCP (CH), Dr. Med. Sc (Paed;), Dip. Med. Ed",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/paediatric.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Thida",
              "payload": "Doctor:Dr. Thida",
            },
          ],
        }, {
          "title": "Dr. Nwet Nwet Tin",
          "subtitle": "M.B.,B.S. M.Med.Sc (Paed;)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/paediatric.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Nwet Nwet Tin",
              "payload": "Doctor:Dr. Nwet Nwet Tin",
            },
          ],
        }, {
          "title": "Dr. Moh Moh Thwe",
          "subtitle": "M.B.,B.S. M.Med.Sc (Paed;), MRCPCH (UK)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/paediatric.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Moh Moh Thwe",
              "payload": "Doctor:Dr. Moh Moh Thwe",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showRespiratoryDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Aye Win Satt",
          "subtitle": "M.B.,B.S. MRCP (UK), FRCP(Edin), Dr. Med. Sc(Respiratory Medicine), FCCP (USA)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/respiratory.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Aye Win Satt",
              "payload": "Doctor:Dr. Aye Win Satt",
            },
          ],
        }, {
          "title": "Dr. Yin Mon Thant",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int: Med), MRCP, FRCP, Dr. Med. Sc (Respiratory Medicine)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/respiratory.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Yin Mon Thant",
              "payload": "Doctor:Dr. Yin Mon Thant",
            },
          ],
        }, {
          "title": "Dr. Twe Tar Oo",
          "subtitle": "M.B.,B.S. M.Med.Sc (Int: Med), Dr. Med. Sc (Respiratory Medicine)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/respiratory.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Twe Tar Oo",
              "payload": "Doctor:Dr. Twe Tar Oo",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
}

const showPsychiatryDoctor = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Phyu Sin Win",
          "subtitle": "M.B.B.S., M.Med.Sc(Mental Health)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/psychaitry.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Phyu Sin Win",
              "payload": "ConsultDoctor:Dr. Phyu Sin Win",
            },
          ],
        }, {
          "title": "Dr. Cho Nwe Zin",
          "subtitle": "M.B.B.S., M.Med.Sc(Psy)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/psychaitry.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Cho Nwe Zin",
              "payload": "ConsultDoctor:Dr. Cho Nwe Zin",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);
  selectedDept = "Psychiatry";


}


const showGMDoctorConsult = (sender_psid) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Dr. Kyaw Thu",
          "subtitle": "M.B.B.S., M.Med.Sc(Int:Med), MRCP(UK)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/generalmedicine.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Kyaw Thu",
              "payload": "ConsultDoctor:Dr. Kyaw Thu",
            },
          ],
        }, {
          "title": "Dr. Maung Oo",
          "subtitle": "M.B.B.S., M.Med.Sc(Int:Med)",
          "image_url": "https://github.com/wintaye71/sttk/blob/master/images/generalmedicine.jpg?raw=true",
          "buttons": [
            {
              "type": "postback",
              "title": "Dr. Maung Oo",
              "payload": "ConsultDoctor:Dr. Maung Oo",
            },
          ],
        }

        ]
      }
    }
  }
  callSend(sender_psid, response);

}



const enterRegistrationReference = (sender_psid) => {
  let response = { "text": "Enter your booking reference number you want to update." };
  callSend(sender_psid, response);
}

const enterConsultationReference = (sender_psid) => {
  let response = { "text": "Enter your booking reference number you want to update." };
  callSend(sender_psid, response);
}

let viewReference = "";
const viewResults = (sender_psid) => {
  viewReference = "consultations"
  let response = { "text": "Enter your booking reference number you want to see the results." };
  callSend(sender_psid, response);
}

const receptionPhoneNo = (sender_psid) => {
  let response = { "text": "You can contact STTK's Reception Desk.\r\nReception Phone No: 09111222333" };
  callSend(sender_psid, response);
}

const ambulancePhoneNo = (sender_psid) => {
  let response = { "text": "You can contact STTK's Ambulance.\r\nAmbulance Phone No: 0911223344" };
  callSend(sender_psid, response);
}

const emergencyPhoneNo = (sender_psid) => {
  let response = { "text": "You can contact STTK's Emergency Department.\r\nEmergency Phone No:  09123123123" };
  callSend(sender_psid, response);
}

const firstOrFollowUp = (sender_psid) => {

  let response = {
    "text": "Are you visiting for the first time, or is it a follow-up visit?",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "First Time",
        "payload": "visit:first time",
      }, {
        "content_type": "text",
        "title": "Follow Up",
        "payload": "visit:follow up",
      }
    ]
  };
  callSend(sender_psid, response);

}

const fillConsultationForm = (sender_psid) => {
  let response;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "What questions would you like to ask your doctor? Please tell the conditions.",
          "buttons": [
            {
              "type": "web_url",
              "title": "Consult",
              "url": APP_URL + "webview/" + sender_psid,
              "webview_height_ratio": "full",
              "messenger_extensions": true,
            },

          ],
        }]
      }
    }
  }
  callSendAPI(sender_psid, response);
}

const registrationPending = (sender_psid) => {
  let response;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Update your booking data.",
          "buttons": [
            {
              "type": "web_url",
              "title": "Update",
              "url": APP_URL + "webview2/" + sender_psid,
              "webview_height_ratio": "full",
              "messenger_extensions": true,
            },

          ],
        }]
      }
    }
  }
  callSendAPI(sender_psid, response);
}

const consultationPending = (sender_psid) => {
  let response;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Update your booking data.",
          "buttons": [
            {
              "type": "web_url",
              "title": "Update",
              "url": APP_URL + "webview3/" + sender_psid,
              "webview_height_ratio": "full",
              "messenger_extensions": true,
            },

          ],
        }]
      }
    }
  }
  callSendAPI(sender_psid, response);
}

const botQuestions = (current_question, sender_psid) => {
  if (current_question == 'q1') {
    let response = { "text": bot_questions.q1 };
    callSend(sender_psid, response);
  } else if (current_question == 'q2') {
    let response = { "text": bot_questions.q2 };
    callSend(sender_psid, response);
  } else if (current_question == 'q3') {
    let response = { "text": bot_questions.q3 };
    callSend(sender_psid, response);
  } else if (current_question == 'q4') {
    let response = {
      "text": bot_questions.q4,
      "quick_replies": [
        {
          "content_type": "text",
          "title": "Male",
          "payload": "gender:male",
        }, {
          "content_type": "text",
          "title": "Female",
          "payload": "gender:female",
        }
      ]
    };
    callSend(sender_psid, response);
  } else if (current_question == 'q5') {
    let response = { "text": bot_questions.q5 };
    callSend(sender_psid, response);
  } else if (current_question == 'q6') {
    let response = { "text": bot_questions.q6 };
    callSend(sender_psid, response);
  } else if (current_question == 'q7') {
    let response = { "text": bot_questions.q7 };
    callSend(sender_psid, response);
  }
}

const confirmAppointment = (sender_psid) => {
  console.log('APPOINTMENT INFO', userInputs);
  let summery = "Department: " + userInputs[user_id].department + "\u000A";
  summery += "Doctor: " + userInputs[user_id].doctor + "\u000A";
  summery += "Visit: " + userInputs[user_id].visit + "\u000A";
  summery += "Date: " + userInputs[user_id].date + "\u000A";
  summery += "Time: " + userInputs[user_id].time + "\u000A";
  summery += "Name: " + userInputs[user_id].name + "\u000A";
  summery += "Gender: " + userInputs[user_id].gender + "\u000A";
  summery += "Phone: " + userInputs[user_id].phone + "\u000A";
  summery += "Email: " + userInputs[user_id].email + "\u000A";
  summery += "Message: " + userInputs[user_id].message + "\u000A";

  let response1 = { "text": summery };

  let response2 = {
    "text": "Select your reply",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "Confirm",
        "payload": "confirm-appointment",
      }, {
        "content_type": "text",
        "title": "Cancel",
        "payload": "off",
      }
    ]
  };

  callSend(sender_psid, response1).then(() => {
    return callSend(sender_psid, response2);
  });
}

const saveAppointment = (arg, sender_psid) => {
  let data = arg;
  data.ref = generateRandom(6);
  data.status = "pending";
  data.created_on = new Date();
  db.collection('appointments').add(data).then((success) => {
    console.log('SAVED', success);
    let text = "Thank you. We have received your appointment." + "\u000A";
    text += " We wil call you to confirm soon" + "\u000A";
    text += "Your booking reference number is:" + data.ref;
    let response = { "text": text };
    callSend(sender_psid, response);
  }).catch((err) => {
    console.log('Error', err);
  });
}

const checkRegistrationReferenceNumber = (sender_psid) => {
  isValidBooking(updateReference, sender_psid);
  console.log("checkRegistrationReferenceNumber");
}

const checkConsultationReferenceNumber = (sender_psid) => {
  isValidBooking2(updateReference, sender_psid);
  console.log("checkConsultationReferenceNumber");
}

let updateData2 = [];
async function isValidBooking2(refer, sender_psid) {
  try {
    const consultRef = db.collection('consult');
    const snapshot = await consultRef.where('reference', '==', refer).get();
    if (snapshot.empty) {
      noDataRegistration(sender_psid);
      console.log('DATA:', 'no data');
      return;
    } else {
      snapshot.forEach(doc => {
        let consult = {};
        consult = doc.data();
        consult.doc_id = doc.id;

        updateData2.push(consult);

      });
      console.log('DATA:', updateData);
      updateData2.forEach(function (consult) {
        if (consult.status == 'confirm') {
          console.log('consult.status:', consult.status);
          registrationConfirmReply(sender_psid);
          return;
        } else {
          console.log('consult.status:', consult.status);
          consultationPending(sender_psid);

          return;
        }
      });
    }
    return updateData2;
  } catch (err) {
    throw err;
  }
}

const checkConsultationReferenceNumber3 = (sender_psid) => {
  isValidBooking3(updateReference, sender_psid);
  console.log("checkConsultationReferenceNumber3");
}

let updateData3 = [];
async function isValidBooking3(refer, sender_psid) {
  try {
    updateData3 = [];
    let replytext = "";
    const consultRef = db.collection('consult');
    const snapshot = await consultRef.where('reference', '==', refer).get();
    if (snapshot.empty) {
      noDataResults(sender_psid);
      console.log('DATA:', 'no data');
      return;
    } else {
      snapshot.forEach(doc => {
        let consult = {};
        consult = doc.data();
        consult.doc_id = doc.id;

        updateData3.push(consult);

      });
      console.log('DATA:', updateData3);
      updateData3.forEach(function (consult) {
        if (consult.status == 'confirm') {
          console.log('consult.status:', consult.status);
          //registrationConfirmReply(sender_psid);
          replytext = "Questions:\n" + consult.message + "\nAnswers:\n" + consult.answers;
          consultationsResultReply(sender_psid, replytext);
          //replytext = "";
          return;
        } else {
          console.log('consult.status:', consult.status);          
          consultationsPendingReply(sender_psid);
          return;
        }
      });
    }
    return updateData3;
  } catch (err) {
    throw err;
  }
}








/**************
end hospital
**************/

const noDataRegistration = (sender_psid) => {
  let response = { "text": "Your reference number is not in the appointment registration." };
  callSend(sender_psid, response);
}

const noDataConsultation = (sender_psid) => {
  let response = { "text": "Your reference number is not in the appointment consultation." };
  callSend(sender_psid, response);
}

const noDataResults = (sender_psid) => {
  let response = { "text": "Your reference number is not in the consultation lists." };
  callSend(sender_psid, response);
}

const registrationConfirm = (sender_psid) => {
  let response = { "text": "Your reference number is already confirm in the appointment registration." };
  callSend(sender_psid, response);
}

const consultationConfirm = (sender_psid) => {
  let response = { "text": "Your reference number is already confirm in the appointment consultation." };
  callSend(sender_psid, response);
}


const hiReply = (sender_psid) => {
  let response = { "text": "You sent hi message" };
  callSend(sender_psid, response);
}


const greetInMyanmar = (sender_psid) => {
  let response = { "text": "Mingalarbar. How may I help" };
  callSend(sender_psid, response);
}

const textReply = (sender_psid) => {
  let response = { "text": "You sent text message" };
  callSend(sender_psid, response);
}


const quickReply = (sender_psid) => {
  let response = {
    "text": "Select your reply",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "On",
        "payload": "on",
      }, {
        "content_type": "text",
        "title": "Off",
        "payload": "off",
      }
    ]
  };
  callSend(sender_psid, response);
}

const showQuickReplyOn = (sender_psid) => {
  let response = { "text": "You sent quick reply ON" };
  callSend(sender_psid, response);
}

const showQuickReplyOff = (sender_psid) => {
  let response = { "text": "You sent quick reply OFF" };
  callSend(sender_psid, response);
}

const buttonReply = (sender_psid) => {

  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Are you OK?",
          "image_url": "https://www.mindrops.com/images/nodejs-image.png",
          "buttons": [
            {
              "type": "postback",
              "title": "Yes!",
              "payload": "yes",
            },
            {
              "type": "postback",
              "title": "No!",
              "payload": "no",
            }
          ],
        }]
      }
    }
  }


  callSend(sender_psid, response);
}

const showButtonReplyYes = (sender_psid) => {
  let response = { "text": "You clicked YES" };
  callSend(sender_psid, response);
}

const showButtonReplyNo = (sender_psid) => {
  let response = { "text": "You clicked NO" };
  callSend(sender_psid, response);
}

const thankyouReply = (sender_psid, name, img_url) => {
  let response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Thank you! " + name,
          "image_url": img_url,
          "buttons": [
            {
              "type": "postback",
              "title": "Yes!",
              "payload": "yes",
            },
            {
              "type": "postback",
              "title": "No!",
              "payload": "no",
            }
          ],
        }]
      }
    }
  }
  callSend(sender_psid, response);
}

function testDelete(sender_psid) {
  let response;
  response = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Delete Button Test",
          "buttons": [
            {
              "type": "web_url",
              "title": "enter",
              "url": "https://fbstarter.herokuapp.com/test/",
              "webview_height_ratio": "full",
              "messenger_extensions": true,
            },

          ],
        }]
      }
    }
  }
  callSendAPI(sender_psid, response);
}

const defaultReply = (sender_psid) => {
  let response1 = { "text": "To test text reply, type 'text'" };
  let response2 = { "text": "To test quick reply, type 'quick'" };
  let response3 = { "text": "To test button reply, type 'button'" };
  let response4 = { "text": "To test webview, type 'webview'" };
  callSend(sender_psid, response1).then(() => {
    return callSend(sender_psid, response2).then(() => {
      return callSend(sender_psid, response3).then(() => {
        return callSend(sender_psid, response4);
      });
    });
  });
}

const callSendAPI = (sender_psid, response) => {
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  return new Promise(resolve => {
    request({
      "uri": "https://graph.facebook.com/v6.0/me/messages",
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "POST",
      "json": request_body
    }, (err, res, body) => {
      if (!err) {
        //console.log('RES', res);
        console.log('BODY', body);
        resolve('message sent!')
      } else {
        console.error("Unable to send message:" + err);
      }
    });
  });
}

async function callSend(sender_psid, response) {
  let send = await callSendAPI(sender_psid, response);
  return 1;
}


const uploadImageToStorage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject('No image file');
    }
    let newFileName = `${Date.now()}_${file.originalname}`;

    let fileUpload = bucket.file(newFileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4
        }
      }
    });

    blobStream.on('error', (error) => {
      console.log('BLOB:', error);
      reject('Something is wrong! Unable to upload at the moment.');
    });

    blobStream.on('finish', () => {
      // The public URL can be used to directly access the file via HTTP.
      //const url = format(`https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`);
      const url = format(`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${fileUpload.name}?alt=media&token=${uuidv4}`);
      console.log("image url:", url);
      resolve(url);
    });

    blobStream.end(file.buffer);
  });
}




/*************************************
FUNCTION TO SET UP GET STARTED BUTTON
**************************************/

const setupGetStartedButton = (res) => {
  let messageData = { "get_started": { "payload": "get_started" } };

  request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token=' + PAGE_ACCESS_TOKEN,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    form: messageData
  },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        res.send(body);
      } else {
        // TODO: Handle errors
        res.send(body);
      }
    });
}

/**********************************
FUNCTION TO SET UP PERSISTENT MENU
***********************************/



const setupPersistentMenu = (res) => {
  var messageData = {
    "persistent_menu": [
      {
        "locale": "default",
        "composer_input_disabled": false,
        "call_to_actions": [
          {
            "type": "postback",
            "title": "View My Tasks",
            "payload": "view-tasks"
          },
          {
            "type": "postback",
            "title": "Add New Task",
            "payload": "add-task"
          },
          {
            "type": "postback",
            "title": "Cancel",
            "payload": "cancel"
          }
        ]
      },
      {
        "locale": "default",
        "composer_input_disabled": false
      }
    ]
  };

  request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token=' + PAGE_ACCESS_TOKEN,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    form: messageData
  },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        res.send(body);
      } else {
        res.send(body);
      }
    });
}

/***********************
FUNCTION TO REMOVE MENU
************************/

const removePersistentMenu = (res) => {
  var messageData = {
    "fields": [
      "persistent_menu",
      "get_started"
    ]
  };
  request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token=' + PAGE_ACCESS_TOKEN,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    form: messageData
  },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        res.send(body);
      } else {
        res.send(body);
      }
    });
}


/***********************************
FUNCTION TO ADD WHITELIST DOMAIN
************************************/

const whitelistDomains = (res) => {
  var messageData = {
    "whitelisted_domains": [
      APP_URL,
      "https://herokuapp.com",
    ]
  };
  request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token=' + PAGE_ACCESS_TOKEN,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    form: messageData
  },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        res.send(body);
      } else {
        res.send(body);
      }
    });
} 