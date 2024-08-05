import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';
import { fileURLToPath } from 'url'
import { config } from 'dotenv';
config({ path: '.env' });
import express from 'express';
import session from 'express-session';
import connect_azuretables from 'connect-azuretables';
const AzureTablesStoreFactory = connect_azuretables(session);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const options = { sessionTimeOut: process.env.MAX_SESSION };
const cookieStore = AzureTablesStoreFactory.create(options);
app.use(session({ store: cookieStore, secret: 'keyboard cat', genid: v4 }));

import bodyParser from 'body-parser';

app.use(bodyParser.urlencoded({ extended: false }));

import DataTables, { odata } from '@azure/data-tables';
import { Cookie } from 'express-session';

const TableClient = DataTables.TableClient;
const AzureNamedKeyCredential = DataTables.AzureNamedKeyCredential;

const storageAccount = process.env.AZURE_STORAGE_ACCOUNT;
const storageAccountKey = process.env.AZURE_STORAGE_ACCESS_KEY;

const credential = new AzureNamedKeyCredential(storageAccount, storageAccountKey);
const AccountsID = new TableClient(process.env.AZURE_TABLE_URL, 'AccountsID', credential);
const Accounts = new TableClient(process.env.AZURE_TABLE_URL, 'Accounts', credential);
const Workers = new TableClient(process.env.AZURE_TABLE_URL, 'Workers', credential);
const Appointments = new TableClient(process.env.AZURE_TABLE_URL, 'Appointments', credential);

async function getEntity(TableClient, partitionKey, rowKey) {
    return await TableClient.getEntity(partitionKey, rowKey).then((value) => {
        return value;
    }, (err) => {
        return null;
    });
};

async function checkAuth(req) {
    const sessionID = req.sessionID;
    const session = req.session;
    // console.log(sessionID);
    // console.log(session);
    // console.log(session.isAuth == undefined);
    // console.log('check');
    // console.log(await getEntity(Accounts, session.isAuth, session.isAuth).then((value) => { return value; }));
    let notCookie = false;
    cookieStore.get(sessionID, (err, cookie) => {
        if (cookie == null || cookie == undefined) notCookie = true;
    });
    // console.log(notCookie);
    if (session.isAuth === null
     || session.isAuth == undefined
     || (await getEntity(Accounts, session.isAuth, session.isAuth).then((value) => { return value; }) === null) 
     || notCookie) {
        // console.log('good');
        return false;
    }
    return true;
}

app.get('/', async (req, res) => {
    // console.log("abc " + await checkAuth(req));
    if (await checkAuth(req) == true) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    else {
        res.send('Please login!~!');
    }
});

app.get('/login', async (req, res) => {
    if (await checkAuth(req) == true) {
        res.redirect('/');
        res.end();
        return;
    }
    else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

import bcrypt from 'bcrypt';
import { AppendBlobClient } from '@azure/storage-blob';

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const userID = await getEntity(AccountsID, username, username).then((value) => {
        if (value != null) return value.userID;
        return null;
    });
    console.log(username);
    console.log(password);
    console.log('userID ' + userID);
    if (userID == null) {
        res.redirect('/login');
        res.end();
        return;
    }
    const realPassword = await getEntity(Accounts, userID, userID).then((value) => {
        return value.password;
    });
    if (await bcrypt.compare(password, realPassword)) {
        req.session.isAuth = userID;
        res.cookie("sessionId", req.sessionID);
        console.log('logged in!');
        res.redirect('/');
    }
    else {
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.sendFile(path.join(__dirname, 'public', 'logout.html'));
});

app.get('/api/appointments/:date', async (req, res) => {
    if (await checkAuth(req) === false) {
        res.redirect('/login');
        res.end();
        return;
    }
    const ownerID = req.session.isAuth;
    console.log(ownerID);
    const ownerSettings = JSON.parse(await getEntity(Accounts, ownerID, ownerID).then((value) => {
        return value.settings;
    }));
    console.log(req.url);
    var date = new Date(req.url.split('/').at(3)).valueOf();
    console.log( new Date().getTimezoneOffset());
    date = date / 1800000 + new Date().getTimezoneOffset() / 30;
    const beginTime = (date + Number(ownerSettings.startTime || process.env.START_TIME)).toString();
    const endTime = (date + Number(ownerSettings.endTime || process.env.END_TIME)).toString();
    console.log(beginTime);
    console.log(endTime);
    const workersList = Workers.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${ownerID}` }
    });

    var answer = [];
    for await (var worker of workersList) {
        const workerID = worker.rowKey;
        console.log(workerID);
        const AppointmentsList = Appointments.listEntities({
            queryOptions: { filter: odata`PartitionKey eq ${workerID} and RowKey ge ${beginTime} and RowKey lt ${endTime}` }
        });
        let aptList = [];
        for await (var apt of AppointmentsList) {
            console.log(apt);
            console.log(apt.customer);
            aptList.push([apt.rowKey, apt.length, JSON.parse(apt.customer)]);
        }
        answer.push({
            "worker": worker.name,
            "workerID": workerID,
            "appointments": aptList
        });
    }
    console.log(JSON.stringify({
        "date": req.url.split('/').at(3),
        "offset": beginTime,
        "all": answer
    }, null, 4));
    res.contentType('json');
    res.send({
        "date": req.url.split('/').at(3),
        "offset": beginTime,
        "start": Number(ownerSettings.startTime || process.env.START_TIME),
        "length": endTime - beginTime,
        "all": answer
    });
    res.end();
});

app.get('/workers', async (req, res) => {
    if (await checkAuth(req) === false) {
        res.redirect('/login');
        res.end();
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'workers.html'));
});

app.get('/api/workers', async (req, res) => {
    if (await checkAuth(req) === false) {
        res.redirect('/login');
        res.end();
        return;
    }
    const ownerID = req.session.isAuth;
    console.log(ownerID);
    const workerList = Workers.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${ownerID}` }
    });
    var currentWorker = [];
    for await (const worker of workerList) {
        currentWorker.push({ "workerID": worker.rowKey, "name": worker.name });
    }
    res.send({"workers": currentWorker});
    res.end();
});

app.post('/new/appointments', async (req, res) => {
    if (await checkAuth(req) === false) {
        return;
    }
    const ownerID = req.session.isAuth;

    console.log(req.headers);
    const Entity = {
        partitionKey: req.headers.worker,
        rowKey: req.headers.start,
        start: req.headers.start,
        ownerID: ownerID,
        active: true,
        customer: JSON.stringify({
            name: req.headers.name,
            tel: req.headers.tel,
            note: req.headers.note,
        }),
        deactivationDate: undefined,
        length: parseInt(req.headers.length)
    };
    console.log(Entity);
    Appointments.upsertEntity(Entity, 'Merge');
    return res;
});

app.post('/del/appointments', async (req, res) => {
    if (await checkAuth(req) === false) {
        return;
    }
    const ownerID = req.session.isAuth;

    console.log(req.headers);
    const Entity = {
        partitionKey: req.headers.worker,
        rowKey: req.headers.start,
        start: req.headers.start,
        ownerID: ownerID,
        active: true,
        customer: JSON.stringify({
            name: '',
            tel: '',
            note: '',
        }),
        deactivationDate: undefined,
        length: 1
    };
    console.log(Entity);
    Appointments.upsertEntity(Entity, 'Merge');
    return res;
});

app.get('/workers/create', (req, res) => {
    
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running at port: ` + PORT.toString());
});
