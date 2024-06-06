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

async function getEntity(TableClient, partitionKey, rowKey)
{
    return await TableClient.getEntity(partitionKey, rowKey).then((value) => {
        return value;
    }, (err) => { 
        return null;
    });
};

import data from './data.json' assert { type: 'json'};
import e from 'express';

console.log(data);

for await (var user of data.users) {
    const ID = v4();
    const IDEntity = {
        partitionKey: user.username,
        rowKey: user.username,
        userID: ID
    }
    await AccountsID.createEntity(IDEntity);
    const UserEntity = {
        partitionKey: ID,
        rowKey: ID,
        password: user.password,
        active: true,
        deactivationDate: null
    }
    await Accounts.createEntity(UserEntity);
}