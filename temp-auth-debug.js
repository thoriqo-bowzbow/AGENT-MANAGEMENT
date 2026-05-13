require("dotenv/config");
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query(
    'SELECT id, email, name, role, "createdAt" FROM "User" ORDER BY "createdAt" ASC',
  );

  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});