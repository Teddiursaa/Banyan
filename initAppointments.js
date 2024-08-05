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
    const workerID = appointment.worker;
    const startTime = Date.parse(appointment.start) / 1800000;
    const endTime = Date.parse(appointment.end) / 1800000;
    
    const Entity = {
        partitionKey: workerID,
        rowKey: startTime.toString(),
        start: startTime.toString(),
        ownerID: ownerID,
        active: true,
        customer: JSON.stringify({"name": appointment.customer.name, "tel": appointment.customer.tel, "note": appointment.customer.note}),
        deactivationDate: undefined,
        length: endTime - startTime
    };
    Appointments.createEntity(Entity);
}