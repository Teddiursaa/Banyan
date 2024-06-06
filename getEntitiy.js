const config = require('dotenv').config;
config({ path: '.env' });

const DataTables = require('@azure/data-tables');
const TableServiceClient = DataTables.TableServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

TableServiceClient.createTable('Accounts');
TableServiceClient.createTable('AccountsID');
TableServiceClient.createTable('Workers');
TableServiceClient.createTable('Appointments');

const TableClient = DataTables.TableClient;
const AzureNamedKeyCredential = DataTables.AzureNamedKeyCredential;

const storageAccount = process.env.AZURE_STORAGE_ACCOUNT;
const storageAccountKey = process.env.AZURE_STORAGE_ACCESS_KEY;

const credential = new AzureNamedKeyCredential(storageAccount, storageAccountKey);
const Accounts = new TableClient(process.env.AZURE_TABLE_URL, 'Accounts', credential);

const myEntity = {
    partitionKey: "abc",
    rowKey: "abc"
};

async function getEntity(TableClient, PartitionKey, RowKey)
{
    const dak = await TableClient.getEntity(PartitionKey, RowKey);
    console.log(dak);
    return false;
}

module.exports = getEntity;
