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
const Workers = new TableClient(process.env.AZURE_TABLE_URL, 'Workers', credential);

async function getEntity(TableClient, partitionKey, rowKey)
{
    return await TableClient.getEntity(partitionKey, rowKey).then((value) => {
        return value;
    }, (err) => { 
        return null;
    });
};

const userList = AccountsID.listEntities();
for await (var user of userList) {
    const userID = user.userID;
    console.log(userID);
    const workerList = Workers.listEntities();
    for await (var worker of workerList) {
        if (worker.rowKey == userID) {
            console.log(worker.partitionKey);
        }
    }
    console.log();
}