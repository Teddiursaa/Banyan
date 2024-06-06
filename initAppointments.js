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
const Appointments = new TableClient(process.env.AZURE_TABLE_URL, 'Appointments', credential);

async function getEntity(TableClient, partitionKey, rowKey)
{
    return await TableClient.getEntity(partitionKey, rowKey).then((value) => {
        return value;
    }, (err) => { 
        return null;
    });
};

import data from './data.json' assert { type: 'json'};

for (var appointment of data.appointments) {
    const ownerID = appointment.ownerID;
    const startTime = Date.parse(appointment.start) / 1800000;
    const endTime = Date.parse(appointment.end) / 1800000;
    
    const workersList = Workers.listEntities();
    for await (var worker of workersList) {
        console.log(worker.rowKey + " " + worker.name + " " + ownerID + " " + appointment.worker);
        if (worker.rowKey == ownerID && worker.name == appointment.worker) {
            const Entity = {
                partitionKey: worker.partitionKey,
                rowKey: startTime.toString(),
                ownerID: ownerID,
                active: true,
                deactivationDate: undefined,
                length: endTime - startTime
            };
            Appointments.createEntity(Entity);
            break;
        }
    } 
}