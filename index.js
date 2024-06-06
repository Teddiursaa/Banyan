import fs from 'fs';
import path from 'path';
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
app.use(session({ store: cookieStore, secret: 'keyboard cat', isAuth: false }));

import bodyParser from 'body-parser';

app.use(bodyParser.urlencoded({ extended: false }));

import DataTables from '@azure/data-tables';
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

async function checkAuth(sessionID, session) {
    console.log(sessionID);
    console.log(session);
    console.log(session.isAuth);
    console.log('check');
    console.log(await getEntity(Accounts, session.isAuth, session.isAuth).then((value) => { return value; }));
    let notCookie = false;
    cookieStore.get(sessionID, (err, cookie) => {
        if (err == null || err == undefined) notCookie = true;
    });
    console.log(notCookie);
    if (session.isAuth == null
        || await getEntity(Accounts, session.isAuth, session.isAuth).then((value) => { return value; }) === null
        || notCookie) {
        return false;
    }
    return true;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', async (req, res) => {
    if (await checkAuth(req.sessionID, req.session) == true) {
        res.redirect('/');
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

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
        res.redirect('/login.html');
        res.end();
        return;
    }
    const realPassword = await getEntity(Accounts, userID, userID).then((value) => {
        return value.password;
    });
    if (realPassword == password) {
        req.session.isAuth = userID;
        res.cookie("sessionId", req.sessionID);
        res.redirect('/');
    }
    else {
        res.redirect('/login.html');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.sendFile(path.join(__dirname, 'public', 'logout.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
