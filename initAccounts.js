import { config } from 'dotenv';
config({ path: '.env' });
import { v4 } from 'uuid';

import DataTables from '@azure/data-tables';

const TableClient = DataTables.TableClient;
const AzureNamedKeyCredential = DataTables.AzureNamedKeyCredential;

const storageAccount = process.env.AZURE_STORAGE_ACCOUNT;
const storageAccountKey = process.env.AZURE_STORAGE_ACCESS_KEY;

const credential = new AzureNamedKeyCredential(storageAccount, storageAccountKey);
const Accounts = new TableClient(process.env.AZURE_TABLE_URL, 'Accounts', credential);
const AccountsID = new TableClient(process.env.AZURE_TABLE_URL, 'AccountsID', credential);

async function getEntity(TableClient, partitionKey, rowKey) {
    return await TableClient.getEntity(partitionKey, rowKey).then((value) => {
        return value;
    }, (err) => {
        return null;
    });
};

import bcrypt from 'bcrypt';

import data from './data.json' assert { type: 'json'};

const saltRounds = 10;

console.log(data);

for await (var user of data.users) {
    const ID = v4();
    const IDEntity = {
        partitionKey: user.username,
        rowKey: user.username,
        userID: ID
    }
    var encryptedPassword;
    bcrypt.genSalt(saltRounds, function (err, salt) {
        bcrypt.hash(user.password, salt, function (err, hash) {
            encryptedPassword = hash;
        });
    })

    await AccountsID.createEntity(IDEntity);
    const UserEntity = {
        partitionKey: ID,
        rowKey: ID,
        password: encryptedPassword,
        settings: JSON.stringify({
            "startTime": process.env.START_TIME,
            "endTime": process.env.END_TIME
        }),
        active: true,
        deactivationDate: null
    }
    await Accounts.createEntity(UserEntity);
}