import { config } from 'dotenv';
config({ path: '.env' });

import DataTables from '@azure/data-tables';
const TableServiceClient = DataTables.TableServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

TableServiceClient.createTable('Accounts');
TableServiceClient.createTable('AccountsID');
TableServiceClient.createTable('Workers');
TableServiceClient.createTable('Appointments');