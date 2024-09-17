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
    console.log('mim', sessionID);
    let notCookie = false;
    cookieStore.get(sessionID, (err, cookie) => {
        if (cookie == null || cookie == undefined) notCookie = true;
    });
    console.log(session.isAuth);
    if (notCookie
     || session.isAuth == null
     || session.isAuth == undefined
     || (await getEntity(Accounts, session.isAuth, session.isAuth).then((value) => { return value; }) === null)
        ) {
        return false;
    }
    return true;
}

app.use(async (req, res, next) => {
    if (req.url.split('/')[1] == 'style') {
        if (fs.existsSync(path.join(__dirname, req.url))) res.sendFile(path.join(__dirname, req.url));
        return;
    }
    console.log(req.url);
    console.log(req.url.split('/')[1]);
    if (req.url.split('/')[1] == 'sendlogin') {
        next();
        return;
    }
    console.log("dak");
    console.log(req.url);
    if (req.url == '/login') {
        console.log('asodj');
        next();
    }
    else if (await checkAuth(req) === false) {
        console.log("dak");
        res.redirect('/login');
        return;
    }
    else next();
});


app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
import { start } from 'repl';

app.get('/sendlogin', async (req, res) => {
    const username = req.headers.username;
    const password = req.headers.password;
    console.log(username, password);
    const userID = await getEntity(AccountsID, username, username).then((value) => {
        if (value != null) return value.userID;
        return null;
    });

    console.log(username);
    console.log(password);
    console.log('userID ' + userID);
    if (userID == null) {
        res.send({'good': false});
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
        res.send({'good': true});
        res.end();
    }
    else {
        res.send({'good': false});
        res.end();
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    req.sessionID = undefined;
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/api/appointments/:date', async (req, res) => {
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
        queryOptions: { filter: odata`PartitionKey eq ${ownerID} and active eq true` }
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
});

app.get('/workers', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'workers.html'));
});

app.get('/api/workers', async (req, res) => {
    const ownerID = req.session.isAuth;
    console.log(ownerID);
    const workerList = Workers.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${ownerID} and active eq true` }
    });
    var currentWorker = [];
    for await (const worker of workerList) {
        console.log(worker.timestamp);
        currentWorker.push({ "workerID": worker.rowKey, "name": worker.name, "timestamp": worker.timestamp });
    }
    currentWorker.sort((a, b) => {
        if (a.timestamp < b.timestamp) return -1;
        return 1;
    });
    res.send({"workers": currentWorker});
    res.end();
});

app.post('/new/appointments', async (req, res) => {
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
    await Appointments.upsertEntity(Entity, 'Merge');
    res.end();
    return res;
});

app.post('/del/appointments', async (req, res) => {
    const ownerID = req.session.isAuth;

    console.log('chim chim chim chim chim');
    console.log(req.headers);
    console.log('chim chim chim chim chim');
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
    await Appointments.upsertEntity(Entity, 'Merge');
    res.end();
    return res;
});

app.post('/new/workers', async (req, res) => {
    const ownerID = req.session.isAuth;
    const workerID = v4();
    const worker = req.headers.worker;
    console.log(ownerID);
    const workerEntity = {
        partitionKey: ownerID,
        rowKey: workerID,
        name: worker,
        active: true,
        deactivationDate: null
    };
    Workers.createEntity(workerEntity);
    console.log(workerEntity);
    res.end();
    return res;
});

app.post('/del/workers', async (req, res) => {
    const ownerID = req.session.isAuth;
    const workerID = req.headers.workerid;
    console.log(req.headers);
    console.log(ownerID, workerID);
    let Entity = await getEntity(Workers, ownerID, workerID);
    console.log(Entity);
    console.log(Entity.active, Entity.deactivationDate);
    Entity.active = false;
    Entity.deactivationDate = Date.now();
    Workers.upsertEntity(Entity, 'Merge');
    res.end();
    return res;
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/api/settings', async (req, res) => {
    const ownerID = req.session.isAuth;
    const userlist = await AccountsID.listEntities({
        queryOptions: { filter: odata`userID eq ${ownerID}` }
    });
    let username;
    for await (const user of userlist) {
        username = user.partitionKey;
    }
    console.log(username);

    const Entity = await getEntity(Accounts, ownerID, ownerID);
    console.log(Entity.settings);

    const settings = JSON.parse(Entity.settings);

    const startTime = settings.startTime;
    const endTime = settings.endTime;

    res.send({
        "username": username,
        "startTime": startTime,
        "endTime": endTime
    });
    res.end();
});

app.get('/change/settings', async (req, res) => {
    const userID = req.session.isAuth;
    if (await getEntity(AccountsID, req.headers.username, req.headers.username).then((value) => {
        if (value == null) return null;
        return value.userID;
    }) != userID) {
        res.send({'good': false});
        res.end();
        return;
    }
    const oldpassword = req.headers.oldpassword;
    const realPassword = await getEntity(Accounts, userID, userID).then((value) => {
        return value.password;
    });
    if (!(await bcrypt.compare(oldpassword, realPassword))) {
        res.send({'good': false});
        res.end();
        return;
    }

    console.log(req.headers);
    const newpassword = req.headers.newpassword;
    const startTime = req.headers.starttime;
    const endTime = req.headers.endtime;
    console.log(userID, startTime, endTime);
    if (newpassword != "") {
        let encryptedPassword;
        bcrypt.genSalt(parseInt(process.env.SALTROUNDS), function (err, salt) {
            if (err) console.log(err);
            bcrypt.hash(newpassword, salt, function (err, hash) {
                if (err) console.log(err);
                console.log('hash', hash);  
                encryptedPassword = hash;
            });
            return;
        });
        setTimeout(() => {
            console.log(encryptedPassword);
            Accounts.upsertEntity({
                partitionKey: userID,
                rowKey: userID,
                password: encryptedPassword
            }, 'Merge');
        }, 1000);
    }
    Accounts.upsertEntity({
        partitionKey: userID,
        rowKey: userID,
        settings: JSON.stringify({
            "startTime": startTime,
            "endTime": endTime  
        })
    }, 'Merge');
    console.log('good');
    res.send({'good': true});
    res.end();
    return;
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running at port: ` + PORT.toString());
});
