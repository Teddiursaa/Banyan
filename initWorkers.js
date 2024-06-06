import { config } from 'dotenv';
config({ path: '.env' });
import { v4 } from 'uuid';

import DataTables from '@azure/data-tables';

const TableClient = DataTables.TableClient;
const AzureNamedKeyCredential = DataTables.AzureNamedKeyCredential;

const storageAccount = process.env.AZURE_STORAGE_ACCOUNT;
const storageAccountKey = process.env.AZURE_STORAGE_ACCESS_KEY;

const credential = new AzureNamedKeyCredential(storageAccount, storageAccountKey);
const AccountsID = new TableClient(process.env.AZURE_TABLE_URL, 'AccountsID', credential);
const Workers = new TableClient(process.env.AZURE_TABLE_URL, 'Workers', credential);

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

for await (var worker of data.workers) {
    const ID = v4();
    const ownerEntity = await AccountsID.getEntity(worker.owner, worker.owner);
    const ownerID = ownerEntity.userID;
    console.log(ownerID);
    const workerEntity = {
        partitionKey: ID,
        rowKey: ownerID,
        name: worker.name,
        active: true,
        deactivationDate: null
    };
    Workers.createEntity(workerEntity);
}