import { config } from 'dotenv';
config({ path: '.env' });

import DataTables from '@azure/data-tables';
const TableServiceClient = DataTables.TableServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

const tableList = await TableServiceClient.listTables();
for await (const table of tableList) {
    await TableServiceClient.deleteTable(table.name);
}